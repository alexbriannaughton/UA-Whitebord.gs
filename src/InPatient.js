// for obtaining a particular location's default background color for the inpatient box
const inpatientDefaultColorMap = new Map([
  ['CH', '#f3f3f3'], // gray for cap hill
  ['DT', '#d0e0e3'], // cyan for downtown
  ['WC', '#ead1dc'] // magenta for white center
]);

// returns the cell coordinates for the location's inpatient box
function inpatientBoxCoords(location) {
  return location === 'CH'
    ? 'R3:W36' // coords for cap hills inpatient box
    : 'B14:H42'; // coords for dt and wc inpatient boxes
};

// for manually adding to inpatient column based on changing an appointment to inpatient status in ezyvet
function addInPatient(appointment) {
  const location = whichLocation(appointment.resources[0].id);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);
  const inpatientBoxRange = sheet.getRange(inpatientBoxCoords(location));
  const rowRange = findEmptyRow(inpatientBoxRange, appointment.consult_id, 0);
  if (!rowRange) return;
  rowRange.setBackground(inpatientDefaultColorMap.get(location));
  populateInpatientRow(appointment, rowRange);
};

function populateInpatientRow(appointment, rowRange) {
  const [animalName, animalSpecies, contactLastName] = getAnimalInfoAndLastName(appointment.animal_id, appointment.contact_id);
  const nameCell = rowRange.offset(0, 0, 1, 1);
  const text = `${animalName} ${contactLastName} (${animalSpecies})`;
  const webAddress = `${sitePrefix}/?recordclass=Consult&recordid=${appointment.consult_id}`;
  const link = makeLink(text, webAddress);
  nameCell.setRichTextValue(link);
  const reasonCell = rowRange.offset(0, 3, 1, 1);
  reasonCell.setValue(appointment.description);
  return;
};

// this will run with a daily trigger to put scheduled procedures in the in patient box.
function getTodaysAppointments() {
  const [todayStart, todayEnd] = getTodayRange();
  const url = `${proxy}/v1/appointment?time_range_start=${todayStart}&time_range_end=${todayEnd}&limit=200`;
  const appts = fetchAndParse(url);
  return processProcedures(appts.items);
};

function getTodayRange() {
  const now = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const todayStart = Math.floor(new Date(now).setHours(0, 0, 0, 0) / 1000); // midnight today in seconds
  const todayEnd = Math.floor(new Date(now).setHours(23, 59, 59, 999) / 1000); // end of day in seconds
  return [todayStart, todayEnd];
};

function processProcedures(apptItems) {
  const procedures = new Map([
    ['CH', []],
    ['DT', []],
    ['WC', []]
  ]);

  const typeIDToNameMap = getTypeIDToNameMap(); // takes appointment type id and returns string with procedure type like 'sx'
  const locationForProcedureMap = new Map([
    ['29', 'CH'], ['30', 'CH'], // cap hill resource ids for procedure columns
    ['27', 'CH'], ['65', 'CH'], // cap hill resource ids for IM columns
    ['57', 'DT'], ['58', 'DT'], // dt resource ids for procedure columns
    ['61', 'WC'], ['62', 'WC'], // wc resource ids for procedure columns
  ]); // this map serves to check if the appointment is in the above column, and sorts per location

  apptItems.forEach(({ appointment }) => {
    const resourceID = appointment.details.resource_list[0];
    const location = locationForProcedureMap.get(resourceID);

    if (location) {
      const procedure = getColorAndSortValue(
        appointment.details,
        resourceID,
        typeIDToNameMap
      );
      procedures.get(location).push(procedure);
    }
  });

  procedures.forEach((locationProcedures, location) => {
    locationProcedures.sort((a, b) => a.sortValue - b.sortValue);
    addScheduledProcedures(locationProcedures, location);
  });
};

function getColorAndSortValue(procedure, resourceID, typeIDToNameMap) {
  // this function sorts procedures by type and adds a color to the procedure/appointment object
  const procedureName = typeIDToNameMap.get(procedure.appointment_type_id);

  // anything that is in the IM column, despite the appointment_type, will be grouped as IM
  if (resourceID === '27' || resourceID === '65') {
    procedure.color = '#d9d2e9'; // light purple
    procedure.sortValue = 5;
  }
  else if (procedureName === 'sx') {
    procedure.color = '#fff2cc'; // light yellowish
    procedure.sortValue = 0;
  }
  else if (procedureName === 'aus') {
    procedure.color = '#cfe2f3'; // light blue 3
    procedure.sortValue = 1;
  }
  else if (procedureName === 'echo') {
    procedure.color = '#f4cccc'; // light red
    procedure.sortValue = 2;
  }
  // we are sorting 'secondary' as OTHER
  // else if (procedureName === 'secondary') {
  //   procedure.color = '#fff2cc'; // light yellowish
  //   return 3; 
  // }
  else if (procedureName === 'dental') {
    procedure.color = '#d9ead3'; // light green
    procedure.sortValue = 4;
  }
  else if (procedureName === 'h/c') {
    procedure.color = '#fce5cd'; // light orangish
    procedure.sortValue = 6;
  }
  else procedure.sortValue = 3; // put before im, dental and h/c if type_id not mentioned above

  return procedure;
}

// takes the appointment type id and returns a string of the procedure's type
function getTypeIDToNameMap() {
  const typeIDToNameMap = new Map();

  // ezyVet typeID: procedure name

  // surgery type ids:
  // 7: surgery
  // 76: spay/neuter
  // 89: downtown - spay/neuter
  // 90: downtown - surgery
  ['7', '76', '89', '90'].forEach(id => typeIDToNameMap.set(id, 'sx'));

  // ultrasound types ids:
  // 29: ultrasound
  // 91: downtown - ultrasound
  ['29', '91'].forEach(id => typeIDToNameMap.set(id, 'aus'));

  // echocardiogram, just one id, and it's its own category. echo id is 30
  typeIDToNameMap.set('30', 'echo');

  // dental type ids:
  // 28: dental
  // 86: downtown - dental
  // 94: dental - wc friday
  ['28', '86', '94'].forEach(id => typeIDToNameMap.set(id, 'dental'));

  // secondary type ids:
  // 31: acth stim test
  // 32: bile acids test
  // 33: glucose curve
  // 36: sedated procedure
  // 38: LDDST
  // 82: drop off
  // 83: hospitalized patient
  // 88: downtown sedated procedure
  // HOWEVER, WE ARE TREATING SECONDARY PROCEDURES LIKE 'OTHER'
  // const secondaryTypeIDs = ['31', '32', '33', '36', '38', '82', '83', '88'];
  // secondaryTypeIDs.forEach(id => typeIDToNameMap.set(id, 'secondary'))

  // im type ids:
  // 26: IM consult (department set to CH)
  // 27: IM recheck(dept set to CH)
  // 34: IM procedure(dept set to CH)
  // 35: IM tech appt(dept set to ch)
  // however, we are sorting a coloring IM appts based on their resource ID.
  // other words: anything in IM column, despite appt type, is sorted/colorized as IM

  // health certificate appointments, just one id, and it's its own category. health certificate is 81
  typeIDToNameMap.set('81', 'h/c');

  return typeIDToNameMap;
}

function addScheduledProcedures(oneLocationProcedures, location) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);
  const inpatientBox = sheet.getRange(inpatientBoxCoords(location));
  const defaultColor = inpatientDefaultColorMap.get(location);
  clearInpatientBox(inpatientBox, defaultColor);
  const numOfColumnsInBox = inpatientBox.getNumColumns();
  let rowOfInpatientBox = 0;
  for (const procedure of oneLocationProcedures) {
    if (!procedure.animal_id) continue; // skip the empty object
    const rowRange = inpatientBox.offset(rowOfInpatientBox++, 0, 1, numOfColumnsInBox);
    rowRange.setBackground(procedure.color || defaultColor);
    populateInpatientRow(procedure, rowRange);
  }
  return;
};

function clearInpatientBox(inpatientBox, color) {
  inpatientBox
    .clearContent()
    .setBackground(color)
    .setFontColor('black')
    .setFontLine(null);
  return;
};
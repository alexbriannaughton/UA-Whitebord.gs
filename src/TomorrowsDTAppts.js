function getTomorrowsDTAppts() {
  const now = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1); // Move to tomorrow
  const tomorrowStart = Math.floor(tomorrow.setHours(0, 0, 0, 0) / 1000); // midnight tomorrow in seconds
  const tomorrowEnd = Math.floor(tomorrow.setHours(23, 59, 59, 999) / 1000); // end of tomorrow in seconds

  const url = `${proxy}/v1/appointment?active=1&time_range_start=${tomorrowStart}&time_range_end=${tomorrowEnd}&limit=200`;
  const allOfTomorrowsAppts = fetchAndParse(url);

  const dtResourceIDs = new Set(['35', '55', '56', '1015', '1082']); // non procedures dt columns
  const dtAppts = allOfTomorrowsAppts.items.filter(({ appointment }) => {
    return appointment.details.resource_list.some(id => dtResourceIDs.has(id)) // is in a DT column
      && appointment.details.appointment_type_id !== '4'; // not a blocked off spot
  });

  dtAppts.sort((a, b) => a.appointment.start_time - b.appointment.start_time);
  console.log(dtAppts);

  const firstTwoApptsForTesting = dtAppts.slice(0, 2);

  getAllAnimalAndContactData(firstTwoApptsForTesting);

  // const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DT Next Day Checklist');
  // const range = sheet.getRange(`A4:C204`)
  // range.clearContent();

  // for (let i = 0; i < dtAppts.length; i++) {
  //   const { appointment } = dtAppts[i];
  //   const [animalName, animalSpecies, contactLastName] = getAnimalInfoAndLastName(appointment.details.animal_id, appointment.details.contact_id)
  //   const time = convertEpochToSeattleTime(appointment.start_time);
  //   const timeCell = range.offset(i, 0, 1, 1);
  //   const ptCell = range.offset(i, 1, 1, 1);
  //   const reasonCell = range.offset(i, 2, 1, 1);
  //   timeCell.setValue(time);
  //   const patientText = `${animalName} ${contactLastName} (${animalSpecies})`;
  //   const webAddress = `${sitePrefix}/?recordclass=Animal&recordid=${appointment.details.animal_id}`
  //   const link = makeLink(patientText, webAddress);
  //   ptCell.setRichTextValue(link);
  //   reasonCell.setValue(appointment.details.description);
  // }
}

function getAllAnimalAndContactData(dtAppts) {
  let animalRequests = [];
  let contactRequests = [];
  let animalAttachmentRequests = [];
  let allConsultsForAnimalRequests = [];
  let output = {};
  dtAppts.forEach(({ appointment }) => {
    animalRequests.push({
      muteHttpExceptions: true,
      url: `${proxy}/v1/animal/${appointment.details.animal_id}`,
      method: "GET",
      headers: { authorization: token }
    });
    contactRequests.push({
      muteHttpExceptions: true,
      url: `${proxy}/v1/contact/${appointment.details.contact_id}`,
      method: "GET",
      headers: { authorization: token }
    });
    animalAttachmentRequests.push({
      muteHttpExceptions: true,
      url: `${proxy}/v1/attachment?active=1&limit=200&record_type=Animal&record_id=${appointment.details.animal_id}`,
      method: "GET",
      headers: { authorization: token }
    });
    allConsultsForAnimalRequests.push({
      muteHttpExceptions: true,
      url: `${proxy}/v1/consult?active=1&limit=200&animal_id=${appointment.details.animal_id}`,
      method: "GET",
      headers: { authorization: token }
    })
  });

  let animalResponses = UrlFetchApp.fetchAll(animalRequests);
  let contactResponses = UrlFetchApp.fetchAll(contactRequests);
  let animalAttachmentResponses = UrlFetchApp.fetchAll(animalAttachmentRequests);
  let allConsultsForAnimalResponses = UrlFetchApp.fetchAll(allConsultsForAnimalRequests);

  let animalInfo = {};
  let contactInfo = {};
  animalResponses.forEach(response => {
    let animal = JSON.parse(response.getContentText()).items.at(-1).animal;
    animalInfo[animal.id] = { animal };
  });
  contactResponses.forEach(response => {
    let contact = JSON.parse(response.getContentText()).items.at(-1).contact;
    contactInfo[contact.id] = contact;
  });
  animalAttachmentResponses.forEach(response => {
    let attachments = JSON.parse(response.getContentText()).items;
    const animalID = attachments.at(0)?.attachment.record_id;
    if (animalID) animalInfo[animalID].attachments = attachments;
  })
  allConsultsForAnimalResponses.forEach(response => {
    let consults = JSON.parse(response.getContentText()).items;
    const animalID = consults.at(0)?.animal_id;
    const consultIDs = consults.map(({ consult }) => consult.id);
    if (animalID) animalInfo[animalID].consultIDs = consultIDs;
  })

  console.log('animals: ', animalInfo)
  console.log('contacts: ', contactInfo)
}

function convertEpochToSeattleTime(epochString) {
  // Convert the epoch string to a number
  const epoch = parseInt(epochString, 10);

  // Create a Date object using the epoch time
  const date = new Date(epoch * 1000);

  // Calculate the timezone offset for Seattle (PST or PDT)
  // Seattle is UTC-8 in standard time, UTC-7 in daylight saving time
  const seattleOffset = date.getTimezoneOffset() < 480 ? -7 : -8;
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const seattleDate = new Date(utc + (3600000 * seattleOffset));

  // Format the time in 12-hour format
  let hours = seattleDate.getHours();
  const minutes = seattleDate.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // Hour '0' should be '12'
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;

  return hours + ':' + minutesStr + ' ' + ampm;
}
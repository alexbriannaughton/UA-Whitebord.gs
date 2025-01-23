// for manually adding to inpatient column based on changing an appointment to inpatient status in ezyvet
function addInPatient(appointment, uaLocSheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(uaLocSheetName);
  const inpatientBoxRange = sheet.getRange(
    UA_LOC_INPATIENT_COORDS.get(uaLocSheetName)
  );
  const { highestEmptyRow } = findRow(
    inpatientBoxRange,
    appointment.consult_id,
    uaLocSheetName === WC_SHEET_NAME ? 1 : 0
  );
  if (!highestEmptyRow) return;
  highestEmptyRow.setBackground(UA_LOC_INPATIENT_DEFAULT_COLOR.get(uaLocSheetName));
  populateInpatientRow(appointment, highestEmptyRow, uaLocSheetName);
  return;
};

function populateInpatientRow(appointment, highestEmptyRow, uaLocSheetName) {
  const [animalName, animalSpecies, contactLastName] = getAnimalInfoAndLastName(appointment.animal_id, appointment.contact_id);
  const text = `${animalName} ${contactLastName} (${animalSpecies})`;
  const webAddress = `${SITE_PREFIX}/?recordclass=Consult&recordid=${appointment.consult_id}`;
  const link = makeLink(text, webAddress);
  const columnOffset = uaLocSheetName === WC_SHEET_NAME ? 1 : 0;
  highestEmptyRow.offset(0, columnOffset, 1, 4).setRichTextValues([
    [
      link,
      link,
      simpleTextToRichText(''),
      simpleTextToRichText(appointment.description)
    ]
  ]);
  return;
};
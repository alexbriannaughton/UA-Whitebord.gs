// for manually adding to inpatient column based on changing an appointment to inpatient status in ezyvet
function addInPatient(appointment) {
  const location = whichLocation(appointment.resources[0].id);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);
  const inpatientBoxRange = sheet.getRange(
    inpatientBoxCoords(location)
  );
  const rowRange = findEmptyRow(inpatientBoxRange, appointment.consult_id, 0);
  if (!rowRange) return;
  rowRange.setBackground(inpatientDefaultColorMap.get(location));
  populateInpatientRow(appointment, rowRange);
  return;
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
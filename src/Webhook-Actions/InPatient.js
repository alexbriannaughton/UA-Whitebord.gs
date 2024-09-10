// for manually adding to inpatient column based on changing an appointment to inpatient status in ezyvet
function addInPatient(appointment, location) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);
  const inpatientBoxRange = sheet.getRange(
    locationInpatientCoords.get(location)
  );
  const { highestEmptyRow } = findRow(inpatientBoxRange, appointment.consult_id, 0);
  if (!highestEmptyRow) return;
  highestEmptyRow.setBackground(inpatientDefaultColorMap.get(location));
  populateInpatientRow(appointment, highestEmptyRow, location);
  return;
};

function populateInpatientRow(appointment, highestEmptyRow, location) {
  const [animalName, animalSpecies, contactLastName] = getAnimalInfoAndLastName(appointment.animal_id, appointment.contact_id);
  const text = `${animalName} ${contactLastName} (${animalSpecies})`;
  const webAddress = `${sitePrefix}/?recordclass=Consult&recordid=${appointment.consult_id}`;
  const link = makeLink(text, webAddress);
  const columnOffset = location === 'WC' ? 1 : 0;
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
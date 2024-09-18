function addTechAppt(appointment, location) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  const techBoxCoordsMap = new Map([
    // ['CH', 'K6:O21'], // current ch prod
    ['CH', 'K6:N21'],
    // ['DT', 'L3:N11'],
    ['WC', 'K4:N11']
  ]);

  const techBoxCoords = techBoxCoordsMap.get(location);
  const techApptRange = sheet.getRange(techBoxCoords);

  const { highestEmptyRow: rowRange } = findRow(techApptRange, appointment.consult_id, 1);
  if (!rowRange) return;

  const [animalName, animalSpecies] = getAnimalInfo(appointment.animal_id);

  const timeText = convertEpochToUserTimezone(appointment.modified_at);
  const timeRichText = simpleTextToRichText(timeText);

  // populate main cell: name, species, reason... and make it a link
  const text = `${animalName} (${animalSpecies}) - ${appointment.description}`;
  const webAddress = `${sitePrefix}/?recordclass=Consult&recordid=${appointment.consult_id}`;
  const link = makeLink(text, webAddress);

  const richTextVals = [
    [timeRichText, link]
  ];

  rowRange.offset(0, 0, 1, 2).setRichTextValues(richTextVals);

  return;

}
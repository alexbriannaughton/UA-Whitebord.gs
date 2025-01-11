function addTechAppt(appointment, location) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  const techBoxCoordsMap = new Map([
    ['CH', 'K6:O21'],
    // ['DT', 'L3:N11'],
    ['WC', 'K4:N11'],
    ['WCSx', 'G14:I17']
  ]);

  const locKey = appointment.status_id === 44 ? 'WCSx' : location;
  const techBoxCoords = techBoxCoordsMap.get(locKey);
  const techApptRange = sheet.getRange(techBoxCoords);

  const { highestEmptyRow: rowRange } = findRow(techApptRange, appointment.consult_id, 1);
  if (!rowRange) return;

  const [animalName, animalSpecies] = getAnimalInfo(appointment.animal_id);

  const timeText = convertEpochToUserTimezone(appointment.modified_at);
  const timeRichText = simpleTextToRichText(timeText);

  // populate main cell: name, species, reason... and make it a link
  const text = `${animalName} (${animalSpecies}) - ${appointment.description}`;
  const webAddress = `${SITE_PREFIX}/?recordclass=Consult&recordid=${appointment.consult_id}`;
  const link = makeLink(text, webAddress);

  const richTextVals = [
    [timeRichText, link]
  ];

  rowRange.offset(0, 0, 1, 2).setRichTextValues(richTextVals);

  return;

}
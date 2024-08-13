function addTechAppt(appointment, location) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  const techBoxCoordsMap = new Map([
    ['CH', 'K6:O21'],
    // ['DT', 'L3:N11'],
    ['WC', 'K4:M13']
    // we are intentionally leaving out the 'in ezyvet' checkbox column bc we dont care if it's true or false to add a patient here
  ]);
  const techBoxCoords = techBoxCoordsMap.get(location);
  const techApptRange = sheet.getRange(techBoxCoords);

  const { highestEmptyRow: rowRange } = findRow(techApptRange, appointment.consult_id, 1);
  if (!rowRange) return;

  const [animalName, animalSpecies] = getAnimalInfo(appointment.animal_id);

  // const mainCell = rowRange.offset(0, 1, 1, 1);


  const timeText = convertEpochToUserTimezone(appointment.modified_at);
  const timeRichText = simpleTextToRichText(timeText);

  // populate main cell: name, species, reason... and make it a link
  const text = `${animalName} (${animalSpecies}) - ${appointment.description}`;
  const webAddress = `${sitePrefix}/?recordclass=Consult&recordid=${appointment.consult_id}`;
  const link = makeLink(text, webAddress);
  // mainCell.setRichTextValue(link);

  // find column to left of mainCell and add time
  // mainCell.offset(0, -1, 1, 1).setValue(
  //   convertEpochToUserTimezone(appointment.modified_at)
  // );

  // check the ezyVet checkbox
  // const checkboxCell = rowRange.offset(0, rowRange.getNumColumns(), 1, 1);
  // checkboxCell.setDataValidation(createCheckbox()).setValue(true);
  let richTextVals;
  if (location === 'CH') {
    richTextVals = [
      [
        timeRichText,
        link,
        link,
        link
      ]
    ]
  }

  else if (location === 'WC') {
    richTextVals = [
      [
        timeRichText,
        link,
        simpleTextToRichText(''),
        simpleTextToRichText('TRUE')
      ]
    ]
  }

  if (!richTextVals) {
    throw new Error(`No rich text vals at end of addTechAppt(): ${appointment}`);
  }
  
  rowRange.offset(0, 0, 1, 4).setRichTextValues(richTextVals);

  return;

}
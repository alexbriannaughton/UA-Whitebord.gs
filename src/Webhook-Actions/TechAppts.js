function addTechAppt(appointment, uaLocSheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(uaLocSheetName);
  // const wcSxName = WC_SHEET_NAME + 'Sx';

  const techBoxCoordsMap = new Map([
    [CH_SHEET_NAME, 'K6:O21'],
    // ['DT', 'L3:N11'],
    [WC_SHEET_NAME, 'K4:N11'],
    // [wcSxName, 'G14:I17']
  ]);

  // const locKey = appointment.status_id === 44 ? wcSxName : uaLocSheetName;
  const techBoxCoords = techBoxCoordsMap.get(uaLocSheetName);
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

  const apptTypeCategory = TYPE_ID_TO_CATEGORY.get(appointment.type_id);

  let bgColor = apptTypeCategory?.color ?? STANDARD_GREY;
  const isWC = uaLocSheetName === WC_SHEET_NAME;
  const isWorkInTech = apptTypeCategory === WORK_IN_TECH_APPT_CATEGORY;
  if (isWC && isWorkInTech) bgColor = STANDARD_GREY;
  const isCH = uaLocSheetName === CH_SHEET_NAME;
  const isTNTAGE = appointment.type_id === EZYVET_AGE_TNT_APPT_TYPE_ID;
  if (isCH && isTNTAGE) bgColor = '#ffd966'; // light yellow 1

  rowRange.setBackground(bgColor);

  return;
}
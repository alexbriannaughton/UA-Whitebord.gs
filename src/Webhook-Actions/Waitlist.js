function getWaitlistRowRange(appointment, uaLocSheetName) {
  const waitlistRange = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(`${uaLocSheetName} Wait List`)
    .getRange(`B7:K75`);
  // only checking up through row 75 on the waitlists
  // meaning only up to 69 pets can currently be on the waitlist (it never gets that high currently)

  return findRow(waitlistRange, appointment.consult_id, 1);
}

function addToWaitlist(appointment, uaLocSheetName) {
  const { highestEmptyRow: rowRange } = getWaitlistRowRange(appointment, uaLocSheetName);
  if (!rowRange) return;

  rowRange.setBackground(STANDARD_GREY);
  rowRange.setBorder(true, true, true, true, true, true);

  const [animalName, animalSpecies, contactLastName] = getAnimalInfoAndLastName(appointment.animal_id, appointment.contact_id);

  const timeCellText = convertEpochToUserTimezone(appointment.updated_at);
  const timeCellRichText = simpleTextToRichText(timeCellText);

  const patientText = `${animalName} ${contactLastName}`;
  const webAddress = `${SITE_PREFIX}/?recordclass=Consult&recordid=${appointment.consult_id}`;
  const link = makeLink(patientText, webAddress);

  const speciesCellRichText = animalSpecies ? simpleTextToRichText(animalSpecies) : null;

  const reasonCellRichText = simpleTextToRichText(appointment.description);

  const ezyVetCellRichText = simpleTextToRichText('TRUE');

  const emptyRichText = simpleTextToRichText('');

  rowRange.offset(0, 1, 1, 2).merge(); // patient cell
  rowRange.offset(0, 7, 1, 2).merge(); // reason cell

  const richTextValues = [
    [
      timeCellRichText,
      link,
      link,
      speciesCellRichText,
      emptyRichText,
      emptyRichText,
      emptyRichText,
      reasonCellRichText,
      reasonCellRichText,
      ezyVetCellRichText
    ]
  ];

  // Apply rich text values
  rowRange.setRichTextValues(richTextValues);

  return;

}

function handleInactiveApptOnWaitlist(appointment, uaLocSheetName) {
  const { existingRow } = getWaitlistRowRange(appointment, uaLocSheetName);
  if (!existingRow) return;

  const notesCell = existingRow.offset(0, 4, 1, 1);

  const curNotesVal = notesCell.getValue();

  const newNotePreText = 'This appointment was deleted in ezyVet at';
  if (curNotesVal.includes(newNotePreText)) return;

  const timeString = convertEpochToUserTimezone(appointment.modified_at);

  const { cancellation_reason, cancellation_reason_text } = appointment;
  const cancelText = cancellation_reason_text ?? GET_CANCELLATION_REASON(cancellation_reason) ?? '';

  const incomingText = `[${newNotePreText} ${timeString}. "${cancelText}"]`;
  const newNotesCellVal = curNotesVal
    ? `${curNotesVal}\n${incomingText}`
    : incomingText;

  notesCell.setValue(newNotesCellVal);
  notesCell.setBackground('red');

  return;
}

function addTextedTimestampOnWaitlist(appointment, location) {
  const { existingRow } = getWaitlistRowRange(appointment, location);
  if (!existingRow) return;

  const notesCell = existingRow.offset(0, 4, 1, 1);

  const curNotesVal = notesCell.getValue();

  const newNotePreText = 'Texted @';
  if (curNotesVal.includes(newNotePreText)) return;

  const timeString = convertEpochToUserTimezone(appointment.modified_at);

  const newText = `[${newNotePreText} ${timeString}]`;
  const newNotesCellVal = curNotesVal
    ? `${curNotesVal}\n${newText}`
    : newText;

  const bgColor = UA_LOC_TEXTED_COLOR.get(location);

  notesCell.setValue(newNotesCellVal)
  notesCell.setBackground(bgColor);
}
function getWaitlistRowRange(appointment, location) {
  const waitlistRange = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(`${location} Wait List`)
    .getRange(`B7:K75`);
  // only checking up through row 75 on the waitlists
  // meaning only up to 69 pets can currently be on the waitlist (it never gets that high currently)

  return findRow(waitlistRange, appointment.consult_id, 1);
}

function addToWaitlist(appointment, location) {
  const { highestEmptyRow: rowRange } = getWaitlistRowRange(appointment, location);
  if (!rowRange) return;

  rowRange.setBackground('#f3f3f3');
  rowRange.setBorder(true, true, true, true, true, true);

  const [animalName, animalSpecies, contactLastName] = getAnimalInfoAndLastName(appointment.animal_id, appointment.contact_id);

  const timeCellText = convertEpochToUserTimezone(appointment.created_at);
  const timeCellRichText = simpleTextToRichText(timeCellText);

  const patientText = `${animalName} ${contactLastName}`;
  const webAddress = `${sitePrefix}/?recordclass=Consult&recordid=${appointment.consult_id}`;
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

function handleInactiveApptOnWaitlist(appointment, location) {
  const { existingRow } = getWaitlistRowRange(appointment, location);
  if (!existingRow) return;

  const notesCell = existingRow.offset(0, 4, 1, 1);

  const curNotesVal = notesCell.getValue();

  const newNotePreText = 'This appointment was deleted in ezyVet at';
  if (curNotesVal.includes(newNotePreText)) return;

  const timeString = convertEpochToUserTimezone(appointment.modified_at);

  const { cancellation_reason, cancellation_reason_text } = appointment;
  const cancelText = cancellation_reason_text ?? getCancellationReason(cancellation_reason) ?? '';

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

  const bgColor = locationTextedColorMap.get(location);

  notesCell.setValue(newNotesCellVal)
  notesCell.setBackground(bgColor);
}
function addToWaitlist(appointment) {
  const { highestEmptyRow: rowRange } = getWaitlistRowRange(appointment);
  if (!rowRange) return;

  rowRange.setBackground('#f3f3f3');
  rowRange.setBorder(true, true, true, true, true, true);

  const [animalName, animalSpecies, contactLastName] = getAnimalInfoAndLastName(appointment.animal_id, appointment.contact_id);

  const timeCellText = convertEpochToUserTimezone(appointment.created_at);
  const timeCellRichText = simpleTextToRichText(timeCellText);

  const patientText = `${animalName} ${contactLastName}`;
  const webAddress = `${sitePrefix}/?recordclass=Consult&recordid=${appointment.consult_id}`
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

function getWaitlistRowRange(appointment) {
  // grab correct location's waitlist sheet
  const sheetName = `${whichLocation(appointment.resources[0].id)} Wait List`;

  // downtown doesnt have a waitlist anymore
  if (sheetName === 'DT Wait List') return;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  const waitlistRange = sheet.getRange(`B7:K75`);
  // only checking up through row 75 on the waitlist
  // meaning only up to 69 pets can currently be on the waitlist (it never gets that high currently)

  return findRow(waitlistRange, appointment.consult_id, 1);
}

function handleInactiveApptOnWaitlist(appointment) {
  const { existingRow } = getWaitlistRowRange(appointment);
  if (!existingRow) return;

  const notesCell = existingRow.offset(0, 4, 1, 1);

  const { modified_at, cancellation_reason, cancellation_reason_text } = appointment;

  const timeString = convertEpochToUserTimezone(modified_at);

  let cancelText = '';
  const cancelReason1 = getCancellationReason(cancellation_reason);
  if (cancelReason1 && cancellation_reason_text) {
    cancelText = `${cancelReason1}: ${cancellation_reason_text}`;
  }
  else if (cancelReason1) cancelText = cancelReason1;
  else if (cancellation_reason_text) cancelText = cancellation_reason_text;

  const curNotesVal = notesCell.getValue();
  const newNotesCellVal = `${curNotesVal}\nThis appointment was deleted in ezyVet at ${timeString}. "${cancelText}"`;

  notesCell.setValue(newNotesCellVal);
  notesCell.setBackground('yellow');

  return;
}
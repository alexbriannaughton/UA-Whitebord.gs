function handleReadyStatus(appointment, location) {
  const readyCell = findTargetCell(
    location,
    sheet,
    appointment,
    3 // number of rows down that the ready cell is from the patient cell
  );

  if (readyCell?.isBlank()) {
    const time = convertEpochToUserTimezone(appointment.modified_at);
    const text = `ready@ ${time}`;
    readyCell.setValue(text);
  }

  return;

};
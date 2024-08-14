function okToCheckOut(appointment, location) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  const okCheckbox = findTargetCell(
    location,
    sheet,
    appointment,
    5 // number of rows down that the 'ok to check out' cell is from the patient cell
  );

  if (!okCheckbox) return;

  okCheckbox.setDataValidation(createCheckbox()).setValue(true);

  return;

};
function handleTomorrowDTAppointment(appointment) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DT');
    const range = sheet.getRange(dtNextDayApptsCoords);
    const { highestEmptyRow, existingRow } = findRow(range, appointment.animal_id, 1);
    if (!highestEmptyRow && !existingRow) {
        console.error('COULD FIND A ROW TO POPULATE FOR DT TOMORROW HANDLER');
    }

    if (!existingRow) return;

    if (!appointment.active && existingRow) {
        // cross the row out
        existingRow.setFontLine('line-through');
        return;
    }

    const rowRange = existingRow ? existingRow : highestEmptyRow;

    const apptStartTime = convertEpochToUserTimezone(appointment.start_at);
    const timeCell = rowRange.offset(0, 0, 1, 1);
    const timeCellValBeforeUpdating = timeCell.getValue();
    timeCell.setValue(apptStartTime);

    const hasDepositPaidStatus = appointment.status_id === 37;
    const depositPaidCell = rowRange.offset(0, 2, 1, 1);
    const depositCellBeforeUpdating = depositPaidCell.getValue();
    const depositPaidCellValue = depositCellBeforeUpdating || hasDepositPaidStatus || 'FALSE';
    depositPaidCell.setValue(depositPaidCellValue);

    const needToResort = timeCellValBeforeUpdating !== apptStartTime;
    if (needToResort) {
        resortTheAppts(range);
    }

    return;

}

function resortTheAppts(range) {
    const richTextVals = range.getRichTextValues();
    const vals = range.getValues();
    console.log('VALS')
    console.log(vals);
    const combinedVals = vals.map((val, i) => {
        return {
            plainValue: val,
            richTextValue: richTextVals[i]
        };
    });
    combinedVals.sort((a, b) => {
        const aN = a.plainValue[0][0]
        const bN = b.plainValue[0][0]
        return Number(aN) - Number(bN);
    });
    const sortedRichText = combinedVals.map(val => val.richTextValue);
    range.setRichTextValues(sortedRichText);
}
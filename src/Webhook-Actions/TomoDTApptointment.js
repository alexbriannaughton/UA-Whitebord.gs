function handleTomorrowDTAppointment(appointment) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DT');
    const range = sheet.getRange(dtNextDayApptsCoords);
    const { highestEmptyRow, existingRow } = findRow(range, appointment.animal_id, 1);
    if (!highestEmptyRow && !existingRow) {
        console.error('COULD FIND A ROW TO POPULATE FOR DT TOMORROW HANDLER');
    }

    if (!appointment.active && existingRow) {
        // cross the row out
        existingRow.setFontLine('line-through');
        return;
    }

    const rowRange = existingRow ? existingRow : highestEmptyRow;

    const apptStartTime = convertEpochToUserTimezone2(appointment.start_at);
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
    if (!range) {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DT');
        range = sheet.getRange(dtNextDayApptsCoords);
    }
    const richTextVals = range.getRichTextValues();
    const vals = range.getValues();

    let numOfAppts;
    for (let i = 0; i < vals.length; i++) {
        if (vals[i][0] === '') {
            numOfAppts = i;
            break;
        }
    }
    if (!numOfAppts) return;

    const apptRichTexts = richTextVals.slice(0, numOfAppts);
    const apptVals = vals.slice(0, numOfAppts);
    console.log(apptVals)

    const combinedVals = apptVals.map((apptVal, i) => {
        return {
            plainValue: apptVal,
            richTextValue: apptRichTexts[i]
        };
    });
    combinedVals.sort((a, b) => {
        const aSortVal = parseTimeForSort(a.plainValue[0]);
        const bSortVal = parseTimeForSort(b.plainValue[0]);
        return aSortVal - bSortVal;
    });

    const sortedRichText = combinedVals.map(val => val.richTextValue);
    range.offset(0, numOfAppts).setRichTextValues(sortedRichText);
}

function parseTimeForSort(timeStr) {
    const [time, period] = timeStr.split(/([AP]M)/);
    const [hours, minutes] = time.split(':').map(Number);
    const offset = period === 'PM' && hours !== 12 ? 12 : 0;
    return (hours % 12 + offset) * 60 + minutes; // Convert to minutes since start of day
}
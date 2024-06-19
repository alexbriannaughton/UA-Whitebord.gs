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
    const rowVals = rowRange.getValues();

    const apptStartTime = convertEpochToUserTimezone2(appointment.start_at);
    // const timeCell = rowRange.offset(0, 0, 1, 1);
    const timeCellValBeforeUpdating = rowVals[0][0];
    // timeCell.setValue(apptStartTime);

    const ptCell = rowRange.offset(0, 1, 1, 1);
    if (!existingRow && highestEmptyRow) {
        handleAddNewNames(appointment, ptCell);
    }

    const hasDepositPaidStatus = appointment.status_id === 37;
    // const depositPaidCell = rowRange.offset(0, 2, 1, 1);
    const depositCellBeforeUpdating = rowVals[0][2];
    const depositPaidCellValue = depositCellBeforeUpdating.startsWith('y') || hasDepositPaidStatus ? 'yes' : 'no';
    // depositPaidCell.setValue(depositPaidCellValue);

    const reasonCellValue = removeVetstoriaDescriptionText(appointment.description);

    const rangeToSetVals = rowRange.offset(0, 0, 1, 4);
    console.log('type for apptStartTime: ', typeof apptStartTime);
    console.log('type for depositPaidCellValue: ', typeof depositPaidCellValue);
    console.log('type for reasonCellValue: ', typeof reasonCellValue);

    rangeToSetVals.setValues([
        [apptStartTime, null, depositPaidCellValue, reasonCellValue]
    ]);


    const needToResort = timeCellValBeforeUpdating !== apptStartTime;
    if (needToResort) {
        resortTheAppts(range);
    }

    return;

}

function handleAddNewNames(appointment, ptCell) {
    const [animalName, animalSpecies, contactLastName] = getAnimalInfoAndLastName(appointment.animal_id, appointment.contact_id);
    const text = `${animalName} ${contactLastName} (${animalSpecies})`
    const link = makeLink(text, `${sitePrefix}/?recordclass=Animal&recordid=${appointment.animal_id}`);
    ptCell.setRichTextValue(link);
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

    const combinedVals = apptVals.map((apptVal, i) => {
        const sameFamTime = apptVal[0] === sameFamString
            ? apptVals[i - 1][0]
            : null;
        return {
            plainValue: apptVal,
            richTextValue: apptRichTexts[i],
            sameFamTime
        };
    });
    combinedVals.sort((a, b) => {
        const aSortVal = parseTimeForSort(
            a.sameFamTime || a.plainValue[0]
        );
        const bSortVal = parseTimeForSort(
            b.sameFamTime || b.plainValue[0]
        );
        return aSortVal - bSortVal;
    });

    const sortedRichText = combinedVals.map(val => val.richTextValue);
    range.offset(0, 0, numOfAppts).setRichTextValues(sortedRichText);
    const sortedVals = combinedVals.map(val => val.plainValue);
    const sortedDepositVals = sortedVals.map(val => [val[2]]);
    range.offset(0, 2, numOfAppts, 1).setValues(sortedDepositVals);
}

function parseTimeForSort(timeStr) {
    const [time, period] = timeStr.split(/([AP]M)/);
    const [hours, minutes] = time.split(':').map(Number);

    let offset = 0;
    if (period === 'AM' && hours === 12) offset = -12;
    else if (period === 'PM' && hours !== 12) offset = 12;

    return (hours + offset) * 60 + minutes;
}
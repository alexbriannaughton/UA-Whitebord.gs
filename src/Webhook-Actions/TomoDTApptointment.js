function handleTomorrowDTAppointment(appointment) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DT');
    const range = sheet.getRange(dtNextDayApptsCoords);
    const { highestEmptyRow, existingRow } = findRow(range, appointment.animal_id, 1);
    if (!highestEmptyRow && !existingRow) {
        console.error('COULD FIND A ROW TO POPULATE FOR DT TOMORROW HANDLER');
    }

    if (existingRow) {
        if (!appointment.active) {
            existingRow.setFontLine('line-through');
            return;
        }
        existingRow.setFontLine('none');
    }

    const rowRange = existingRow ? existingRow : highestEmptyRow;
    const existingRowRichText = rowRange.getRichTextValues();

    const incomingTimeString = convertEpochToUserTimezone2(appointment.start_at);
    let timeCellString = incomingTimeString;
    const timeCellValBeforeUpdating = existingRowRichText[0][0].getText();
    if (timeCellValBeforeUpdating === sameFamString) {
        // get the value of the time were pointing to
        let foundCoorespondingTimeCellVal;
        let rowOffset = -1;
        while (!foundCoorespondingTimeCellVal) {
            const rowRangeAbove = rowRange.offset(rowOffset, 0);
            const timeCellVal = rowRangeAbove.getValue();
            console.log('time cell val in while loop: ', timeCellVal)
            if (timeCellVal !== sameFamString) {
                foundCoorespondingTimeCellVal = timeCellVal;
                break;
            }
            rowOffset--;
        }
        if (!foundCoorespondingTimeCellVal) {
            throw new Error(`unable to find corresponding time cell val at handleTomorrowDTAppointment(): ${appointment}`);
        }
        // if the value is within 2 hours of the incoming value, keep the time cell val to have sameFamString
        const foundTimeInMins = getTimeInMinutes(foundCoorespondingTimeCellVal, appointment);
        const incomingTimeInMins = getTimeInMinutes(incomingTimeString, appointment);
        const timeDifference = Math.abs(foundTimeInMins - incomingTimeInMins);
        if (timeDifference <= 120) {
            timeCellString = sameFamString;
        }
    }
    const apptTimeRichText = simpleTextToRichText(timeCellString);

    let ptCellRichText;
    if (!existingRow && highestEmptyRow) {
        ptCellRichText = handleAddNewNames(appointment);
    }
    else if (existingRow) {
        ptCellRichText = existingRowRichText[0][1];
    }
    else if (!ptCellRichText) {
        throw new Error('couldnt make rich text value for incoming patient name');
    }

    const hasDepositPaidStatus = appointment.status_id === 37;
    const depositCellBeforeUpdating = existingRowRichText[0][2].getText();
    const depositPaidText = depositCellBeforeUpdating === 'yes' || hasDepositPaidStatus
        ? 'yes'
        : 'no';
    const depositPaidRichtext = simpleTextToRichText(depositPaidText);

    const reasonCellText = removeVetstoriaDescriptionText(appointment.description);
    const reasonCellRichText = simpleTextToRichText(reasonCellText);

    const rangeToSetVals = rowRange.offset(0, 0, 1, 4);
    rangeToSetVals.setRichTextValues([
        [apptTimeRichText, ptCellRichText, depositPaidRichtext, reasonCellRichText]
    ]);

    const needToResort = timeCellValBeforeUpdating !== timeCellString;
    if (needToResort) {
        resortTheAppts(range);
    }

    return;

}

function handleAddNewNames(appointment) {
    const [animalName, animalSpecies, contactLastName] = getAnimalInfoAndLastName(appointment.animal_id, appointment.contact_id);
    const text = `${animalName} ${contactLastName} (${animalSpecies})`
    const link = makeLink(text, `${sitePrefix}/?recordclass=Animal&recordid=${appointment.animal_id}`);
    return link;
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
            ? getFirstSameFamTime(apptVals, i)
            : null;
        return {
            plainValue: apptVal,
            richTextValue: apptRichTexts[i],
            sameFamTime
        };
    });
    combinedVals.sort((a, b) => {
        const aSortVal = getTimeInMinutes(
            a.sameFamTime || a.plainValue[0],
            
        );
        const bSortVal = getTimeInMinutes(
            b.sameFamTime || b.plainValue[0]
        );
        return aSortVal - bSortVal;
    });

    const sortedRichText = combinedVals.map(val => val.richTextValue);
    range.offset(0, 0, numOfAppts).setRichTextValues(sortedRichText);
    // const sortedVals = combinedVals.map(val => val.plainValue);
    // const sortedDepositVals = sortedVals.map(val => [val[2]]);
    // range.offset(0, 2, numOfAppts, 1).setValues(sortedDepositVals);
}

function getTimeInMinutes(timeStr, appointment = undefined) {
    console.log('at getTimeInMinutes: ')
    console.log('timeStr: ', timeStr)
    console.log('appointment: ', appointment)
    const [time, period] = timeStr.split(/([AP]M)/);
    const [hours, minutes] = time.split(':').map(Number);

    let offset = 0;
    if (period === 'AM' && hours === 12) offset = -12;
    else if (period === 'PM' && hours !== 12) offset = 12;

    return (hours + offset) * 60 + minutes;
}

function getFirstSameFamTime(apptVals, i) {
    let j = i - 1;
    while (j >= 0) {
        const timeVal = apptVals[j][0];
        if (timeVal !== sameFamString) {
            return timeVal;
        }
        j--;
    }
}
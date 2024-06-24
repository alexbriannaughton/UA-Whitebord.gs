function handleNextDayDtAppt(appointment) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DT');
    const range = sheet.getRange(dtNextDayApptsCoords);
    const { highestEmptyRow, existingRow } = findRow(range, appointment.animal_id, 1);
    if (!highestEmptyRow && !existingRow) {
        throw new Error('COULD NOT FIND A ROW TO POPULATE FOR NEXT DAY DT APPT HANDLER', appointment);
    }

    if (!appointment.active) {
        if (existingRow) existingRow.setFontLine('line-through');
        return;
    }

    const rowRange = existingRow ? existingRow : highestEmptyRow;
    rowRange.setFontLine('none').setBorder(true, true, true, true, true, true);
    const existingRowRichText = rowRange.getRichTextValues();

    const incomingTimeValue = new Date(appointment.start_at * 1000);
    let timeCellString = incomingTimeValue;
    const timeCellValBeforeUpdating = existingRowRichText[0][0].getText();
    if (timeCellValBeforeUpdating === sameFamString) {
        // get the value of the time were pointing to
        let foundCoorespondingTimeCellVal;
        let rowOffset = -1;
        while (!foundCoorespondingTimeCellVal || rowOffset < -10) {
            const rowRangeAbove = rowRange.offset(rowOffset, 0);
            const timeCellVal = rowRangeAbove.getValue(); // note api call within a loop, not ideal
            if (timeCellVal !== sameFamString) {
                foundCoorespondingTimeCellVal = timeCellVal;
                break;
            }
            rowOffset--;
        }
        if (!foundCoorespondingTimeCellVal) {
            throw new Error(`unable to find corresponding time cell val at handleNextDayDtAppts(): ${appointment}`);
        }
        // if the value is within 2 hours of the incoming value, keep the time cell val to have sameFamString
        const timeDifferenceMs = Math.abs(incomingTimeValue - foundCoorespondingTimeCellVal);
        const timeDifferenceHours = timeDifferenceMs / (1000 * 60 * 60);
        if (timeDifferenceHours <= 1) {
            timeCellString = sameFamString;
        }
    }

    let ptCellRichText;
    if (highestEmptyRow) {
        ptCellRichText = fetchForDataAndMakeLink(appointment);
    }
    else if (existingRow) {
        ptCellRichText = existingRowRichText[0][1];
    }
    else if (!ptCellRichText) {
        throw new Error('couldnt make rich text value for incoming patient name');
    }

    const hasDepositPaidStatus = appointment.status_id === 37;
    const depositCellBeforeUpdating = existingRowRichText[0][2].getText();
    const depositPaidText = depositCellBeforeUpdating?.includes('yes') || hasDepositPaidStatus
        ? 'yes'
        : 'no';

    const depositPaidRichtext = simpleTextToRichText(depositPaidText);

    const reasonCellText = removeVetstoriaDescriptionText(appointment.description);
    const reasonCellRichText = simpleTextToRichText(reasonCellText);

    rowRange.offset(0, 1, 1, 3).setRichTextValues([
        [ptCellRichText, depositPaidRichtext, reasonCellRichText]
    ]);

    if (highestEmptyRow) {
        console.log('hit block where supposed to set last visit val')
        rowRange.offset(0, 4, 1, 1).setValue('will have to manually check chart for this data >>>');
    }

    rowRange.offset(0, 0, 1, 1).setValue(timeCellString);

    resortDtAppts(range);

    return;

}

function fetchForDataAndMakeLink(appointment) {
    const [animalName, animalSpecies, contactLastName] = getAnimalInfoAndLastName(appointment.animal_id, appointment.contact_id);
    const text = `${animalName} ${contactLastName} (${animalSpecies})`;
    const link = makeLink(text, `${sitePrefix}/?recordclass=Animal&recordid=${appointment.animal_id}`);
    return link;
}

function resortDtAppts(
    range = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DT').getRange(dtNextDayApptsCoords)
) {
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
            sameFamTime,
            lastName: apptVal[1].split(' ').at(-2)
        };
    });

    combinedVals.sort((a, b) => {
        const aSortVal = a.sameFamTime || a.plainValue[0];
        const bSortVal = b.sameFamTime || b.plainValue[0];
        return aSortVal - bSortVal;
    });

    // below there are two for loops which are two versions that try to handle
    // incoming appointments that should have same family flags in their time cell
    // the first version only flags if the two appointements are already back to back in the combinedVals array
    // the second version tries to handle this and resort the array if there are two appts within same family within two hours of each other
    // but i have not completed the second versin
    // version 1:
    for (let i = 0; i < combinedVals.length - 1; i++) {
        const {
            lastName: curApptLastName,
            plainValue: curApptPlainValues,
            richTextValue: curApptRichTextValues
        } = combinedVals[i];

        const curApptDate = curApptPlainValues[0];

        if (curApptDate === sameFamString) continue;

        const {
            lastName: nextApptLastName,
            plainValue: nextApptPlainValues,
            richTextValue: nextApptRichTextValues
        } = combinedVals[i + 1];

        const nextApptDate = nextApptPlainValues[0];

        if (nextApptDate === sameFamString) continue;

        if (curApptLastName === nextApptLastName) {
            const curPtNameCellRuns = curApptRichTextValues[1].getRuns();
            const curAnimalLink = getLinkFromRuns(curPtNameCellRuns);
            const curApptAnimalID = curAnimalLink?.split('=').at(-1);
            if (!curApptAnimalID) continue;

            const nextPtNameCellRuns = nextApptRichTextValues[1].getRuns();
            const nextAnimalLink = getLinkFromRuns(nextPtNameCellRuns);
            const nextApptAnimalID = nextAnimalLink?.split('=').at(-1);
            if (!nextApptAnimalID) continue;

            const [curAnimalContactID, nextAnimalContactID] = getTwoAnimalContactIDsAsync(curApptAnimalID, nextApptAnimalID);

            if (curAnimalContactID === nextAnimalContactID) {
                combinedVals[i + 1].plainValue[0] = sameFamString;
            }
        }
    }

    // version 2:
    // for (let i = 0; i < combinedVals.length - 1; i++) {
    //     const {
    //         lastName: curApptLastName,
    //         plainValue: curApptPlainValues,
    //         richTextValue: curApptRichTextValues
    //     } = combinedVals[i];

    //     const curApptDate = curApptPlainValues[0];

    //     if (curApptDate === sameFamString) continue;

    //     for (let j = i + 1; j < combinedVals.length; j++) {
    //         const {
    //             lastName: nextApptLastName,
    //             plainValue: nextApptPlainValues,
    //             richTextValue: nextApptRichTextValues
    //         } = combinedVals[j];

    //         const nextApptDate = nextApptPlainValues[0];

    //         if (nextApptDate === sameFamString) continue;

    //         const diff = Math.abs(nextApptDate - curApptDate);

    //         if (diff > 60 * 60 * 1000) break;

    //         if (curApptLastName === nextApptLastName) {
    //             const curPtNameCellRuns = curApptRichTextValues[1].getRuns();
    //             const curAnimalLink = getLinkFromRuns(curPtNameCellRuns);
    //             const curApptAnimalID = curAnimalLink?.split('=').at(-1);
    //             if (!curApptAnimalID) continue;

    //             const nextPtNameCellRuns = nextApptRichTextValues[1].getRuns();
    //             const nextAnimalLink = getLinkFromRuns(nextPtNameCellRuns);
    //             const nextApptAnimalID = nextAnimalLink?.split('=').at(-1);
    //             if (!nextApptAnimalID) continue;

    //             const [curAnimalContactID, nextAnimalContactID] = getTwoAnimalContactIDsAsync(curApptAnimalID, nextApptAnimalID);

    //             if (curAnimalContactID === nextAnimalContactID) {
    //                 // ensure that they are next to each other in the array and set nextPlainValue[0] = sameFamString
    //                 // 
    //             }
    //         }
    //     }
    // }

    const sortedRichText = combinedVals.map(val => val.richTextValue);
    range.offset(0, 0, numOfAppts).setRichTextValues(sortedRichText);

    const sortedDateVals = combinedVals.map(val => [val.plainValue[0]]);
    range.offset(0, 0, numOfAppts, 1).setValues(sortedDateVals);

    range.offset(0, 0, range.getNumRows(), 1).setNumberFormat('h:mma/p');
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
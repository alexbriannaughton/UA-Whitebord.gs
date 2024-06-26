function handleNextDayDtAppt(appointment) {
    if (!dtResourceIDs.has(appointment.resources[0].id)) return;
    if (!dtDVMApptTypeIDs.has(appointment.type_id)) return;

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DT');
    const range = sheet.getRange(dtNextDayApptsCoords);
    const { highestEmptyRow, existingRow } = findRow(range, appointment.animal_id, 1);

    if (!highestEmptyRow && !existingRow) {
        throw new Error('COULD NOT FIND A ROW TO POPULATE FOR NEXT DAY DT APPT HANDLER', appointment);
    }

    if (!appointment.active) return handleDeleteRow(existingRow, range);

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
        // if the value is within 1 hour of the incoming value, keep the time cell val to have sameFamString
        const timeDifferenceMs = Math.abs(incomingTimeValue - foundCoorespondingTimeCellVal);
        const timeDifferenceHours = timeDifferenceMs / (1000 * 60 * 60);
        if (timeDifferenceHours <= 1) {
            timeCellString = sameFamString;
        }
    }

    let ptCellRichText;
    let fractiousCellRichText;
    if (highestEmptyRow) {
        const { link, isHostile } = fetchForDataAndMakeLink(appointment);
        ptCellRichText = link;
        const fractiousCellText = isHostile ? 'yes' : 'no';
        fractiousCellRichText = simpleTextToRichText(fractiousCellText);

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

    if (existingRow) {
        rowRange.offset(0, 1, 1, 3).setRichTextValues([
            [ptCellRichText, depositPaidRichtext, reasonCellRichText]
        ]);
    }

    if (highestEmptyRow) {
        const checkChartRichText = simpleTextToRichText('see pt chart');
        rowRange.offset(0, 1, 1, 7).setRichTextValues([
            [ptCellRichText, depositPaidRichtext, reasonCellRichText, checkChartRichText, checkChartRichText, fractiousCellRichText, checkChartRichText]
        ]);
    }

    rowRange.offset(0, 0, 1, 1).setValue(timeCellString);

    resortDtAppts(range);

    return;

}

function fetchForDataAndMakeLink(appointment) {
    const [
        animalName,
        animalSpecies,
        contactLastName,
        isHostile
    ] = getAnimalInfoAndLastName(appointment.animal_id, appointment.contact_id);
    const text = `${animalName} ${contactLastName} (${animalSpecies || unknownSpeciesString})`;
    const link = makeLink(text, `${sitePrefix}/?recordclass=Animal&recordid=${appointment.animal_id}`);
    return { link, isHostile };
}

function resortDtAppts(
    range = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DT').getRange(dtNextDayApptsCoords)
) {
    const vals = range.getValues();
    const numOfAppts = getNumOfApptRows(vals);
    const richTextVals = range.getRichTextValues();

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
    // for (let i = 0; i < combinedVals.length - 1; i++) {
    //     const {
    //         lastName: curApptLastName,
    //         plainValue: curApptPlainValues,
    //         richTextValue: curApptRichTextValues
    //     } = combinedVals[i];

    //     const curApptDate = curApptPlainValues[0];

    //     if (curApptDate === sameFamString) continue;

    //     let j = i + 1;
    //     while (j < combinedVals.length) {
    //         const {
    //             lastName: nextApptLastName,
    //             plainValue: nextApptPlainValues,
    //             richTextValue: nextApptRichTextValues
    //         } = combinedVals[j];

    //         const nextApptDate = nextApptPlainValues[0];

    //         if (nextApptDate === sameFamString) {
    //             j++;
    //             continue;
    //         }

    //         if (curApptLastName !== nextApptLastName) break;

    //         const curApptAnimalID = getAnimaIdFromCellRichText(curApptRichTextValues[1])
    //         if (!curApptAnimalID) break;

    //         const nextApptAnimalID = getAnimaIdFromCellRichText(nextApptRichTextValues[1]);
    //         if (!nextApptAnimalID) break;

    //         const [curAnimalContactID, nextAnimalContactID] = getTwoAnimalContactIDsAsync(curApptAnimalID, nextApptAnimalID);

    //         if (curAnimalContactID === nextAnimalContactID) {
    //             combinedVals[j].plainValue[0] = sameFamString;
    //         }

    //     }

    // }

    // version 2:
    for (let i = 0; i < combinedVals.length - 1; i++) {
        const {
            lastName: curApptLastName,
            plainValue: curApptPlainValues,
            richTextValue: curApptRichTextValues
        } = combinedVals[i];

        const curApptDate = curApptPlainValues[0];

        if (curApptDate === sameFamString) continue;

        let sameFamWouldBeForCurAppt = true;
        for (let j = i + 1; j < combinedVals.length; j++) {
            const {
                lastName: nextApptLastName,
                plainValue: nextApptPlainValues,
                richTextValue: nextApptRichTextValues
            } = combinedVals[j];

            const nextApptDate = nextApptPlainValues[0];

            if (nextApptDate === sameFamString && sameFamWouldBeForCurAppt) continue;

            sameFamWouldBeForCurAppt = false;

            const diff = Math.abs(nextApptDate - curApptDate);
            if (diff > 60 * 60 * 1000) break;

            if (curApptLastName === nextApptLastName) {
                const curApptAnimalID = getAnimaIdFromCellRichText(curApptRichTextValues[1])
                if (!curApptAnimalID) continue;

                const nextApptAnimalID = getAnimaIdFromCellRichText(nextApptRichTextValues[1]);
                if (!nextApptAnimalID) continue;

                const [curAnimalContactID, nextAnimalContactID] = getTwoAnimalContactIDsAsync(curApptAnimalID, nextApptAnimalID);

                if (curAnimalContactID === nextAnimalContactID) {
                    // ensure that they are next to each other in the array and set nextPlainValue[0] = sameFamString
                    // 
                    combinedVals[j].plainValue[0] = sameFamString;
                    const curValToMove = combinedVals.splice(j, 1)[0];
                    combinedVals.splice(i + 1, 0, curValToMove);
                    break;
                }
            }
        }
    }

    const sortedRichText = combinedVals.map(val => val.richTextValue);
    range.offset(0, 0, numOfAppts).setRichTextValues(sortedRichText);

    const sortedDateVals = combinedVals.map(val => [val.plainValue[0]]);
    range.offset(0, 0, numOfAppts, 1).setValues(sortedDateVals);

    range.offset(0, 0, range.getNumRows(), 1).setNumberFormat('h:mma/p');
}

function getNumOfApptRows(vals) {
    let numOfAppts;
    for (let i = 0; i < vals.length; i++) {
        if (vals[i][0] === '') {
            numOfAppts = i;
            break;
        }
    }
    if (!numOfAppts) {
        throw new Error(`num of appts is ${numOfAppts} when trying to count the appointment rows`);
    }
    return numOfAppts;
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

function getAnimaIdFromCellRichText(richText) {
    const curPtNameCellRuns = richText.getRuns();
    const curAnimalLink = getLinkFromRuns(curPtNameCellRuns);
    const curApptAnimalID = curAnimalLink?.split('=').at(-1);
    return curApptAnimalID;
}

function handleDeleteRow(existingRow, range) {
    if (!existingRow) return;

    const vals = range.getValues();

    const numOfAppts = getNumOfApptRows(vals);
    if (!numOfAppts) return;

    const existingRowIndexWithinRange = existingRow.getRow() - dtNextDayApptsRowStartNumber;

    const nextRowTimeValue = vals[existingRowIndexWithinRange + 1][0];

    if (nextRowTimeValue === sameFamString) {
        // set this value to an actual time
        const nextRow = range.offset(existingRowIndexWithinRange + 1, 0, 1);
        const nextRowRichText = nextRow.getRichTextValues();
        const nextRowAnimalID = getAnimaIdFromCellRichText(nextRowRichText[1]);
        const nextRowDate = getActualStartTime(nextRowAnimalID);
        nextRow.offset(0, 0, 1, 1).setValue(nextRowDate);
    }

    // grab all the appointments below
    const rowsBelow = range.offset(
        existingRowIndexWithinRange + 1,
        0,
        numOfAppts - 1 - existingRowIndexWithinRange
    );
    // paste them in, starting from the existing row
    const targetRange = range.offset(
        existingRowIndexWithinRange,
        0,
        numOfAppts - 1 - existingRowIndexWithinRange - 1
    );
    rowsBelow.copyTo(targetRange);
    // delete the last appointment, reset its format
    range.offset(numOfAppts - 1, 0, 1)
        .clearContent()
        .setFontColor("black")
        .setBackground("white")
        .setFontLine("none")
        .setBorder(true, false, false, false, false, false);

}

function getActualStartTime(animalID) {
    const [targetDayStart, targetDayEnd] = epochRangeForFutureDay(daysToNextDtAppts);
    const url = `${proxy}/v1/appointment?active=1&animal_id=${animalID}&time_range_start=${targetDayStart}&time_range_end=${targetDayEnd}&limit=200`;
    const allTargetDayAppts = fetchAndParse(url);
    const appts = filterAndSortDTAppts(allTargetDayAppts);
    if (appts.length !== 1) {
        throw new Error(`there are ${appts.length} on next day of dt appts for animal with id of ${animalID}`);
    }
    return new Date(appts[0].appointment.start_time * 1000);
}
function handleNextDayAppt(appointment, uaLoc) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(uaLoc);

    // ⬇️ dynamic range for this location’s NDAs, A:I
    const range = getNdaRangeForLoc(sheet, uaLoc);

    const { highestEmptyRow, existingRow } = findRow(range, appointment.animal_id, 1);

    if (!appointment.active) return handleDeleteRow(existingRow, range);

    const rowRange = existingRow ? existingRow : highestEmptyRow;

    const existingRowRichText = rowRange.getRichTextValues();

    const incomingTimeValue = new Date(appointment.start_at * 1000);
    let timeCellString = incomingTimeValue;
    const timeCellValBeforeUpdating = existingRowRichText[0][0].getText();
    if (timeCellValBeforeUpdating === SAME_FAM_STRING) {
        let foundCoorespondingTimeCellVal;
        let rowOffset = -1;
        while (!foundCoorespondingTimeCellVal || rowOffset < -10) {
            const rowRangeAbove = rowRange.offset(rowOffset, 0);
            const timeCellVal = rowRangeAbove.getValue();
            if (timeCellVal !== SAME_FAM_STRING) {
                foundCoorespondingTimeCellVal = timeCellVal;
                break;
            }
            rowOffset--;
        }
        if (!foundCoorespondingTimeCellVal) {
            throw new Error(`unable to find corresponding time cell val at handleNextDayDtAppts(): ${appointment}`);
        }
        const timeDifferenceMs = Math.abs(incomingTimeValue - foundCoorespondingTimeCellVal);
        const timeDifferenceHours = timeDifferenceMs / (1000 * 60 * 60);
        if (timeDifferenceHours <= 1) {
            timeCellString = SAME_FAM_STRING;
        }
    }

    let ptCellRichText;
    let fractiousCellRichText;
    let seeChartRichText;
    if (highestEmptyRow) {
        highestEmptyRow.setBorder(true, true, true, true, true, true);
        const { ptCellLink, isHostile, seeChartLink } = fetchForDataAndMakeLink(appointment);
        ptCellRichText = ptCellLink;
        const fractiousCellText = isHostile ? 'yes' : 'no';
        fractiousCellRichText = simpleTextToRichText(fractiousCellText);
        seeChartRichText = seeChartLink;
    } else if (existingRow) {
        ptCellRichText = existingRowRichText[0][1];
    } else if (!ptCellRichText) {
        throw new Error('couldnt make rich text value for incoming patient name');
    }

    const hasDepositPaidStatus = appointment.status_id === 37;
    const depositCellBeforeUpdating = existingRowRichText[0][2].getText();
    const depositPaidText = depositCellBeforeUpdating?.includes('yes') || hasDepositPaidStatus
        ? 'yes'
        : 'no';

    const depositPaidRichtext = simpleTextToRichText(depositPaidText);

    const reasonCellText = extractChckupClientNotes(appointment.description);
    const reasonCellRichText = simpleTextToRichText(reasonCellText);

    if (existingRow) {
        rowRange.offset(0, 1, 1, 3).setRichTextValues([
            [ptCellRichText, depositPaidRichtext, reasonCellRichText]
        ]);
    }

    if (highestEmptyRow) {
        rowRange.offset(0, 1, 1, 7).setRichTextValues([
            [ptCellRichText, depositPaidRichtext, reasonCellRichText, seeChartRichText, seeChartRichText, fractiousCellRichText, seeChartRichText]
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
    const text = `${animalName} ${contactLastName} (${animalSpecies || UNKNOWN_SPECIES_STRING})`;
    const url = `${SITE_PREFIX}/?recordclass=Animal&recordid=${appointment.animal_id}`;
    const ptCellLink = makeLink(text, url);
    const seeChartLink = makeLink('see pt chart', url);
    return { ptCellLink, isHostile, seeChartLink };
}

function resortDtAppts(
    range = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DT_SHEET_NAME).getRange(DT_NDA_COORDS)
) {
    const vals = range.getValues();
    const numOfAppts = getNumOfApptRows(vals);
    const richTextVals = range.getRichTextValues();

    const apptRichTexts = richTextVals.slice(0, numOfAppts);
    const apptVals = vals.slice(0, numOfAppts);

    const combinedVals = apptVals.map((apptVal, i) => {
        const sameFamTime = apptVal[0] === SAME_FAM_STRING
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

    for (let i = 0; i < combinedVals.length - 1; i++) {
        const {
            lastName: curApptLastName,
            plainValue: curApptPlainValues,
            richTextValue: curApptRichTextValues
        } = combinedVals[i];

        const curApptDate = curApptPlainValues[0];

        if (curApptDate === SAME_FAM_STRING) continue;

        let sameFamWouldBeForCurAppt = true;
        for (let j = i + 1; j < combinedVals.length; j++) {
            const {
                lastName: nextApptLastName,
                plainValue: nextApptPlainValues,
                richTextValue: nextApptRichTextValues
            } = combinedVals[j];

            const nextApptDate = nextApptPlainValues[0];

            if (nextApptDate === SAME_FAM_STRING && sameFamWouldBeForCurAppt) continue;

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
                    // ensure that they are next to each other in the array and set nextPlainValue[0] = SAME_FAM_STRING
                    // 
                    combinedVals[j].plainValue[0] = SAME_FAM_STRING;
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
        if (timeVal !== SAME_FAM_STRING) {
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

    const existingRowIndexWithinRange = existingRow.getRow() - DT_NDA_ROW_START_NUMBER;

    const existingRowTimeValue = vals[existingRowIndexWithinRange][0];
    let nextRowTimeValue = vals[existingRowIndexWithinRange + 1][0];

    if (nextRowTimeValue === SAME_FAM_STRING && existingRowTimeValue !== SAME_FAM_STRING) {
        let totalNumOfRowsPointingToExistingRowTime = 0;
        while (nextRowTimeValue === SAME_FAM_STRING) {
            totalNumOfRowsPointingToExistingRowTime++;
            nextRowTimeValue = vals[existingRowIndexWithinRange + 1 + totalNumOfRowsPointingToExistingRowTime][0];
        }

        const rowsInSameFam = range.offset(existingRowIndexWithinRange + 1, 0, totalNumOfRowsPointingToExistingRowTime);
        const nextRowRichText = rowsInSameFam.getRichTextValues();
        const animalIDs = [];
        for (let k = 0; k < nextRowRichText.length; k++) {
            const nextRowAnimalID = getAnimaIdFromCellRichText(nextRowRichText[k][1]);
            animalIDs.push(nextRowAnimalID);
        }

        const nextRowDate = getActualStartTime(animalIDs);
        range.offset(existingRowIndexWithinRange + 1, 0, 1, 1).setValue(nextRowDate);
    }

    // grab all the appointments below (if its not the last appointment) and paste them one row up
    const numOfApptsBelowDeleted = numOfAppts - 1 - existingRowIndexWithinRange;
    if (numOfApptsBelowDeleted > 0) {
        const rowsBelow = range.offset(
            existingRowIndexWithinRange + 1,
            0,
            numOfApptsBelowDeleted
        );
        // paste them in, starting from the existing row
        const targetRange = range.offset(
            existingRowIndexWithinRange,
            0,
            numOfAppts - 1 - existingRowIndexWithinRange
        );
        rowsBelow.copyTo(targetRange);
    }

    // delete the last appointment, reset its format
    range.offset(numOfAppts - 1, 0, 1)
        .clearContent()
        .setFontColor("black")
        .setBackground("white")
        .setFontLine("none")
        .setBorder(true, false, false, false, false, false);

}

function getActualStartTime(animalIDs) {
    const [targetDayStart, targetDayEnd] = epochRangeForFutureDay(daysToNextDtAppts);
    const encodedTime = `start_time=${encodeURIComponent(JSON.stringify({ ">": targetDayStart, "<": targetDayEnd }))}`;
    const encodedAnimalIDs = encodeURIComponent(JSON.stringify({ "in": animalIDs }));
    const url = `${EV_PROXY}/v1/appointment?active=1&animal_id=${encodedAnimalIDs}&${encodedTime}`;
    const allTargetDayAppts = fetchAndParse(url);
    const appts = filterAndSortDTAppts(allTargetDayAppts);
    if (appts.length !== animalIDs.length) {
        throw new Error(`there are ${appts.length} on next day of dt appts for animals with ids of ${animalIDs}`);
    }
    const startTimes = appts.map(({ appointment }) => Number(appointment.start_time));
    const minStartTime = Math.min(...startTimes);
    return new Date(minStartTime * 1000);
}
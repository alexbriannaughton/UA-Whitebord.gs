function handleNextDayAppt(appointment, uaLoc) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('NDAs');

    // ⬇️ dynamic range for this location’s NDAs, A:I
    let range = getNdaRangeForLoc(sheet, uaLoc); // <-- make this 'let'

    const { highestEmptyRow, existingRow } = findRow(range, appointment.animal_id, 1);

    if (!appointment.active) return handleDeleteRow(existingRow, range);

    // --- ensure we have a rowRange; if none, insert a row at bottom of range ---
    let rowRange = existingRow ? existingRow : highestEmptyRow;

    if (!rowRange) {
        // insert a new row just after the current NDA block
        const insertRowIndex = range.getLastRow() + 1;

        // insert a row into the sheet; this pushes everything below down
        sheet.insertRows(insertRowIndex, 1);

        // extend the NDA range to include this new row
        const newNumRows = range.getNumRows() + 1;
        range = sheet.getRange(
            range.getRow(),
            range.getColumn(),
            newNumRows,
            range.getNumColumns()
        );

        // get the row range for the newly inserted row (A:I on that row)
        rowRange = sheet.getRange(
            insertRowIndex,
            range.getColumn(),
            1,
            range.getNumColumns()
        );

        // optional: set border on the new row like other new rows
        rowRange.setBorder(true, true, true, true, true, true);
    }

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
    if (highestEmptyRow || !existingRow) {
        // treat newly inserted rows the same as "highestEmptyRow" rows
        rowRange.setBorder(true, true, true, true, true, true);
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

    if (!existingRow) {
        // covers both highestEmptyRow and newly inserted row
        rowRange.offset(0, 1, 1, 7).setRichTextValues([
            [ptCellRichText, depositPaidRichtext, reasonCellRichText, seeChartRichText, seeChartRichText, fractiousCellRichText, seeChartRichText]
        ]);
    }

    rowRange.offset(0, 0, 1, 1).setValue(timeCellString);

    // use the (possibly extended) range
    resortAppts(range);

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

function resortAppts(range) {
    const vals = range.getValues();
    const numOfAppts = range.getNumRows();
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
    const numOfAppts = range.getNumRows(); // whole range is appts now
    if (numOfAppts === 0) return;

    // index of row inside this range (0-based)
    const existingRowIndexWithinRange = existingRow.getRow() - range.getRow();

    // sanity guard: if somehow outside, bail
    if (existingRowIndexWithinRange < 0 || existingRowIndexWithinRange >= numOfAppts) {
        return;
    }

    const existingRowTimeValue = vals[existingRowIndexWithinRange][0];

    // if it's the last row, there is no "next" row to inspect
    if (existingRowIndexWithinRange < numOfAppts - 1) {
        let nextRowTimeValue = vals[existingRowIndexWithinRange + 1][0];

        if (nextRowTimeValue === SAME_FAM_STRING && existingRowTimeValue !== SAME_FAM_STRING) {
            let totalNumOfRowsPointingToExistingRowTime = 0;

            // walk down while SAME_FAM_STRING and within bounds
            while (
                existingRowIndexWithinRange + 1 + totalNumOfRowsPointingToExistingRowTime < numOfAppts &&
                nextRowTimeValue === SAME_FAM_STRING
            ) {
                totalNumOfRowsPointingToExistingRowTime++;
                nextRowTimeValue = vals[existingRowIndexWithinRange + 1 + totalNumOfRowsPointingToExistingRowTime][0];
            }

            const rowsInSameFam = range.offset(
                existingRowIndexWithinRange + 1,
                0,
                totalNumOfRowsPointingToExistingRowTime
            );
            const nextRowRichText = rowsInSameFam.getRichTextValues();
            const animalIDs = [];
            for (let k = 0; k < nextRowRichText.length; k++) {
                const nextRowAnimalID = getAnimaIdFromCellRichText(nextRowRichText[k][1]);
                animalIDs.push(nextRowAnimalID);
            }

            if (animalIDs.length > 0) {
                const nextRowDate = getActualStartTime(animalIDs);
                range.offset(existingRowIndexWithinRange + 1, 0, 1, 1).setValue(nextRowDate);
            }
        }
    }

    // grab all the appointments below (if its not the last appointment) and paste them one row up
    const numOfApptsBelowDeleted = numOfAppts - 1 - existingRowIndexWithinRange;
    if (numOfApptsBelowDeleted > 0) {
        const rowsBelow = range.offset(
            existingRowIndexWithinRange + 1,
            0,
            numOfApptsBelowDeleted
        );
        const targetRange = range.offset(
            existingRowIndexWithinRange,
            0,
            numOfApptsBelowDeleted
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

function getNdaRangeForLoc(sheet, uaLoc) {
    const headerText = `${uaLoc}-\n`;
    const lastRow = sheet.getLastRow();
    if (!lastRow) {
        throw new Error('Sheet is empty when trying to find NDA range');
    }

    const colAValues = sheet.getRange(1, 1, lastRow, 1).getValues();
    // 1. Find the header row for this location/date
    let headerRow = null;
    for (let i = 0; i < colAValues.length; i++) {
        const cellVal = colAValues[i][0];
        if (cellVal.startsWith(headerText)) {
            headerRow = i + 1; // 1-based
            break;
        }
    }

    if (!headerRow) {
        throw new Error(`Could not find NDA header for ${headerText} in column A`);
    }

    const startRow = headerRow + 1; // first NDA row

    // 2. Find where this NDA block ends
    let endRow = lastRow;
    for (let i = startRow; i <= lastRow; i++) {
        const cellVal = colAValues[i - 1][0];

        // blank row -> end of block
        if (cellVal === '' || cellVal === null) {
            endRow = i - 1;
            break;
        }

        // next header (any cell with a newline) -> end before this row
        if (typeof cellVal === 'string' && cellVal.includes('\n') && i !== headerRow) {
            endRow = i - 1;
            break;
        }
    }

    if (endRow < startRow) {
        throw new Error(`No NDA rows found under header ${headerText}`);
    }

    const numRows = endRow - startRow + 1;
    const FIRST_COL = 1;   // A
    const NUM_COLS = 9;    // A:I

    return sheet.getRange(startRow, FIRST_COL, numRows, NUM_COLS);
}

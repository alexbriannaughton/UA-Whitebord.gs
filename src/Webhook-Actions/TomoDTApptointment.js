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

function resortTheAppts() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DT');
    const range = sheet.getRange(dtNextDayApptsCoords);
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
      const aN = a.plainValue[0][0]
      const bN = b.plainValue[0][0]
      // console.log(aN, bN)
      return Number(aN) - Number(bN);
    });
    
    // const sortedRichText = combinedVals.map(val => val.richTextValue);
    // range.setRichTextValues(sortedRichText);
  }
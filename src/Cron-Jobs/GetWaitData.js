function getWaitData() {
    const ssApp = SpreadsheetApp.getActiveSpreadsheet();
    const chWaitlistSheet = ssApp.getSheetByName('CH Wait List');
    const chRange = chWaitlistSheet.getRange('C2:C4');
    const chVals = chRange.getValues();
    console.log('ch vals: ', chVals)
}
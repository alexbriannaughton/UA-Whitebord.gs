function getWaitData() {
    const ssApp = SpreadsheetApp.getActiveSpreadsheet();
    const chWaitlistSheet = ssApp.getSheetByName('CH Wait List');
    const chRange = chWaitlistSheet.getRange('C2:D4');
    const chVals = chRange.getValues();
    const waitData = {}
    waitData.ch = {
        ptsOnWaitlist: chVals[0][0],
        dvmsOnFloor: chVals[1][0],
        estWait: chVals[2][0],
        capText: chVals[0][1]
    };
    return waitData;
}

function sendWaitData(waitData) {
    const url = PropertiesService.getScriptProperties().getProperty('wait_tracker_url');
    const options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(waitData)
    };
    const response = UrlFetchApp.fetch(url, options);
    const content = response.getContentText();
    console.log(content);
}
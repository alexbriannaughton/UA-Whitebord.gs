function getWaitData() {
    const ssApp = SpreadsheetApp.getActiveSpreadsheet();
    const chWaitlistSheet = ssApp.getSheetByName('CH Wait List');
    const chRange = chWaitlistSheet.getRange('C2:C4');
    const chVals = chRange.getValues();
    const chData = {
        ptsOnWaitlist: chVals[0][0],
        dvmsOnFloor: chVals[1][0],
        estWait: chVals[2][0]
    };
    return chData;
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
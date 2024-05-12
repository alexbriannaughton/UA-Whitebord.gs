function getWaitData() {
    const ssApp = SpreadsheetApp.getActiveSpreadsheet();
    const waitData = {
        ch: getWaitValsForLocation(ssApp, 'CH Wait List'),
        wc: getWaitValsForLocation(ssApp, 'WC Wait List')
    };
    return waitData;
}

function getWaitValsForLocation(ssApp, sheetName) {
    const waitlistSheet = ssApp.getSheetByName(sheetName);
    const vals = waitlistSheet.getRange('C2:D4').getValues();
    return {
        ptsOnWaitlist: vals[0][0],
        dvmsOnFloor: vals[1][0],
        estWait: vals[2][0],
        capText: vals[0][1]
    };
}

// function sendWaitData(waitData) {
//     const url = PropertiesService.getScriptProperties().getProperty('wait_tracker_url');
//     const options = {
//         method: "post",
//         contentType: "application/json",
//         payload: JSON.stringify(waitData)
//     };
//     const response = UrlFetchApp.fetch(url, options);
//     const content = response.getContentText();
//     console.log(content);
// }
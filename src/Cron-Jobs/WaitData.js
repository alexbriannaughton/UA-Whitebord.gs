function getWaitData() {
    const ssApp = SpreadsheetApp.getActiveSpreadsheet();
    const waitData = [
        getWaitValsForLocation(ssApp, 'CH'),
        getWaitValsForLocation(ssApp, 'WC')
    ];
    return waitData;
}

function getWaitValsForLocation(ssApp, location) {
    const waitlistSheet = ssApp.getSheetByName(`${location} Wait List`);
    const vals = waitlistSheet.getRange('C2:D4').getValues();
    return {
        location,
        num_of_dvms_on_floor: vals[1][0],
        wb_wait_time: vals[2][0],
        num_of_pts_waiting: vals[0][0],
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
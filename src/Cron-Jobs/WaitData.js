function getWaitData(ssApp, numOfRoomsInUse, sheets) {
    const waitData = [
        getWaitValsForLocation(ssApp, 'CH', numOfRoomsInUse, sheets),
        getWaitValsForLocation(ssApp, 'WC', numOfRoomsInUse, sheets)
    ];
    return waitData;
}

function getWaitValsForLocation(ssApp, location, numOfRoomsInUse, sheets) {
    const waitlistSheet = sheets.find(sheet => sheet.getName() === `${location} Wait List`);
    // const waitlistSheet = ssApp.getSheetByName(`${location} Wait List`);
    const vals = waitlistSheet.getRange('C2:D4').getValues();
    const capText = vals[0][1];
    const { soft_cap, hard_cap } = checkForCap(capText);
    return {
        location,
        soft_cap,
        hard_cap,
        num_of_dvms_on_floor: Number(vals[1][0]) || 0,
        wb_wait_time: vals[2][0],
        num_of_pts_waiting: vals[0][0],
        rooms_in_use: numOfRoomsInUse[location]
    };
}

function checkForCap(capText) {
    const soft_cap = capText === 'Cancellation List Only';
    const hard_cap = capText.includes('Not Currently Accepting Walk-ins');
    return { soft_cap, hard_cap };
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
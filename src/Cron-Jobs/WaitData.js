function getWaitData(numOfRoomsInUse, sheets) {
    const waitData = [
        getWaitValsForLocation('CH', numOfRoomsInUse, sheets),
        getWaitValsForLocation('WC', numOfRoomsInUse, sheets)
    ];
    return waitData;
}

function getWaitValsForLocation(location, numOfRoomsInUse, sheets) {
    const waitlistSheet = sheets.find(sheet => sheet.getName() === `${location} Wait List`);
    const waitlistVals = waitlistSheet.getRange('C2:D4').getValues();
    const capText = waitlistVals[0][1];
    const { soft_cap, hard_cap } = checkForCap(capText);

    const mainSheet = sheets.find(sheet => sheet.getName() === location);
    let max_dvm_rooms;
    if (location === 'CH') {
        const v = mainSheet.getRange('O4').getValues();
        console.log(v)
        // max_dvm_rooms = .slice(0,2);
    }
    else if (location === 'WC') {
        const v = mainSheet.getRange('I3').getValues()
        console.log(v)
        // max_dvm_rooms = .slice(0,2);
    }
    console.log(location, max_dvm_rooms);

    return {
        location,
        soft_cap,
        hard_cap,
        num_of_dvms_on_floor: Number(waitlistVals[1][0]) || 0,
        wb_wait_time: waitlistVals[2][0],
        num_of_pts_waiting: waitlistVals[0][0],
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
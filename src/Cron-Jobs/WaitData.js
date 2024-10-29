function getWaitData(numOfRoomsInUse, sheets, locationStaffingCounts) {
    const waitData = [
        getWaitValsForLocation('CH', numOfRoomsInUse, sheets, locationStaffingCounts),
        getWaitValsForLocation('WC', numOfRoomsInUse, sheets, locationStaffingCounts)
    ];
    return waitData;
}

function getWaitValsForLocation(location, numOfRoomsInUse, sheets, locationStaffingCounts) {
    const waitlistSheet = sheets.find(sheet => sheet.getName() === `${location} Wait List`);
    const waitlistVals = waitlistSheet.getRange('C2:D4').getValues();
    const capText = waitlistVals[0][1];
    const { soft_cap, hard_cap } = checkForCap(capText);

    const mainSheet = sheets.find(sheet => sheet.getName() === location);
    const maxRoomCellCoords = locationNumOfRoomsCellCoords.get(location);
    const cellValAsString = String(mainSheet.getRange(maxRoomCellCoords).getValue());
    const maxDvmRooms = Number(cellValAsString.slice(0, 2)) || 0;

    // cur prod code below
    // let maxDvmRooms = 0;
    // if (location === 'CH') {
    //     const cellVal = String(mainSheet.getRange('O4').getValue()).slice(0, 2);
    //     maxDvmRooms = Number(cellVal);
    // }
    // else if (location === 'WC') {
    //     const cellVal = String(mainSheet.getRange('I3').getValue()).slice(0, 2);
    //     maxDvmRooms = Number(cellVal);
    // }

    return {
        max_dvm_rooms: maxDvmRooms || 0,
        location,
        soft_cap,
        hard_cap,
        num_of_dvms_on_floor: Number(waitlistVals[1][0]) || 0,
        wb_wait_time: Number(waitlistVals[2][0]) || 0,
        num_of_pts_waiting: waitlistVals[0][0],
        rooms_in_use: numOfRoomsInUse[location],
        ...locationStaffingCounts[location]
    };
}

function checkForCap(capText) {
    const soft_cap = capText === 'Cancellation List Only';
    const hard_cap = capText.includes('Not Currently Accepting Walk-ins');
    return { soft_cap, hard_cap };
}
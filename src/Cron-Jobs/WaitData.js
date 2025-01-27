function getWaitData(numOfRoomsInUse, sheets) {
    const waitData = [
        getWaitValsForLocation(CH_SHEET_NAME, numOfRoomsInUse, sheets),
        getWaitValsForLocation(WC_SHEET_NAME, numOfRoomsInUse, sheets)
    ];
    return waitData;
}

function getWaitValsForLocation(uaLocSheetName, numOfRoomsInUse, sheets) {
    const waitlistSheet = sheets.find(sheet => sheet.getName() === `${uaLocSheetName} Wait List`);
    const waitlistVals = waitlistSheet.getRange('C2:D4').getValues();
    const capText = waitlistVals[0][1];
    const { soft_cap, hard_cap } = checkForCap(capText);

    const mainSheet = sheets.find(sheet => sheet.getName() === uaLocSheetName);
    const maxRoomCellCoords = UA_LOC_MAX_ROOMS_CELL_COORDS.get(uaLocSheetName);
    const cellValAsString = String(mainSheet.getRange(maxRoomCellCoords).getValue());
    const maxDvmRooms = Number(cellValAsString.slice(0, 2)) || 0;

    return {
        max_dvm_rooms: maxDvmRooms || 0,
        location: uaLocSheetName,
        soft_cap,
        hard_cap,
        dvms_on_floor: Number(waitlistVals[1][0]) || 0,
        wait_time: Number(waitlistVals[2][0]) || 0,
        pts_waiting: waitlistVals[0][0],
        rooms_in_use: numOfRoomsInUse[location],
    };
}

function checkForCap(capText) {
    const soft_cap = capText === 'Cancellation List Only';
    const hard_cap = capText.includes('Not Currently Accepting Walk-ins');
    return { soft_cap, hard_cap };
}
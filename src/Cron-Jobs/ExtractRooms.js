function extractMainSheetData(sheets) {
    const chRowFourIndexToStatusIDMap = new Map([
        [0, '18'],//Room 1
        [1, '25'],//Room 2
        [2, '26'],//Room 3
        [3, '27'],//Room 4
        [4, '28'],//Room 5
        [5, '40'],// cat lobby (column 1)
        [6, '40'],//cat lobby (column 2)
    ]);

    // this map works for both WC and DT
    const rowFourIndexToStatusIDMap = new Map([
        [0, '18'], //Room 1
        [1, '25'], //Room 2
        [2, '26'], //Room 3
        [3, '27'], //Room 4
        [4, '28'], //Room 5
        [5, '29'], //Room 6
        [6, '30'], //Room 7
    ]);

    const roomsWithLinks = {};
    const numOfRoomsInUse = {};

    const staffingVals = [
        extractRoomsDataAndGetStaffingVals('CH', 'C3:I35', chRowFourIndexToStatusIDMap, roomsWithLinks, numOfRoomsInUse, sheets),
        extractRoomsDataAndGetStaffingVals('DT', 'C3:N11', rowFourIndexToStatusIDMap, roomsWithLinks, numOfRoomsInUse, sheets),
        extractRoomsDataAndGetStaffingVals('WC', 'C3:N27', rowFourIndexToStatusIDMap, roomsWithLinks, numOfRoomsInUse, sheets)
    ]

    const locsOrdering = ['CH', 'DT', 'WC'];
    staffingVals.forEach((sv, i) => extractStaffing(sv, locsOrdering[i]));

    return { roomsWithLinks, numOfRoomsInUse };
}

// this is called from doGet(), which is triggered by supabase edge function that runs every 10 minutes during open hours
function extractRoomsDataAndGetStaffingVals(sheetName, rangeCoords, indexToStatusIDMap, roomsWithLinks, numOfRoomsInUse, sheets) {
    const sheet = sheets.find(sheet => sheet.getName() === sheetName);
    // const sheet = ssApp.getSheetByName(sheetName);
    const range = sheet.getRange(rangeCoords);

    const rtVals = range.getRichTextValues();
    const rowFourRTVals = rtVals[1];
    parseOneRowForLinks(rowFourRTVals, indexToStatusIDMap, roomsWithLinks, sheetName);
    if (sheetName === 'CH') { // cap hill has 2 lobbies, so we have this extra step
        // const rowFourteenRTVals = rtVals.at(-2);
        const rowFourteenRTVals = rtVals[11];
        const chRowFourteenIndexToSatusIDMap = new Map([
            [0, '29'], // room 6
            [1, '30'], //Room 7
            [2, '31'], //Room 8
            [3, '32'], //Room 9
            [4, '33'], //Room 10
            [5, '36'], //Room 11
            [6, '39'], //Dog Lobby
        ]);
        parseOneRowForLinks(rowFourteenRTVals, chRowFourteenIndexToSatusIDMap, roomsWithLinks, sheetName);
    }

    // we dont currently make waitlogs for dt, so no need to determine its rooms in use
    if (sheetName === 'DT') return range.offset(0, 8, 9, 4).getValues();

    const vals = range.getValues();
    const roomsInUse = sheetName === 'CH'
        ? countRoomsInUse(vals.slice(0, 3)) + countRoomsInUse(vals.slice(10, 13), true)
        : countRoomsInUse(vals.slice(0, 3));

    numOfRoomsInUse[sheetName] = roomsInUse;

    if (sheetName === 'CH') return vals.slice(22).map(rowVals => rowVals.slice(1, -1));
    if (sheetName === 'WC') return vals.slice(17).map(rowVals => rowVals.slice(-4));
}

function parseOneRowForLinks(rowRTVals, indexToStatusIDMap, roomsWithLinks, sheetName) {
    const columnSliceAmount = {
        'CH': undefined, // dont slice anything
        'DT': 7,
        'WC': 5
    };

    const slicedRowRtVals = rowRTVals.slice(0, columnSliceAmount[sheetName]);

    for (let i = 0; i < slicedRowRtVals.length; i++) {
        const statusID = indexToStatusIDMap.get(i);
        const roomLocationKey = sheetName + statusID;
        const runs = slicedRowRtVals[i].getRuns();
        for (const richText of runs) {
            const link = richText.getLinkUrl();
            if (!link) continue;
            if (link.includes('Consult')) {
                const whiteboardConsultID = link.split('=')[2];
                roomsWithLinks[roomLocationKey] = { whiteboardConsultID };
                break;
            }
            else if (link.includes('Contact')) {
                const whiteboardContactID = link.split('=')[2];
                roomsWithLinks[roomLocationKey] = { whiteboardContactID };
                break;
            }
        }
    }
}

function countRoomsInUse([timeRow, nameRow, reasonRow], checkRoom11 = false) {
    let roomsInUse = 0;
    const numOfRooms = checkRoom11 ? 6 : 5;
    for (let i = 0; i < numOfRooms; i++) {
        if (!cellIsEmpty(timeRow[i]) && !cellIsEmpty(nameRow[i]) && !cellIsEmpty(reasonRow[i])) {
            roomsInUse++
        }
    }
    return roomsInUse;
}

function extractStaffing(vals, sheetName) {
    console.log(sheetName, vals);
}
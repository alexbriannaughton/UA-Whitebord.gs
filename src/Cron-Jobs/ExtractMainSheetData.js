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

    const locationPossPositionNames = {}
    const locationByOrder = ['CH', 'DT', 'WC'];
    staffingVals.forEach((sv, i) => extractStaffing(sv, locationByOrder[i], locationPossPositionNames));

    return { roomsWithLinks, numOfRoomsInUse, locationPossPositionNames };
}

// this is called from doGet(), which is triggered by supabase edge function that runs every 5 minutes during open hours
function extractRoomsDataAndGetStaffingVals(
    sheetName,
    rangeCoords,
    indexToStatusIDMap,
    roomsWithLinks,
    numOfRoomsInUse,
    sheets
) {
    const sheet = sheets.find(sheet => sheet.getName() === sheetName);
    const range = sheet.getRange(rangeCoords);
    const rtVals = range.getRichTextValues();
    const rowFourRTVals = rtVals[1];

    parseOneRowForLinks(rowFourRTVals, indexToStatusIDMap, roomsWithLinks, sheetName);

    if (sheetName !== 'DT') { // cap hill and white center have 2 locations / lobbies, so there's an extra step
        const rowFourteenRTVals = rtVals[11];
        const rowFourteenIndexToSatusIDMap = sheetName === 'CH'
            ? new Map([ // cap hill dog lobby
                [0, '29'], // room 6
                [1, '30'], //Room 7
                [2, '31'], //Room 8
                [3, '32'], //Room 9
                [4, '33'], //Room 10
                [5, '36'], //Room 11
                [6, '39'], //Dog Lobby
            ])
            : new Map([ // white center surgery building
                [0, '43'], // sx room 1
                [1, '42'], // sx room 2
                [2, '41'], // sx room 3
            ]);
        parseOneRowForLinks(rowFourteenRTVals, rowFourteenIndexToSatusIDMap, roomsWithLinks, sheetName);
    }
    // else it is DT...
    // we dont currently make waitlogs for dt, so no need to determine its rooms in use
    else return range.offset(0, 8, 9, 4).getValues();

    const vals = range.getValues();
    const roomsInUse = sheetName === 'CH'
        ? countRoomsInUse(vals.slice(0, 3)) + countRoomsInUse(vals.slice(10, 13), true)
        : countRoomsInUse(vals.slice(0, 3));

    numOfRoomsInUse[sheetName] = roomsInUse;

    if (sheetName === 'CH') return vals.slice(22).map(rowVals => rowVals.slice(1, -1));
    if (sheetName === 'WC') return vals.slice(17).map(rowVals => rowVals.slice(-4));
}

function parseOneRowForLinks(rowRTVals, indexToStatusIDMap, roomsWithLinks, sheetName) {
    for (let i = 0; i < rowRTVals.length; i++) {
        const statusID = indexToStatusIDMap.get(i);
        if (!statusID) break;

        const roomLocationKey = sheetName + statusID;
        const runs = rowRTVals[i].getRuns();
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

function extractStaffing(vals, sheetName, locationPossPositionNames) {
    locationPossPositionNames[sheetName] = {
        assts: [],
        leads: [],
        dvms: [],
        foh: [],
        kennel: [],
    }

    for (let i = 0; i < vals.length; i++) {
        const rowVals = vals[i];

        // ch assistants: vals[i][0]
        // ch leads/techs: vals[i][1]
        // ch dvm: vals[i][2]
        // ch foh: vals[i][3]
        // ch kennel: vals[i][4] until i is greater than 9
        if (sheetName === 'CH') {
            if (rowVals[0]) {
                locationPossPositionNames[sheetName].assts.push(rowVals[0]);
            }
            if (rowVals[1]) {
                const tallyAsAsst = i >= 9;
                if (tallyAsAsst) locationPossPositionNames[sheetName].assts.push(rowVals[1]);
                else locationPossPositionNames[sheetName].leads.push(rowVals[1]);
            }
            if (rowVals[2]) {
                locationPossPositionNames[sheetName].dvms.push(rowVals[2]);
            }
            if (rowVals[3]) {
                locationPossPositionNames[sheetName].foh.push(rowVals[3]);
            }
            if (i <= 9 && rowVals[4]) {
                locationPossPositionNames[sheetName].kennel.push(rowVals[4]);
            }
        }

        // not currently making logs for dt...
        // dt assistants: vals[i][0] until i is greater than 4
        // dt leads/sx: vals[i][1] until i is greater than 4
        // dt dvm: vals[i][2] until i is greater than 4, also vals[6][0] (house doctor cell)
        // dt foh: vals[i][3] until i is greater than 4
        // dt kennel: when i is greater than 5, vals[i][1]
        // else if (sheetName === 'DT') {
        //     if (i <= 4) {
        //         if (rowVals[0]) locationStaffingCounts[sheetName].assts_on_staff += 1;
        //         if (rowVals[1]) locationStaffingCounts[sheetName].leads_on_staff += 1;
        //         if (rowVals[2]) locationStaffingCounts[sheetName].dvms_on_staff += 1;
        //         if (i > 0 && rowVals[3]) locationStaffingCounts[sheetName].foh_on_staff += 1;
        //     }

        //     else if (i > 5 && rowVals[1]) locationStaffingCounts[sheetName].kennel_on_staff += 1;

        //     if (i === 6 && rowVals[0]) locationStaffingCounts[sheetName].dvms_on_staff += 1; // House doctor cell
        // }

        // wc assistants: vals[i][0]
        // wc leads/sx: vals[i][1] until i is greater than 4
        // wc dvm: vals[i][2] until i is greater than 4, also vals [6][2] (house dvm)
        // wc foh: vals[i][3]
        // wc kennel: vals[6][1]
        else if (sheetName === 'WC') {
            if (rowVals[0]) {
                locationPossPositionNames[sheetName].assts.push(rowVals[0]);
            }
            if (rowVals[3]) {
                locationPossPositionNames[sheetName].foh.push(rowVals[3]);
            }

            if (i <= 4) {
                if (rowVals[1]) {
                    locationPossPositionNames[sheetName].leads.push(rowVals[1]);
                }
                if (rowVals[2]) {
                    locationPossPositionNames[sheetName].dvms.push(rowVals[2]);
                }
            }

            if (i === 6) {
                if (rowVals[1]) {
                    locationPossPositionNames[sheetName].kennel.push(rowVals[1]);
                }
                if (rowVals[2]) {
                    locationPossPositionNames[sheetName].dvms.push(rowVals[2]);

                }
            }
        }
    }
}
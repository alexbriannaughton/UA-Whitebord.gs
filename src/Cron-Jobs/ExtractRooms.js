// this is called from doGet(), which is triggered by supabase edge function that runs every 15 minutes during open hours
function extractRooms(sheetName, rangeCoords, indexToStatusIDMap, allRooms) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    const range = sheet.getRange(rangeCoords);
    const rtVals = range.getRichTextValues();
    const rowFourRTVals = rtVals[0];
    parseOneRow(rowFourRTVals, indexToStatusIDMap, allRooms, sheetName);
    if (sheetName === 'CH') { // cap hill has 2 lobbies, so we have this extra step
        const rowFourteenRTVals = rtVals.at(-1);
        const chRowFourteenIndexToSatusIDMap = new Map([
            [0, '29'], // room 6
            [1, '30'], //Room 7
            [2, '31'], //Room 8
            [3, '32'], //Room 9
            [4, '33'], //Room 10
            [5, '36'], //Room 11
            [6, '39'] //Dog Lobby
        ]);
        parseOneRow(rowFourteenRTVals, chRowFourteenIndexToSatusIDMap, allRooms, sheetName);
    }
    return allRooms;
}

function parseOneRow(rowRTVals, indexToStatusIDMap, allRooms, sheetName) {
    for (let i = 0; i < rowRTVals.length; i++) {
        const statusID = indexToStatusIDMap.get(i);
        const roomLocationKey = sheetName + statusID;
        const runs = rowRTVals[i].getRuns();
        for (const richText of runs) {
            const link = richText.getLinkUrl();
            if (!link) continue;
            if (link.includes('Consult')) {
                const whiteboardConsultID = link.split('=')[2];
                allRooms[roomLocationKey] = { whiteboardConsultID };
                break;
            }
            else if (link.includes('Contact')) {
                const whiteboardContactID = link.split('=')[2];
                allRooms[roomLocationKey] = { whiteboardContactID };
            }
        }
    }
}
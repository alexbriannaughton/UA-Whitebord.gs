function extractRooms(sheetName, rangeCoords, indexToRoomNameMap) {
    const rooms = {};
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    const range = sheet.getRange(rangeCoords);
    const vals = range.getValues();
    const rtVals = range.getRichTextValues();
    const rowFourVals = vals[0];
    const rowFourRTVals = rtVals[0];

    parseOneRow(rowFourVals, rowFourRTVals, indexToRoomNameMap, rooms);

    if (sheetName === 'CH') {
        const rowFourteenVals = vals.at(-1);
        const rowFourteenRTVals = rtVals.at(-1);
        const chRowFourteenIndexToRoomNameMap = new Map([
            [0, 'Room 6'],
            [1, 'Room 7'],
            [2, 'Room 8'],
            [3, 'Room 9'],
            [4, 'Room 10'],
            [5, 'Room 11'],
            [6, 'Dog Lobby']
        ]);
        parseOneRow(rowFourteenVals, rowFourteenRTVals, chRowFourteenIndexToRoomNameMap, rooms);
    }

    return rooms;
}

function parseOneRow(rowVals, rowRTVals, indexToRoomNameMap, rooms) {
    for (let i = 0; i < rowVals.length; i++) {
        const roomName = indexToRoomNameMap.get(i);
        const val = rowVals[i];
        const richText = rowRTVals[i];
        const roomDetails = { val };

        const runs = richText.getRuns();
        for (const richText of runs) {
            const link = richText.getLinkUrl();
            if (link?.includes('Consult')) {
                roomDetails.consultID = link.split('=')[2];
                break;
            }
        }

        rooms[roomName] = roomDetails;

    }

}
function extractRooms(sheetName, rangeCoords, indexToSatusIDMap, allRooms) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    const range = sheet.getRange(rangeCoords);
    const vals = range.getValues();
    const rtVals = range.getRichTextValues();
    const rowFourVals = vals[0];
    const rowFourRTVals = rtVals[0];

    parseOneRow(rowFourVals, rowFourRTVals, indexToSatusIDMap, allRooms, sheetName);

    if (sheetName === 'CH') {
        const rowFourteenVals = vals.at(-1);
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
        parseOneRow(rowFourteenVals, rowFourteenRTVals, chRowFourteenIndexToSatusIDMap, allRooms, sheetName);
    }

    return allRooms;
}

function parseOneRow(rowVals, rowRTVals, indexToSatusIDMap, allRooms, sheetName) {
    for (let i = 0; i < rowVals.length; i++) {
        const statusID = indexToSatusIDMap.get(i);
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

        const roomLocationKey = sheetName + statusID;
        allRooms[roomLocationKey] = roomDetails;

    }

}
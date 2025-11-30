function formatNextDayApptsCells(sheet, range, numOfDtAppts, targetDateStr, uaLoc) {
    console.log('formatting next day range cells...');

    range.clearContent()
        .setWrap(true)
        .setFontColor("black")
        .setBackground("white")
        .setFontLine("none")
        .setBorder(false, false, false, false, false, false);

    range.offset(0, 0, numOfDtAppts).setBorder(true, true, true, true, true, true);

    const bgColor = UA_LOC_BG_COLOR_MAP[uaLoc];

    // ----- DATE CELL / HEADER ROW -----
    const dateCell = range.offset(-1, 0, 1, 1);
    dateCell.setValue(`${uaLoc}\n${targetDateStr}`);

    // Set the entire header row (for the range’s columns) to bgColor
    const headerRow = dateCell.getRow();
    const firstCol = range.getColumn();
    const numCols = range.getNumColumns();
    sheet.getRange(headerRow, firstCol, 1, numCols + 1)
        .setBackground(bgColor);

    // (optional but explicit)
    dateCell.setBackground(bgColor);

    // ----- COLUMN H FOR THIS RANGE -----
    // Make column H for all rows in this range have bgColor and text uaLoc
    const firstDataRow = range.getRow();
    const uaLocValues = Array.from({ length: numOfDtAppts }, () => [uaLoc]);

    sheet.getRange(firstDataRow, 9, numOfDtAppts, 1) // column 8 = I
        .setBackground(bgColor)
        .setValues(uaLocValues);

    const reasonColumn = range.offset(0, 3, numOfDtAppts, 1);
    reasonColumn.setWrap(false);

    const numOfRowsInRange = range.getNumRows();
    range.offset(0, 0, numOfRowsInRange, 1).setNumberFormat('h:mma/p');

    const highPriorityColor = "#f9cb9c";

    // Create conditional formatting rules
    const rules = [
        // time column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo(SAME_FAM_STRING)
            .setBackground(highPriorityColor)
            .setRanges([range.offset(0, 0, numOfRowsInRange, 1)])
            .build(),

        // pt name column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextContains(UNKNOWN_SPECIES_STRING)
            .setBackground(highPriorityColor)
            .setRanges([range.offset(0, 1, numOfRowsInRange, 1)])
            .build(),

        // pt name column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextContains("unmatched")
            .setBackground(highPriorityColor)
            .setRanges([range.offset(0, 1, numOfRowsInRange, 1)])
            .build(),

        // deposit column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo("no")
            .setBackground(highPriorityColor)
            .setRanges([range.offset(0, 2, numOfRowsInRange, 1)])
            .build(),

        // first time column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo('yes')
            .setBackground(highPriorityColor)
            .setRanges([range.offset(0, 4, numOfRowsInRange, 1)])
            .build(),

        // attachments column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo("no attachments")
            .setBackground(highPriorityColor)
            .setRanges([range.offset(0, 5, numOfRowsInRange, 1)])
            .build(),

        // fractious column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo("yes")
            .setBackground(highPriorityColor)
            .setRanges([range.offset(0, 6, numOfRowsInRange, 1)])
            .build(),
    ];

    sheet.setConditionalFormatRules(rules);
}

function getNdaRangeForLoc(sheet, uaLoc, targetDateStr) {
    const headerText = `${uaLoc}\n${targetDateStr}`;
    const lastRow = sheet.getLastRow();
    if (!lastRow) {
        throw new Error('Sheet is empty when trying to find NDA range');
    }

    const colAValues = sheet.getRange(1, 1, lastRow, 1).getValues();

    // 1. Find the header row for this location/date
    let headerRow = null;
    for (let i = 0; i < colAValues.length; i++) {
        const cellVal = colAValues[i][0];
        if (cellVal === headerText) {
            headerRow = i + 1; // 1-based
            break;
        }
    }

    if (!headerRow) {
        throw new Error(`Could not find NDA header for ${headerText} in column A`);
    }

    const startRow = headerRow + 1; // first NDA row

    // 2. Find where this NDA block ends
    let endRow = lastRow;
    for (let i = startRow; i <= lastRow; i++) {
        const cellVal = colAValues[i - 1][0];

        // blank row -> end of block
        if (cellVal === '' || cellVal === null) {
            endRow = i - 1;
            break;
        }

        // next header (any cell with a newline) -> end before this row
        if (typeof cellVal === 'string' && cellVal.includes('\n') && i !== headerRow) {
            endRow = i - 1;
            break;
        }
    }

    if (endRow < startRow) {
        throw new Error(`No NDA rows found under header ${headerText}`);
    }

    const numRows = endRow - startRow + 1;
    const FIRST_COL = 1;   // A
    const NUM_COLS = 9;    // A:I

    return sheet.getRange(startRow, FIRST_COL, numRows, NUM_COLS);
}

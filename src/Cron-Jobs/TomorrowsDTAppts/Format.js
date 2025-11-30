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
    sheet.getRange(headerRow, firstCol, 1, numCols)
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

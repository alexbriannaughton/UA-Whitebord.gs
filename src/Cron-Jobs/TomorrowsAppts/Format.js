function formatNextDayApptsCells(sheet, range, numOfDtAppts, targetDateStr, uaLoc) {
    console.log('formatting next day range cells...');

    range.clearContent()
        .setWrap(true)
        .setFontColor("black")
        .setBackground("white")
        .setFontLine("none")
        .setBorder(false, false, false, false, false, false);

    // Apply borders to the full NDA row (Time through Location)
    range.offset(0, 0, numOfDtAppts, 10).setBorder(true, true, true, true, true, true);

    const bgColor = UA_LOC_BG_COLOR_MAP[uaLoc];

    // ----- DATE CELL / HEADER ROW -----
    const dateCell = range.offset(-1, 0, 1, 1);
    dateCell.setValue(`${uaLoc}-\n${targetDateStr}`);

    // Set the entire header row (for the range’s columns) to bgColor
    const headerRow = dateCell.getRow();
    const firstCol = range.getColumn();
    const numCols = range.getNumColumns();
    sheet.getRange(headerRow, firstCol, 1, numCols + 2)
        .setBackground(bgColor);

    // (optional but explicit)
    dateCell.setBackground(bgColor);

    const firstDataRow = range.getRow();
    const uaLocValues = Array.from({ length: numOfDtAppts }, () => [uaLoc]);

    sheet.getRange(firstDataRow, 10, numOfDtAppts, 1) // column 8 = I
        .setBackground(bgColor)
        .setValues(uaLocValues);

    const reasonColumn = range.offset(0, 3, numOfDtAppts, 1);
    reasonColumn.setWrap(false);

    range.offset(0, 0, numOfDtAppts, 1).setNumberFormat('h:mma/p');

}

// Baseline conditional formatting should be applied once (DT run) to avoid wiping CH rules later.
function setBaselineNdaConditionalFormatting(sheet) {
    // Clear core formatting for the sheet body (rows 2+) while leaving header labels intact
    sheet.getRange("A2:J")
        .clearContent()
        .setWrap(true)
        .setFontColor("black")
        .setBackground("white")
        .setFontLine("none")
        .setBorder(false, false, false, false, false, false);

    const headerRow = [
        "Time:",
        "Patient name:",
        "Deposit paid:",
        "Reason:",
        "First time?",
        "Records:",
        "Hx fractious:",
        "Traz/gaba:",
        "Appt type:",
        "Location:",
    ];

    sheet.getRange(1, 1, 1, headerRow.length)
        .setValues([headerRow])
        .setFontWeight("bold")
        .setBackground("#d9d9d9");

    sheet.setFrozenRows(1);

    const highPriorityColor = "#f9cb9c";
    const dataRowCount = Math.max(sheet.getMaxRows() - 2, 1); // start at row 3

    const rules = [
        // time column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo(SAME_FAM_STRING)
            .setBackground(highPriorityColor)
            .setRanges([sheet.getRange(3, 1, dataRowCount, 1)])
            .build(),

        // pt name column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextContains(UNKNOWN_SPECIES_STRING)
            .setBackground(highPriorityColor)
            .setRanges([sheet.getRange(3, 2, dataRowCount, 1)])
            .build(),

        // pt name column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextContains("unmatched")
            .setBackground(highPriorityColor)
            .setRanges([sheet.getRange(3, 2, dataRowCount, 1)])
            .build(),

        // deposit column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo("no")
            .setBackground(highPriorityColor)
            .setRanges([sheet.getRange(3, 3, dataRowCount, 1)])
            .build(),

        // first time column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo('yes')
            .setBackground(highPriorityColor)
            .setRanges([sheet.getRange(3, 5, dataRowCount, 1)])
            .build(),

        // attachments column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo("no attachments")
            .setBackground(highPriorityColor)
            .setRanges([sheet.getRange(3, 6, dataRowCount, 1)])
            .build(),

        // fractious column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo("yes")
            .setBackground(highPriorityColor)
            .setRanges([sheet.getRange(3, 7, dataRowCount, 1)])
            .build(),

        // appt type column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextContains('tech')
            .setBackground('#d9ead3')
            .setRanges([sheet.getRange(3, 9, dataRowCount, 1)])
            .build(),
    ];

    sheet.setConditionalFormatRules(rules);
}

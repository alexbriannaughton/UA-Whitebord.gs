// Format.js
function formatNextDayApptsCells(sheet, range, numOfDtAppts) {
    console.log('formatting next day range cells...');

    range.clearContent()
        .setWrap(true)
        .setFontColor("black")
        .setBackground("white")
        .setFontLine("none")
        .setBorder(false, false, false, false, false, false);

    range.offset(0, 0, numOfDtAppts).setBorder(true, true, true, true, true, true);

    const reasonColumn = range.offset(0, 3, numOfDtAppts, 1);
    reasonColumn.setWrap(false);

    const numOfRowsInRange = range.getNumRows();
    range.offset(0, 0, numOfRowsInRange, 1).setNumberFormat('h:mma/p');

    const highPriorityColor = "#f9cb9c";

    // Create conditional formatting rules
    const rules = [
        // time column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo(sameFamString)
            .setBackground(highPriorityColor)
            .setRanges([range.offset(0, 0, numOfRowsInRange, 1)])
            .build(),

        // pt name column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextContains(unknownSpeciesString)
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
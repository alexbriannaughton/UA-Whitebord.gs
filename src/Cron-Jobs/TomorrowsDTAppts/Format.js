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

    range.offset(0, 2, range.getNumRows(), 1).removeCheckboxes();

    const reasonColumn = range.offset(0, 3, numOfDtAppts, 1);
    reasonColumn.setWrap(false);

    const highPriorityColor = "#f9cb9c";

    // Create conditional formatting rules
    const rules = [
        // time column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo(sameFamString)
            .setBackground(highPriorityColor)
            .setRanges([sheet.getRange("K15:K85")])
            .build(),

        // pt name column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextContains("unknown species")
            .setBackground(highPriorityColor)
            .setRanges([sheet.getRange("L15:L85")])
            .build(),

        // pt name column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextContains("unmatched")
            .setBackground(highPriorityColor)
            .setRanges([sheet.getRange("L15:L85")])
            .build(),

        // deposit column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo("no")
            .setBackground(highPriorityColor)
            .setRanges([sheet.getRange("M15:M85")])
            .build(),

        // first time column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo("yes")
            .setBackground(highPriorityColor)
            .setRanges([sheet.getRange("O15:O85")])
            .build(),

        // attachments column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo("no attachments")
            .setBackground(highPriorityColor)
            .setRanges([sheet.getRange("P15:P85")])
            .build(),

        // fractious column
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextEqualTo("no attachments")
            .setBackground(highPriorityColor)
            .setRanges([sheet.getRange("P15:P85")])
            .build(),
    ];

    // Apply the conditional formatting rules to the sheet
    sheet.setConditionalFormatRules(rules);
}
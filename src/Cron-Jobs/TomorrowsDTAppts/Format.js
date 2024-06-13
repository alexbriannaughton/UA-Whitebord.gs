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

    const depositPaidColumn = range.offset(0, 2, numOfDtAppts, 1);
    depositPaidColumn.insertCheckboxes();

    const depositCheckboxRule = SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('FALSE')
        .setBackground(highPriorityColor)
        .setRanges([depositPaidColumn])
        .build();

    sheet.setConditionalFormatRules([depositCheckboxRule]);
}
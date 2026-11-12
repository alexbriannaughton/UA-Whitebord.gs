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
    sheet.getRange(headerRow, firstCol, 1, 10)
        .setBackground(bgColor);

    // (optional but explicit)
    dateCell.setBackground(bgColor);

    const firstDataRow = range.getRow();
    const uaLocValues = Array.from({ length: numOfDtAppts }, () => [uaLoc]);

    sheet.getRange(firstDataRow, 10, numOfDtAppts, 1) // column 8 = I
        .setBackground(bgColor)
        .setValues(uaLocValues);

    // const reasonColumn = range.offset(0, 3, numOfDtAppts, 1);
    // reasonColumn.setWrap(false);

    range.offset(0, 0, numOfDtAppts, 1).setNumberFormat('h:mma/p');

}

// Formatting is independent of data replacement; never clear all locations.
function setBaselineNdaConditionalFormatting(sheet) {
    const headerRow = [
        "Time:",
        "Patient name:",
        "Deposit paid appt status?",
        "Reason:",
        "First time?",
        "Records:",
        "Demeanor alerts?",
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
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextContains('Unavailable')
            .setBackground(highPriorityColor)
            .setRanges([sheet.getRange(3, 2, dataRowCount, 7)])
            .build(),
        SpreadsheetApp.newConditionalFormatRule()
            .whenTextContains('Pending')
            .setBackground(highPriorityColor)
            .setRanges([sheet.getRange(3, 2, dataRowCount, 7)])
            .build(),
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

function withNdaSheetLock(action) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('NDA sheet busy; retry the update');
  try {
    return action();
  } finally {
    try { SpreadsheetApp.flush(); }
    finally { lock.releaseLock(); }
  }
}

function findNdaSection(sheet, location) {
  const lastRow = sheet.getLastRow();
  const values = lastRow ? sheet.getRange(1, 1, lastRow, 1).getValues() : [];
  const headers = values.flatMap((row, index) =>
    typeof row[0] === 'string' && /^(DT|CH|WC)-\n/.test(row[0])
      ? [{ row: index + 1, text: row[0] }] : []);
  const matching = headers.filter(header => header.text.startsWith(`${location}-\n`));
  if (matching.length > 1) throw new Error('Duplicate NDA location sections require review');
  if (!matching.length) return null;
  const header = matching[0];
  const next = headers.find(other => other.row > header.row);
  return { headerRow: header.row, text: header.text, rows: (next?.row || lastRow + 1) - header.row - 1 };
}

function ndaAnimalId(link) {
  if (!link) return null;
  const urls = [link.getLinkUrl(), ...link.getRuns().map(run => run.getLinkUrl())];
  for (const url of urls) {
    const match = url && url.match(/[?&]recordclass=Animal&recordid=(\d+)(?:&|$)/);
    if (match) return match[1];
  }
  return null;
}

function publishNdaSection(sheet, location, targetDateStr, appts) {
  // Materialize rows before acquiring the short sheet lock. No ezyVet calls
  // occur while replacing a section, and another location is never cleared.
  const snapshot = prepareNdaRows(appts);
  withNdaSheetLock(() => {
    const section = findNdaSection(sheet, location);
    const expectedHeader = `${location}-\n${targetDateStr}`;
    if (section?.text === expectedHeader && section.rows) {
      // A same-date retry retains edits on matched patients while adding new
      // appointments and removing ones no longer in the active source list.
      const old = sheet.getRange(section.headerRow + 1, 1, section.rows, 10);
      const values = old.getValues();
      const rich = old.getRichTextValues();
      const byAnimal = new Map();
      for (let i = 0; i < values.length; i++) {
        const id = ndaAnimalId(rich[i][1]);
        if (!id) continue;
        if (!byAnimal.has(id)) byAnimal.set(id, []);
        byAnimal.get(id).push({ values: values[i], rich: rich[i] });
      }
      for (let i = 0; i < appts.length; i++) {
        const saved = byAnimal.get(String(appts[i].appointment.details.animal_id))?.shift();
        if (saved) { snapshot.values[i] = saved.values; snapshot.rich[i] = saved.rich; }
      }
    }
    const header = section?.headerRow || Math.max(2, sheet.getLastRow() + 1);
    const oldRows = section?.rows || 0;
    if (section && oldRows < appts.length) sheet.insertRowsAfter(header + oldRows, appts.length - oldRows);
    if (section && oldRows > appts.length) sheet.deleteRows(header + appts.length + 1, oldRows - appts.length);
    if (!section && header + appts.length > sheet.getMaxRows()) {
      sheet.insertRowsAfter(sheet.getMaxRows(), header + appts.length - sheet.getMaxRows());
    }
    const range = sheet.getRange(header + 1, 1, appts.length, 10);
    formatNextDayApptsCells(sheet, range, appts.length, targetDateStr, location);
    putDataOnSheet(appts, range, snapshot);
  });
}

function enrichNdaSection(sheet, location, targetDateStr, appts) {
  const snapshot = prepareNdaRows(appts);
  const byAnimal = new Map(appts.map((appt, i) => [String(appt.appointment.details.animal_id), i]));
  withNdaSheetLock(() => {
    const section = findNdaSection(sheet, location);
    if (!section || section.text !== `${location}-\n${targetDateStr}`) throw new Error('NDA section date changed');
    if (!section.rows) return;
    const range = sheet.getRange(section.headerRow + 1, 1, section.rows, 10);
    const values = range.getValues();
    const rich = range.getRichTextValues();
    // Only fill unresolved details. Times, deposits, reasons, new/deleted rows
    // and staff-entered values are authoritative while enrichment is in flight.
    for (const column of [1, 4, 5, 6, 7]) {
      let changed = false;
      const output = values.map((row, i) => {
        const id = ndaAnimalId(rich[i][1]);
        const source = byAnimal.get(id);
        const unresolved = row[column] === NDA_PENDING_VALUE || row[column] === NDA_UNAVAILABLE_VALUE
          || (column === 1 && row[column] === NDA_PENDING_PATIENT);
        const replacement = source !== undefined && unresolved ? snapshot.rich[source][column] : null;
        if (replacement && replacement.getText() !== String(row[column])) changed = true;
        return [replacement || rich[i][column] || simpleTextToRichText(String(row[column] ?? ''))];
      });
      if (changed) range.offset(0, column, section.rows, 1).setRichTextValues(output);
    }
  });
}

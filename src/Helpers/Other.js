function makeLink(text, webAddress) {
  return SpreadsheetApp
    .newRichTextValue()
    .setText(text)
    .setLinkUrl(webAddress)
    .build();
};

function createCheckbox() {
  return SpreadsheetApp
    .newDataValidation()
    .requireCheckbox()
    .setAllowInvalid(false)
    .build();
};

// for this appointments room, findTargetCell() returns the range object for the cell that we want to manipulate, i.e. the ready cell or the ok to checkout cell
// returns undefined if we do not find a cell that contains a link with this appointments consult id or contact id
function findTargetCell(
  location,
  sheet,
  appointment,
  targetCellRowsBelowMain // number of rows down that the target cell is from the patient cell
) {
  const locationPtCellRanges = getLocationPtCellRanges(location, sheet);
  return checkLinksForID(locationPtCellRanges, appointment, targetCellRowsBelowMain);
};

function getLocationPtCellRanges(location, sheet) {
  // if location === 'WC', these are the only coords
  const possCoords = ['C4:C4', 'D4:D4', 'E4:E4', 'F4:F4', 'G4:G4'];
  if (location === 'DT') possCoords.push('H4:H4', 'I4:I4');
  else if (location === 'CH') {
    possCoords.push('H4:H4', 'I4:I4', 'C14:C14', 'D14:D14', 'E14:E14', 'F14:F14', 'G14:G14', 'H14:H14', 'I14:I14');
  }
  return sheet.getRangeList(possCoords).getRanges();
};

function checkLinksForID(locationPtCellRanges, appointment, targetCellRowsBelowMain) {
  for (ptCell of locationPtCellRanges) {
    const runs = ptCell.getRichTextValue().getRuns();
    const link = getLinkFromRuns(runs);
    if (!link) continue;
    if (foundCorrectRoom(link, appointment)) {
      return ptCell.offset(targetCellRowsBelowMain, 0);
    }
  }
};

function foundCorrectRoom(link, appointment) {
  const linkIDInfo = link.split('?')[1] // this is the query string
    .split('&') // this is the params
    .map((str) => str.split('=')[1]); // this is [idType, id]
  const linkIDType = linkIDInfo[0];
  const linkID = parseInt(linkIDInfo[1]);
  return (linkIDType === 'Consult' && linkID === appointment.consult_id) || (linkIDType === 'Contact' && linkID === appointment.contact_id);
};

// findEmptyRow() returns the range for the highest unpopulated row within the given range
// will return null if there's already a link with this appointment's consult id within the range
// will return undefined if theres no unpopulated rows left within this range
function findEmptyRow(range, consultID, keyToConsultID) {
  const rowContents = range.getValues();
  const allRichTextValues = range.getRichTextValues();

  let emptyRowRange;
  for (let i = 0; i < rowContents.length; i++) {
    const cellRichText = allRichTextValues[i][keyToConsultID];
    const allRichTextsInCell = cellRichText.getRuns();

    for (const richText of allRichTextsInCell) {
      const link = richText.getLinkUrl();
      // if we find that this cell has the link with the incoming consult id, that means it's already here, so return null
      if (link?.includes(consultID)) return null;
    }

    // if we haven't already found the highest empty row AND
    // every item within this rowContents array is falsy (or just a space lol),
    // this is the highest empty row
    if (!emptyRowRange && rowContents[i].every(cellContents => !cellContents || /^\s*$/.test(cellContents))) {
      emptyRowRange = range.offset(i, 0, 1);
    }

  }

  return emptyRowRange;
};

function getLinkFromRuns(runs) {
  for (const run of runs) {
    const link = run.getLinkUrl();
    if (link) return link;
  }
}
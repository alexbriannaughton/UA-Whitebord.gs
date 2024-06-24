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

// findRow() returns the range for the highest unpopulated row within the given range
// will return null if there's already a link with this appointment's consult id within the range
// will return undefined if theres no unpopulated rows left within this range
function findRow(range, id, keyToID) {
  const rowContents = range.getValues();
  const allRichTextValues = range.getRichTextValues();

  let highestEmptyRow;
  for (let i = 0; i < rowContents.length; i++) {
    const cellRichText = allRichTextValues[i][keyToID];
    const allRichTextsInCell = cellRichText.getRuns();

    for (const richText of allRichTextsInCell) {
      const link = richText.getLinkUrl();
      const existingID = link?.split('=').at(-1);
      // if we find that this cell has the link with the incoming consult id, that means it's already here, so return null
      if (existingID === String(id)) {
        return {
          existingRow: range.offset(i, 0, 1),
          highestEmptyRow: null
        };
      }
    }

    // if we haven't already found the highest empty row AND
    // this is the highest empty row
    if (!highestEmptyRow && rowContents[i].every(cellIsEmpty)) {
      highestEmptyRow = range.offset(i, 0, 1);
    }

  }

  return {
    existingRow: null,
    highestEmptyRow
  };
};

function getLinkFromRuns(runs) {
  for (const run of runs) {
    const link = run.getLinkUrl();
    if (link) return link;
  }
}

function cellIsEmpty(cellContents) {
  return !cellContents || /^\s*$/.test(cellContents);
}

function removeVetstoriaDescriptionText(descriptionString) {
  if (descriptionString.startsWith('VETSTORIA')) {
    const newDescString = descriptionString
      ?.match(/\(([\s\S]*?)\)/g)
      ?.at(-1)
      ?.slice(1, -1);
    if (newDescString) {
      return newDescString;
    }

    const arr = descriptionString.split(' - ');
    if (arr.length === 2) {
      return arr[1];
    }
  }
  return descriptionString;
}

function simpleTextToRichText(text) {
  return SpreadsheetApp.newRichTextValue().setText(text).build();
}
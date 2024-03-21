// appointment.status_id 18 = room 1 at all locations = C3, C4, C5
// appointment.status_id 25 = room 2 at all location = D3, D4, D5
// appointment.status_id 26 = room 3 at all location = E3, E4, E5
// appointment.status_id 27 = room 4 at all location = F3, F4, F5
// appointment.status_id 28 = room 5 at all location = G3, G4, G5
// appointment.status_id 29 = room 6 = CH cells: C13, C14, C15, DT cells: H3, H4, H5
// appointment.status_id 30 = room 7 = CH cells: D13, D14, D15, DT cells: I3, I4, I5
// appointment.status_id 31 = room 8 = CH cells: E13, E14, E15 
// appointment.status_id 32 = room 9 = CH cells: F13, F14, F15 
// appointment.status_id 33 = room10 = CH cells: G13, G14, G15
// appointment.status_id 36 = room11 = CH cells: H13, H14, H15
// status 40 = cat lobby = CH cells: H3, H4, H5 & I3, I4, I5
// status 39 = dog lobby = CH cells: I13, I14, I15
function moveToRoom(appointment) {
  const location = whichLocation(appointment.resources[0].id);

  // if we're moving into a room that doesn't exist... don't do that
  if ((appointment.status_id >= 31 && location === 'DT') || (appointment.status_id >= 29 && location === 'WC')) {
    return stopMovingToRoom(appointment);
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);

  const [roomRange, incomingAnimalText, ptCell] = parseTheRoom(sheet, appointment, location) || [];

  // if parseTheRoom returns us a truthy roomRange, we're good to handle a normal, empty room
  if (roomRange) populateEmptyRoom(appointment, roomRange, incomingAnimalText, location, ptCell);

  return;

};

function populateEmptyRoom(appointment, roomRange, incomingAnimalText, location, ptCell) {
  // set bg color of entire room
  roomRange.offset(0, 0, 8, 1)
    .setBackground(
      getRoomColor(appointment.type_id, appointment.resources[0].id)
    );

  // time cell
  roomRange.offset(0, 0, 1, 1)
    .setValue(getTime(appointment.modified_at));

  // name/species/link cell
  const link = makeLink(
    incomingAnimalText,
    `${sitePrefix}/?recordclass=Consult&recordid=${appointment.consult_id}`
  );
  ptCell.setRichTextValue(link);

  // reason cell
  roomRange.offset(2, 0, 1, 1)
    .setValue(`${appointment.description}${techText(appointment.type_id)}`);

  // mark room as dirty
  roomRange.offset(8, 0, 1, 1)
    .setValue('d');

  // delete from the waitlist
  deleteFromWaitlist(location, appointment.consult_id);

  return;
}

// parseTheRoom() does too much currently. it:
// grabs the range for the room
// checks if the room is occupied
// checks if we are handling a multiple pet room and, if so, handles it
// if parseTheRoom() finds that this is a normal, empty room, it will return 3 things:
// 1 - the range for the room (range object)
// 2 - the incoming patient name text (string)
// 3 - the range for the patient name cell (range object)
// if this is not a normal, empty room, parseTheRoom() will return undefined
function parseTheRoom(
  sheet,
  appointment,
  location,
  rangeForSecondCatLobbyColumn // will be undefined unless the first cat lobby column is unavailable
) {

  const roomRange = rangeForSecondCatLobbyColumn === undefined
    ? findRoomRange(sheet, appointment.status_id, location)
    : rangeForSecondCatLobbyColumn;
  const ptCell = roomRange.offset(1, 0, 1, 1);
  const ptCellRuns = ptCell.getRichTextValue().getRuns();
  const curLink = getLinkFromRuns(ptCellRuns);
  // if this appointment is already in the room, don't worry about it
  // we check this by comparing the link that's currently in the cell with the incoming appt's consult id
  if (curLink?.includes(appointment.consult_id)) {
    // we return deleteFromWaitlist bc there's a chance that this execution is a retry
    // this assumes the logic that if it's in a room, it doesnt need to be on the waitlist
    deleteFromWaitlist(location, appointment.consult_id);
    return;
  }

  const [animalName, animalSpecies] = getAnimalInfo(appointment.animal_id);
  const incomingAnimalText = `${animalName} (${animalSpecies})`;

  const roomValues = roomRange.getValues();

  // if the room's cells are not fully blank,
  if (!roomIsEmpty(roomValues)) {
    const isFirstCatLobbyCol = appointment.status_id === 40 && roomRange.getColumn() === 8;
    
    // another check to see if incoming appointment is already in the room, as multiple pet room will not carry the consult id
    if (roomValues[1][0].includes(incomingAnimalText)) {
      stopMovingToRoom(appointment);
      return;
    }

    if (!curLink) { // if theres not a link in the ptCell,
      if (isFirstCatLobbyCol) { // and if we just checked the first cat lobby column,
        return parseTheRoom( // check the second cat lobby column
          sheet,
          appointment,
          location,
          roomRange.offset(0, 1) // this is the range for the second cat lobby column
        )
      }
      else stopMovingToRoom(appointment); // otherwise we're done here bc we dont want to overwrite whatever is in the column
      return;
    }

    // else we are checking a room which is not blank, that has a link that doesnt have the incoming appointment's consult id
    // i.e. we are checking to see if this is a multiple pet room
    let alreadyMultiplePets = false;
    let curContactID;

    // then, check if the animal currently in the room has the same contact ID (owner) as the incoming animal
    // first, grab the id at the end of the link
    const curID = curLink.split('=')[2];

    // if this link contains a contact id, that means there are already multiple pets in this room
    if (curLink.includes('Contact')) {
      curContactID = curID;
      alreadyMultiplePets = true;
    }
    else curContactID = getContactIDFromConsultID(curID); // otherwise this is a consult id. use it to get the contact ID

    // if that contact id matches the contact id of the appointment we're trying to move to this room, handle a multiple pet room
    if (parseInt(curContactID) === appointment.contact_id) {
      handleMultiplePetRoom(
        appointment,
        incomingAnimalText,
        ptCell,
        alreadyMultiplePets,
        roomRange,
        roomValues
      );

      deleteFromWaitlist(location, appointment.consult_id);

      return;
    }

    // else this is not a multiple pet room...


    if (isFirstCatLobbyCol) {  // if we are checking the first cat lobby cell range
      // we want to check the second cat lobby cell range
      return parseTheRoom(
        sheet,
        appointment,
        location,
        roomRange.offset(0, 1) // this is the range for the second cat lobby column
      );
    }

    // otherwise dont move to room because the room is not empty
    stopMovingToRoom(appointment);
    return;
  }

  // otherwise, this is a normal empty room
  return [roomRange, incomingAnimalText, ptCell];
}

// note that we have already weeded out status ids >= 31 at DT and status ids >= 29 at WC earlier in moveToRoom()
function findRoomRange(sheet, statusID, location) {
  // we're finding the time cell to use as a starting place

  // all rooms at WC, all rooms at DT and rooms 1-5 at CH are handled similarly:
  let timeRow = 3;
  let timeColumn = statusID === 18
    ? 'C' // for room one (status_id 18) just assign to column C
    : String.fromCharCode(statusID + 43);  // otherwise, statusID + 43 = char code for the column we're looking for

  // for the rest of the rooms at CH:
  // status ids for rooms 6 - 11 and dog/cat lobby statuses are 29 and greater
  if (location === 'CH' && statusID >= 29) {
    // handle for cat or dog lobby statuses
    const isCatLobbyStatus = statusID === 40;
    if (isCatLobbyStatus || statusID === 39) {
      timeRow = isCatLobbyStatus
        ? 3 : 13;
      timeColumn = isCatLobbyStatus
        ? 'H' : 'I';
    }

    // else we're handling for rooms 6 - 11
    else {
      timeRow = 13;
      timeColumn = statusID === 36
        ? 'H' // if room 11 (status id = 36), just assign to column H
        : String.fromCharCode(statusID + 38); // otherwise, statusID + 38 = char code for the correct column

    }
  }

  // return the range for the room up through the dvm row
  return sheet.getRange(`${timeColumn}${timeRow}:${timeColumn}${timeRow + 5}`);
}

function getRoomColor(typeID, resourceID) {
  // if it's IM make the background purple
  const typeCategory = typeIDToCategoryMap.get(typeID);
  if (typeCategory === 'IM' || resourceID === 65 || resourceID === 27) {
    return typeCategoryToColorMap.get('IM');
  }
  if (typeCategory === 'tech') {
    return '#90EE90'; // bright green
  }
  const color = typeCategoryToColorMap.get(typeCategory);
  if (color) return color;
  const procedureResources = new Set([
    29, 30, // ch procedure columns
    57, 58, // dt procedure columns
    61, 62 // wc procedure columns
  ])
  if (procedureResources.has(resourceID)) {
    // if type is not covered in name to color map, but it's in the procedure column, make it light orangish
    return '#fce5cd';
  }
  // else do the standard gray
  return '#f3f3f3';
}

function techText(typeID) {
  return typeID === 19 || typeID === 85
    ? "(TECH)"
    : "";
}

function stopMovingToRoom(appointment) {
  // add it to the waitlist if it was just created
  if (appointment.created_at === appointment.modified_at) {
    addToWaitlist(appointment);
  }
  return;
}

function handleMultiplePetRoom(
  appointment,
  incomingAnimalText,
  ptCell,
  alreadyMultiplePets,
  roomRange,
  roomValues
) {
  const curAnimalText = roomValues[1][0];
  const curAnimalReasonText = roomValues[2][0];

  const newPtCellText = `${curAnimalText} & ${incomingAnimalText}`;
  const reasonText = alreadyMultiplePets
    ? `${curAnimalReasonText}//\n${incomingAnimalText.split(" (")[0]}: ${appointment.description}${techText(appointment.type_id)}`
    : `${curAnimalText.split(" (")[0]}: ${curAnimalReasonText}//\n${incomingAnimalText.split(" (")[0]}: ${appointment.description}${techText(appointment.type_id)}`;

  // if either of the appointments is not a tech, make it gray
  if (!reasonText.includes('(TECH)') || !incomingAnimalText.includes('(TECH)')) {
    roomRange.offset(0, 0, 8, 1).setBackground('#f3f3f3');
  }

  // multiple pet room links take you to the owner's tab in ezyvet (the contact record)
  const link = makeLink(
    newPtCellText,
    `${sitePrefix}/?recordclass=Contact&recordid=${appointment.contact_id}`
  );
  ptCell.setRichTextValue(link);

  const reasonCell = roomRange.offset(2, 0, 1, 1);
  reasonCell.setValue(reasonText);

  return;
}

function getContactIDFromConsultID(consultID) {
  const url1 = `${proxy}/v1/consult/${consultID}`;
  const animalID = fetchAndParse(url1).items[0].consult.animal_id;

  const url2 = `${proxy}/v1/animal/${animalID}`;
  const contactID = fetchAndParse(url2).items[0].animal.contact_id;

  return contactID;
}

function deleteFromWaitlist(location, consultID) {
  if (location === 'DT') return;
  const waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`${location} Wait List`);
  const patientNameRichText = waitlistSheet.getRange(`C7:D75`).getRichTextValues();

  for (let i = 0; i < patientNameRichText.length; i++) {
    const runs = patientNameRichText[i][0].getRuns();
    const link = getLinkFromRuns(runs);
    if (link?.includes(consultID)) {
      waitlistSheet.deleteRow(i + 7);
      return;
    }
  }

  return;
}

function roomIsEmpty(roomValues) {
  return roomValues.every(roomVal => roomVal.every(cellContents => !cellContents || /^\s*$/.test(cellContents)));
}
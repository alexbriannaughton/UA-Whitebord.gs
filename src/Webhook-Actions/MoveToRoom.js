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
function moveToRoom(appointment, uaLocSheetName, locationToRoomCoordsMap) {
  const roomCoords = locationToRoomCoordsMap[uaLocSheetName]; // change this so it gets all 9 cells

  // if we're moving into a room that doesn't exist... don't do that
  if (!roomCoords) return stopMovingToRoom(appointment, uaLocSheetName);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(uaLocSheetName);

  const fullRoomRange = sheet.getRange(roomCoords);
  const [roomRange, incomingAnimalText, allRoomVals] =
    parseTheRoom(
      sheet,
      appointment,
      uaLocSheetName,
      fullRoomRange,
    ) || [];

  // if parseTheRoom returns us a truthy roomRange, we're good to handle a normal, empty room
  if (roomRange) populateEmptyRoom(appointment, roomRange, incomingAnimalText, uaLocSheetName, allRoomVals);

  return;

};

function populateEmptyRoom(appointment, roomRange, incomingAnimalText, uaLocSheetName, allRoomVals) {
  roomRange.offset(0, 0, 8, 1).setBackground(getRoomColor(appointment));

  const timeText = convertEpochToUserTimezone(appointment.modified_at);
  const timeRichText = simpleTextToRichText(timeText);

  const link = makeLink(
    incomingAnimalText,
    `${SITE_PREFIX}/?recordclass=Consult&recordid=${appointment.consult_id}`
  );

  const reasonText = `${appointment.description}${techText(appointment.type_id)}`;
  const reasonRichText = simpleTextToRichText(reasonText);

  const richTextVals = [
    [timeRichText],
    [link],
    [reasonRichText],
    [simpleTextToRichText(allRoomVals[3])],
    [allRoomVals[4]],
    [simpleTextToRichText(allRoomVals[5])],
    [simpleTextToRichText(allRoomVals[6])],
    [simpleTextToRichText(allRoomVals[7])],
    [simpleTextToRichText('d')]
  ];

  roomRange.offset(0, 0, 9, 1).setRichTextValues(richTextVals);

  // delete from the waitlist
  deleteFromWaitlist(uaLocSheetName, appointment.consult_id);

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
  uaLocSheetName,
  fullRoomRange,
  rangeForSecondaryColumn, // will be undefined unless the original column unavailable
) {

  const roomRange = rangeForSecondaryColumn ?? fullRoomRange;
  const allRoomVals = roomRange.getValues();

  const ptCell = roomRange.offset(1, 0, 1, 1);
  const ptCellRuns = ptCell.getRichTextValue().getRuns();
  const curLink = getLinkFromRuns(ptCellRuns);
  const curLinkID = curLink?.split('=').at(-1);
  // if this appointment is already in the room, don't worry about it
  // we check this by comparing the link that's currently in the cell with the incoming appt's consult id
  if (curLinkID === String(appointment.consult_id)) {
    // deleteFromWaitlist bc there's a chance that this execution is a retry
    // this assumes the logic that if it's in a room, it doesnt need to be on the waitlist
    deleteFromWaitlist(uaLocSheetName, appointment.consult_id);
    return;
  }

  const [animalName, animalSpecies] = getAnimalInfo(appointment.animal_id);
  const incomingAnimalText = `${animalName} (${animalSpecies})`;

  const roomValues = allRoomVals.slice(0, -3);

  // return normal empty room stuff
  if (roomIsOkToPopulateWithData(roomValues, uaLocSheetName)) {
    return [roomRange, incomingAnimalText, allRoomVals];
  }

  // another check to see if incoming appointment is already in the room, as multiple pet room will not carry the consult id
  if (roomValues[1][0].includes(incomingAnimalText)) {
    return stopMovingToRoom(appointment, uaLocSheetName);
  }

  const col = roomRange.getColumn();
  const isFirstCatLobbyCol = appointment.status_id === CAT_LOBBY_STATUS_ID && col === 8;
  const isFirstThreeWcSxCols = appointment.status_id === WC_SX_LOBBY_STATUS_ID && [6, 7, 8].includes(col);

  if (curLink) { // if there's a link here, check if its a multiple pet room
    let alreadyMultiplePets = false;
    let curContactID;

    // check if the animal currently in the room has the same contact ID (owner) as the incoming animal

    // if this link contains a contact id, that means there are already multiple pets in this room
    if (curLink.includes('Contact')) {
      curContactID = curLinkID;
      alreadyMultiplePets = true; // only multiple pet rooms will have contact link
    }
    else curContactID = getContactIDFromConsultID(curLinkID); // otherwise this is a consult id. use it to get the contact ID

    // if that contact id matches the contact id of the appointment we're trying to move to this room, handle a multiple pet room
    if (Number(curContactID) === appointment.contact_id) {
      populateMultiplePetRoom(
        appointment,
        incomingAnimalText,
        ptCell,
        alreadyMultiplePets,
        roomRange,
        roomValues,
      );

      deleteFromWaitlist(uaLocSheetName, appointment.consult_id);

      return;
    }
  }

  // else this is not a room that we can move into
  if (isFirstCatLobbyCol || isFirstThreeWcSxCols) { // if were checking the first of multiple possible columns
    return parseTheRoom( // check the next column over
      sheet,
      appointment,
      uaLocSheetName,
      fullRoomRange,
      roomRange.offset(0, 1) // range for the next column over
    );
  }

  // otherwise we're done here bc we dont want to overwrite whatever is in the column
  return stopMovingToRoom(appointment, uaLocSheetName);

}

function getRoomColor(appointment) {
  const resourceId = appointment.resources[0].id; // number
  const typeId = appointment.type_id; // number

  let typeCategory = TYPE_ID_TO_CATEGORY.get(typeId);
  if (IM_RESOURCE_IDS.includes(resourceId)) {
    typeCategory = IM_APPT_CATEGORY;
  }
  else if (SCHEDULED_DVM_APPTS_RESOURCE_IDS.includes(resourceId)) {
    typeCategory = CH_AND_WC_SCHEDULED_APPT_CATEGORY;
  }

  // if special type cateogry, use its color
  if (typeCategory?.color) return typeCategory.color;

  // if in proecure column make it orangish, else make it grey
  return SCHEDULED_PROCEDURES_RESOURCE_IDS.includes(resourceId)
    ? OTHER_APPT_COLOR : STANDARD_GREY;
}

function techText(typeID) {
  return typeID === 19 || typeID === 85
    ? TECH_IN_ROOM_TEXT
    : "";
}

function stopMovingToRoom(appointment, uaLocSheetName) {
  // add it to the waitlist if it was just created
  if (appointment.created_at === appointment.modified_at) {
    addToWaitlist(appointment, uaLocSheetName);
  }
  return;
}

function populateMultiplePetRoom(
  appointment,
  incomingAnimalText,
  ptCell,
  alreadyMultiplePets,
  roomRange,
  roomValues,
) {
  const curAnimalText = roomValues[1][0];
  const curAnimalReasonText = roomValues[2][0];

  const newPtCellText = `${curAnimalText} & ${incomingAnimalText}`;
  const reasonText = alreadyMultiplePets
    ? `${curAnimalReasonText}//\n${incomingAnimalText.split(" (")[0]}: ${appointment.description}${techText(appointment.type_id)}`
    : `${curAnimalText.split(" (")[0]}: ${curAnimalReasonText}//\n${incomingAnimalText.split(" (")[0]}: ${appointment.description}${techText(appointment.type_id)}`;

  if (!reasonText.includes(TECH_IN_ROOM_TEXT) || !incomingAnimalText.includes(TECH_IN_ROOM_TEXT)) {
    const bgColor = CH_AND_WC_SCHEDULED_APPT_CATEGORY.ezyVetTypeIds.includes(appointment.type_id)
      ? CH_AND_WC_SCHEDULED_APPT_CATEGORY.color // flamingo pink
      : STANDARD_GREY;
    roomRange.offset(0, 0, 8, 1).setBackground(bgColor);
  }

  // multiple pet room links take you to the owner's tab in ezyvet (the contact record)
  const link = makeLink(
    newPtCellText,
    `${SITE_PREFIX}/?recordclass=Contact&recordid=${appointment.contact_id}`
  );
  ptCell.setRichTextValue(link);

  const reasonCell = roomRange.offset(2, 0, 1, 1);
  reasonCell.setValue(reasonText);

  return;
}

function getContactIDFromConsultID(consultID) {
  const url1 = `${EV_PROXY}/v1/consult/${consultID}`;
  const animalID = fetchAndParse(url1).items[0].consult.animal_id;

  const url2 = `${EV_PROXY}/v1/animal/${animalID}`;
  const contactID = fetchAndParse(url2).items[0].animal.contact_id;

  return contactID;
}

function deleteFromWaitlist(uaLocSheetName, consultID) {
  if (uaLocSheetName === DT_SHEET_NAME) return;
  const waitlistSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`${uaLocSheetName} Wait List`);
  const patientNameRichText = waitlistSheet.getRange(`C7:D75`).getRichTextValues();

  for (let i = 0; i < patientNameRichText.length; i++) {
    const runs = patientNameRichText[i][0].getRuns();
    const link = getLinkFromRuns(runs);
    const curLinkID = link?.split('=').at(-1);
    if (curLinkID === String(consultID)) {
      waitlistSheet.deleteRow(i + 7);
      return;
    }
  }

  return;
}

function roomIsOkToPopulateWithData(roomValues, uaLocSheetName) {
  // DT requests to be allowed to populate a room while there is data 'in the room' on whiteboard
  return uaLocSheetName === DT_SHEET_NAME
    ? roomValues[1].every(cellIsEmpty)
    : roomValues.slice(0, 2).every(roomVal => roomVal.every(cellIsEmpty));
}
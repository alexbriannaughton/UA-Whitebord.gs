// receive webhooks here. e = the webhook event
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const apptItems = params.items;

    for (const { appointment } of apptItems) {
      handleAppointment(params.meta.event, appointment);
    }

    return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.JSON);
  }

  catch (error) {
    // wait 3 seconds and try a second time if we get an error
    console.log('error after the first try:', error);
    Utilities.sleep(3000);
    try {
      const params = JSON.parse(e.postData.contents);
      console.log('second try params:', params);
      const apptItems = params.items;

      for (const { appointment } of apptItems) {
        handleAppointment(params.meta.event, appointment);
      }

      return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.JSON);
    }

    catch (error) {
      console.log('second error hit:', error);
      throw error;
    };

  }

};

// handle the details we care about
function handleAppointment(webhookType, appointment) {
  if (!isTodayInSeattle(appointment.start_at) || !appointment.active) return;

  // if it has a room status (no matter the webhookType), move it to a room
  if (isRoomStatus(appointment.status_id)) {
    return moveToRoom(appointment);
  }

  else if (webhookType === "appointment_created") {
    return handleCreatedAppointment(appointment);
  }

  else if (webhookType === "appointment_updated") {
    return handleUpdatedAppointment(appointment);
  };

  return;

}

function handleCreatedAppointment(appointment) {
  const apptTypeID = appointment.type_id;

  // appointment type 37 is a walk in and appointment type 77 is a new client walk in
  if (apptTypeID === 37 || apptTypeID === 77) {
    return addToWaitlist(appointment);
  }

  // appointment type 19 is a tech appointment
  else if (apptTypeID === 19) {
    return addTechAppt(appointment);
  }

  return;

};

function handleUpdatedAppointment(appointment) {
  const apptStatusID = appointment.status_id;

  // status id 17 is 'on wait list'
  if (apptStatusID === 17) {
    return addToWaitlist(appointment);
  }
  // status id 19 is 'ok to check out'
  else if (apptStatusID === 19) {
    return okToCheckOut(appointment);
  }
  // status 22 is 'ready' appointment status
  else if (apptStatusID === 22) {
    return handleReadyStatus(appointment);
  }
  // status 23 is 'add to tech column' appointment status
  else if (apptStatusID === 23) {
    return addTechAppt(appointment);
  }
  // status id 34 is 'inpatient' status
  else if (apptStatusID === 34) {
    return addInPatient(appointment);
  }

  return;

};

function doGet(_e) {
  const allRooms = {};

  const chRooms = {}
  const chSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CH');
  const chRange = chSheet.getRange('C4:I14');
  const chVals = chRange.getValues();
  const chRTVals = chRange.getRichTextValues();

  const chRowFourVals = chVals[0];
  const chRowFourRTVals = chRTVals[0];
  const chRowFourIndexToRoomNameMap = new Map([
    [0, 'Room 1'],
    [1, 'Room 2'],
    [2, 'Room 3'],
    [3, 'Room 4'],
    [4, 'Room 5'],
    [5, 'Cat Lobby 1'],
    [6, 'Cat Lobby 2']
  ]);

  for (let i = 0; i < 7; i++) {
    const roomName = chRowFourIndexToRoomNameMap.get(i);
    const val = chRowFourVals[i];
    const richText = chRowFourRTVals[i];
    const roomDetails = { val };

    const runs = richText.getRuns();
    for (const richText of runs) {
      const link = richText.getLinkUrl();
      if (link?.includes('Consult')) {
        roomDetails.consultID = link.split('=')[2];
        break;
      }
    }

    chRooms[roomName] = roomDetails;
  }

  const chRowFourteenVals = chVals.at(-1);
  const chRowFourteenRTVals = chRTVals.at(-1);
  const chRowFourteenIndexToRoomNameMap = new Map([
    [0, 'Room 6'],
    [1, 'Room 7'],
    [2, 'Room 8'],
    [3, 'Room 9'],
    [4, 'Room 10'],
    [5, 'Room 11'],
    [6, 'Dog Lobby']
  ]);

  for (let i = 0; i < 7; i++) {
    const roomName = chRowFourteenIndexToRoomNameMap.get(i);
    const val = chRowFourteenVals[i];
    const richText = chRowFourteenRTVals[i];
    const roomDetails = { val };

    const runs = richText.getRuns();
    for (const richText of runs) {
      const link = richText.getLinkUrl();
      if (link?.includes('Consult')) {
        roomDetails.consultID = link.split('=')[2];
        break;
      }
    }

    chRooms[roomName] = roomDetails;
  }

  allRooms.CH = chRooms;



  const dtRooms = {};
  const dtSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DT');
  const dtRange = dtSheet.getRange('C4:I4');
  const dtVals = dtRange.getValues();
  const dtRTVals = dtRange.getRichTextValues();

  const dtRowFourVals = dtVals[0];
  const dtRowFourRTVals = dtRTVals[0];
  const dtRowFourIndexToRoomNameMap = new Map([
    [0, 'Room 1'],
    [1, 'Room 2'],
    [2, 'Room 3'],
    [3, 'Room 4'],
    [4, 'Room 5'],
    [5, 'Room 6'],
    [6, 'Room 7']
  ]);

  for (let i = 0; i < 7; i++) {
    const roomName = dtRowFourIndexToRoomNameMap.get(i);
    const val = dtRowFourVals[i];
    const richText = dtRowFourRTVals[i];
    const roomDetails = { val };

    const runs = richText.getRuns();
    for (const richText of runs) {
      const link = richText.getLinkUrl();
      if (link?.includes('Consult')) {
        roomDetails.consultID = link.split('=')[2];
        break;
      }
    }

    dtRooms[roomName] = roomDetails;
  }

  allRooms.DT = dtRooms;



  return ContentService.createTextOutput(JSON.stringify(allRooms))
    .setMimeType(ContentService.MimeType.JSON);
}
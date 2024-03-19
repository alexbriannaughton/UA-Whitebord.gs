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

function doGet(e) {
  const stateOfRooms = {};
  const chSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CH');
  const chRange = chSheet.getRange('C4:N21');
  const chVals = chRange.getValues();
  const chRTVals = chRange.getRichTextValues();

  const rowFourVals = chVals[0];
  const rowFourRTVals = chRTVals[0];
  for (let i = 0; i < rowFourRTVals.length; i++) {
    const roomNum = i + 1;
    const val = rowFourRTVals[i];
    const richText = rowFourRTVals[i];
    stateOfRooms[`Room ${roomNum}`] = {
      val,
      link: null
    };

    const runs = richText.getRuns();
    for (const richText of runs) {
      const link = richText.getLinkUrl();
      // if we find that this cell has the link with the incoming consult id, that means it's already here, so return null
      if (link) {
        
      }
    }
  }
}
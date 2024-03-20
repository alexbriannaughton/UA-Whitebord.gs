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
      console.log('second try appointment objects: ', params.items);
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
  try {
    const chRowFourIndexToStatusIDMap = new Map([
      [0, '18'],
      [1, '25'],
      [2, '26'],
      [3, '27'],
      [4, '28'],
      [5, '40'],
      [6, '40']
    ]);

    // this map works for both WC and DT, even though WC only has 5 rooms
    const rowFourIndexToStatusIDMap = new Map([
      [0, '18'], //Room 1
      [1, '25'], //Room 2
      [2, '26'], //Room 3
      [3, '27'], //Room 4
      [4, '28'], //Room 5
      [5, '29'], //Room 6
      [6, '30'] //Room 7
    ]);

    const allRooms = {};
    extractRooms('CH', 'C4:I14', chRowFourIndexToStatusIDMap, allRooms);
    extractRooms('DT', 'C4:I4', rowFourIndexToStatusIDMap, allRooms);
    extractRooms('WC', 'C4:G4', rowFourIndexToStatusIDMap, allRooms);

    return ContentService.createTextOutput(
      JSON.stringify(allRooms)
    ).setMimeType(ContentService.MimeType.JSON);
  }

  catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: error.message })
    ).setMimeType(ContentService.MimeType.JSON).setStatusCode(500);
  }
}
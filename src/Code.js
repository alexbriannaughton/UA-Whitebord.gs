let token = PropertiesService.getScriptProperties().getProperty('ezyVet_token');
const proxy = 'https://api.ezyvet.com';
const sitePrefix = 'https://urbananimalnw.usw2.ezyvet.com';

function updateToken() {
  const url = `${proxy}/v2/oauth/access_token`;
  const props = PropertiesService.getScriptProperties();
  const payload = {
    partner_id: props.getProperty('partner_id'),
    client_id: props.getProperty('client_id'),
    client_secret: props.getProperty('client_secret'),
    grant_type: props.getProperty('grant_type'),
    scope: props.getProperty('scope')
  };
  const options = {
    crossDomain: true,
    method: "POST",
    payload: payload
  };
  const response = UrlFetchApp.fetch(url, options);
  const json = response.getContentText();
  const dataObj = JSON.parse(json);
  token = `${dataObj.token_type} ${dataObj.access_token}`;
  props.setProperty('ezyVet_token', token);
  console.log('updated ezyvet token');
  return token;
};

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

  const apptStatusID = appointment.status_id;

  // if it has a room status (no matter the webhookType), move it to a room
  if (isRoomStatus(apptStatusID)) {
    return moveToRoom(appointment);
  }

  else if (webhookType === "appointment_created") {
    return handleCreatedAppointment(appointment);
  }

  else if (webhookType === "appointment_updated") {
    return handleUpdatedAppointment(appointment, apptStatusID);
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

function handleUpdatedAppointment(appointment, apptStatusID) {
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
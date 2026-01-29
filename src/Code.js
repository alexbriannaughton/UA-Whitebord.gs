// receive appointment webhook events here
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    getCacheVals();
    processAppointments(params);
    return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.JSON);
  }

  catch (error) {
    // wait 3 seconds and try a second time if we get an error
    console.error('error after the first try:', error);
    Utilities.sleep(3000);
    try {
      const params = JSON.parse(e.postData.contents);
      console.log('second try doPost');
      processAppointments(params);
      return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.JSON);
    }

    catch (error) {
      console.error('second error hit:', error);
      throw error;
    };

  }

};

function processAppointments(params) {
  const apptItems = params.items;
  const metaTimestamp = params.meta.timestamp;
  const isCreatedAppt = params.meta.event === 'appointment_created';

  for (const { appointment } of apptItems) {
    const secondsFromMetaToModified = Math.abs(metaTimestamp - appointment.modified_at);
    const isToday = isTodayInUserTimezone(appointment);
    const isMoreThanFiveMinsDelayed = secondsFromMetaToModified > (60 * 5);
    if (isToday && isMoreThanFiveMinsDelayed && isCreatedAppt) {
      console.log('MORE THAN 5 MINS DELAY!');
      console.log('Params:', params);
      apptItems.forEach(({appointment}, i) => {
        console.log(`appt ${i}:`, appointment);
      });
    }
    handleAppointment(params.meta.event, appointment, isToday);
  }
}

function doGet(_e) {
  try {
    return attemptGet();
  }

  catch (error) {
    console.error('First doGet attempt failed: ' + error.message);
    Utilities.sleep(3000);
    try {
      return attemptGet();
    }
    catch (error) {
      console.error('Second doGet attempt failed: ' + error.message);
      return ContentService.createTextOutput(
        JSON.stringify({ error: error.message })
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }
}

function attemptGet() {
  const sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();

  const {
    roomsWithLinks,
    numOfRoomsInUse,
    locationPossPositionNames
  } = extractMainSheetData(sheets);

  const wait = getWaitData(numOfRoomsInUse, sheets);

  const output = { roomsWithLinks, wait, locationPossPositionNames };

  if ([15, 35, 55].includes(new Date().getMinutes())) {
    console.log('do get output-->', output);
  }

  return ContentService.createTextOutput(
    JSON.stringify(output)
  ).setMimeType(ContentService.MimeType.JSON);
}

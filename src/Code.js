// receive appointment webhook events here
function doPost(e) {
  try {
    const startTime = new Date(); // this is for logging executions that hang exessively 
    const params = JSON.parse(e.postData.contents);
    const apptItems = params.items;

    for (const { appointment } of apptItems) {
      handleAppointment(params.meta.event, appointment);
    }

    const endTime = new Date();
    const executionTime = (endTime - startTime) / 1000;
    if (executionTime > 10) {
      console.log(`EXECUTION TOOK ${executionTime} SECONDS`);
      console.log('appt items --->', apptItems);
    }

    return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.JSON);
  }

  catch (error) {
    // wait 3 seconds and try a second time if we get an error
    console.log('error after the first try:', error);
    Utilities.sleep(3000);
    try {
      const params = JSON.parse(e.postData.contents);
      console.log('second try appointment objects: ', params?.items);
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

function doGet(_e) {
  try {
    const ssApp = SpreadsheetApp.getActiveSpreadsheet();
    const output = {
      rooms: extractWhoIsInAllLocationRooms(ssApp),
      wait: getWaitData(ssApp)
    };
    return ContentService.createTextOutput(
      JSON.stringify(output)
    ).setMimeType(ContentService.MimeType.JSON);
  }

  catch (error) {
    console.error(error.message);
    return ContentService.createTextOutput(
      JSON.stringify({ error: error.message })
    ).setMimeType(ContentService.MimeType.JSON).setStatusCode(500);
  }
}
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

// supabase cloud function that will trigger this, and should return the current state of patients in rooms
function doGet(_e) {
  try {
    const chRowFourIndexToStatusIDMap = new Map([
      [0, '18'],//Room 1
      [1, '25'],//Room 2
      [2, '26'],//Room 3
      [3, '27'],//Room 4
      [4, '28'],//Room 5
      [5, '40'],// cat lobby (column 1)
      [6, '40'],//cat lobby (column 2)
    ]);

    // this map works for both WC and DT, even though WC only has 5 rooms
    const rowFourIndexToStatusIDMap = new Map([
      [0, '18'], //Room 1
      [1, '25'], //Room 2
      [2, '26'], //Room 3
      [3, '27'], //Room 4
      [4, '28'], //Room 5
      [5, '29'], //Room 6
      [6, '30'], //Room 7
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
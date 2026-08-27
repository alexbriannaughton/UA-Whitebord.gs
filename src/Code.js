// receive appointment webhook events here
function doPost(e) {
  beginObservedExecution('doPost');
  let params;

  try {
    params = observePhase(
      'payload_parse',
      () => JSON.parse(e.postData.contents),
    );
    logObservedEvent('payload_summary', {
      eventType: params.meta?.event || 'unknown',
      itemCount: Array.isArray(params.items) ? params.items.length : 0,
    });
    observePhase('cache_initialize', getCacheVals, {}, true);
    observePhase(
      'appointments_process',
      () => processAppointments(params, 1),
      { attempt: 1 },
      true,
    );
    finishObservedExecution('success', { attempt: 1 });
    return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.JSON);
  }

  catch (error) {
    // wait 3 seconds and try a second time if we get an error
    logObservedEvent('retry_scheduled', {
      attempt: 1,
      retryDelayMs: 3000,
      ...observedErrorDetails(error),
    }, true);
    Utilities.sleep(3000);
    try {
      params = observePhase(
        'payload_parse',
        () => JSON.parse(e.postData.contents),
        { attempt: 2 },
      );
      logObservedEvent('retry_started', { attempt: 2 });
      observePhase(
        'appointments_process',
        () => processAppointments(params, 2),
        { attempt: 2 },
        true,
      );
      finishObservedExecution('success', { attempt: 2 });
      return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.JSON);
    }

    catch (error) {
      finishObservedExecution('failure', {
        attempt: 2,
        ...observedErrorDetails(error),
      });
      throw error;
    };

  }

};

function processAppointments(params, attempt) {
  const apptItems = params.items;
  const metaTimestamp = params.meta.timestamp;
  const isCreatedAppt = params.meta.event === 'appointment_created';

  let itemIndex = 0;
  for (const { appointment } of apptItems) {
    const secondsFromMetaToModified = Math.abs(metaTimestamp - appointment.modified_at);
    const isToday = isTodayInUserTimezone(appointment);
    const isMoreThanFiveMinsDelayed = secondsFromMetaToModified > (60 * 5);
    
    if (isToday && isMoreThanFiveMinsDelayed && isCreatedAppt) {
      logObservedEvent('delayed_webhook_item', {
        attempt,
        itemIndex,
        delaySeconds: secondsFromMetaToModified,
      });
    }
    observePhase(
      'appointment_item',
      () => handleAppointment(params.meta.event, appointment, isToday),
      {
        attempt,
        itemIndex,
        appointmentTypeId: appointment.type_id,
        appointmentStatusId: appointment.status_id,
        isToday,
      },
    );
    itemIndex++;
  }
}

function doGet(_e) {
  beginObservedExecution('doGet');

  try {
    const response = attemptGet(1);
    finishObservedExecution('success', { attempt: 1 });
    return response;
  }

  catch (error) {
    logObservedEvent('retry_scheduled', {
      attempt: 1,
      retryDelayMs: 3000,
      ...observedErrorDetails(error),
    }, true);
    Utilities.sleep(3000);
    try {
      logObservedEvent('retry_started', { attempt: 2 });
      const response = attemptGet(2);
      finishObservedExecution('success', { attempt: 2 });
      return response;
    }
    catch (error) {
      finishObservedExecution('handled_failure', {
        attempt: 2,
        ...observedErrorDetails(error),
      });
      return ContentService.createTextOutput(
        JSON.stringify({ error: error.message })
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }
}

function attemptGet(attempt) {
  const sheets = observeSpreadsheetCall(
    'open',
    'active_spreadsheet_sheets',
    () => SpreadsheetApp.getActiveSpreadsheet().getSheets(),
    { attempt },
    true,
  );

  const mainSheetData = observeSpreadsheetCall(
    'read',
    'whiteboard_main_ranges',
    () => extractMainSheetData(sheets),
    { attempt },
    true,
  );
  const {
    roomsWithLinks,
    numOfRoomsInUse,
    locationPossPositionNames
  } = mainSheetData;

  const wait = observeSpreadsheetCall(
    'read_write',
    'whiteboard_wait_ranges',
    () => getWaitData(numOfRoomsInUse, sheets),
    { attempt },
    true,
  );

  const output = { roomsWithLinks, wait, locationPossPositionNames };

  return ContentService.createTextOutput(
    JSON.stringify(output)
  ).setMimeType(ContentService.MimeType.JSON);
}

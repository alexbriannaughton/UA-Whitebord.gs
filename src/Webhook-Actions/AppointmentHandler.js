function handleAppointment(webhookType, appointment) {
    getCacheVals();

    // first, send to aus/echo tracker sheet/script if its an echo or aus
    if (ECHO_APPT_CATEGORY.ezyVetTypeIds.includes(appointment.type_id)) {
        handleEchoOrAUS(appointment, 'Echos');
    }
    else if (AUS_APPT_CATEGORY.ezyVetTypeIds.includes(appointment.type_id)) {
        handleEchoOrAUS(appointment, 'AUS');
    }

    // below here is for this sheet
    if (UNHANDLED_APPT_TYPE_IDS.includes(appointment.type_id)) return;

    const uaLoc = whichLocation(appointment.resources[0].id);
    const uaLocSheetName = UA_LOC_SHEET_NAMES_MAP[uaLoc];

    const locationToRoomCoordsMap = ROOM_STATUS_LOCATION_TO_COORDS[appointment.status_id];

    if (uaLocSheetName === DT_SHEET_NAME) {
        return handleDTAppointment(appointment, uaLocSheetName, locationToRoomCoordsMap);
    }

    const userTimeZoneDate = convertEpochToUserTimezoneDate(appointment.start_at);
    const isToday = isTodayInUserTimezone(userTimeZoneDate);
    if (!isToday) return;

    if (!appointment.active) {
        return handleInactiveApptOnWaitlist(appointment, uaLocSheetName);
    }

    appointment.description = removeVetstoriaDescriptionText(appointment.description);

    if (locationToRoomCoordsMap) {
        return moveToRoom(appointment, uaLocSheetName, locationToRoomCoordsMap);
    }

    const nonDtStatusHandlers = {
        17: addToWaitlist, // 'on wait list'
        19: okToCheckOut, // 'ok to check out'
        20: addTextedTimestampOnWaitlist, // 'texted'
        22: handleReadyStatus, // 'ready'
        23: addTechAppt, // 'add to tech column'
        34: addInPatient, // 'inpatient'
        44: addTechAppt, // in wc sx lobby
    };

    const statusHandler = nonDtStatusHandlers[appointment.status_id];

    if (statusHandler) return statusHandler(appointment, uaLocSheetName);

    if (webhookType === 'appointment_created') {
        const apptTypeID = appointment.type_id;

        // appointment type 37 is a walk in and appointment type 77 is a new client walk in
        if (apptTypeID === 37 || apptTypeID === 77) {
            return addToWaitlist(appointment, uaLocSheetName);
        }

        // appointment type 19 is a tech appointment
        else if (apptTypeID === 19) {
            return addTechAppt(appointment, uaLocSheetName);
        }
    }

    return;

}

function handleEchoOrAUS(appointment, sheetName) {
    const url = PropertiesService.getScriptProperties().getProperty('echo_and_ultrasound_tracker_app_url');
    const data = { appointment, sheetName };
    const options = {
        muteHttpExceptions: true,
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify(data)
    };
    UrlFetchApp.fetch(url, options);
    return;
}

function handleDTAppointment(appointment, uaLocSheetName, locationToRoomCoordsMap) {
    const userTimeZoneDate = convertEpochToUserTimezoneDate(appointment.start_at);
    const isOnNextDayOfDtAppts = checkIfIsOnNextDayOfDtAppts(userTimeZoneDate);
    const isValidDtNda = isOnNextDayOfDtAppts && CONTAINS_VALID_DT_NDA_IDS(
        appointment.resources.map(({ id }) => id),
        appointment.type_id
    )

    if (isValidDtNda) return handleNextDayDtAppt(appointment, uaLocSheetName);

    if (locationToRoomCoordsMap) { // this would mean that its a room status
        return moveToRoom(appointment, uaLocSheetName, locationToRoomCoordsMap);
    }

    const dtStatusHandlers = {
        19: okToCheckOut, // 'ok to check out'
        22: handleReadyStatus, // 'ready'
        34: addInPatient // 'inpatient'
    }

    const handler = dtStatusHandlers[appointment.status_id];

    return handler ? handler(appointment, uaLocSheetName) : null;
}
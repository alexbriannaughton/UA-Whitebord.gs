function handleAppointment(webhookType, appointment) {
    // first, send to aus/echo tracker sheet/script if its an echo or aus
    if (ECHO_APPT_CATEGORY.ezyVetTypeIds.includes(appointment.type_id)) {
        handleEchoOrAUS(appointment, 'Echos');
    }
    else if (AUS_APPT_CATEGORY.ezyVetTypeIds.includes(appointment.type_id)) {
        handleEchoOrAUS(appointment, 'AUS');
    }

    // below here is for this sheet
    if (UNHANDLED_APPT_TYPE_IDS.includes(appointment.type_id)) return;

    const uaLocFullName = whichLocation(appointment.resources[0].id);
    const uaLoc = UA_LOC_SHEET_NAMES_MAP[uaLocFullName];

    const isOnNextDayOfDtAppts = checkIfIsOnNextDayOfAppts(appointment, uaLoc);
    const incomingResourceIds = appointment.resources.map(({ id }) => id);
    const incomingApptId = appointment.type_id;
    const isValidDtNda = isOnNextDayOfDtAppts && containsValidNdaIds(
        NDA_SCHEDULED_RESOURCES_MAP[uaLoc],
        NDA_APPT_TYPES_MAP[uaLoc],
        incomingResourceIds,
        incomingApptId,
    );

    if (isValidDtNda) return handleNextDayAppt(appointment, uaLoc);

    const isToday = isTodayInUserTimezone(appointment);
    if (!isToday) return;

    const locationToRoomCoordsMap = ROOM_STATUS_LOCATION_TO_COORDS[appointment.status_id];

    if (uaLoc === DT_SHEET_NAME) {
        return handleDTAppointment(appointment, uaLoc, locationToRoomCoordsMap);
    }

    if (!appointment.active) {
        return handleInactiveApptOnWaitlist(appointment, uaLoc);
    }

    appointment.description = extractChckupClientNotes(appointment.description);

    if (locationToRoomCoordsMap) {
        return moveToRoom(appointment, uaLoc, locationToRoomCoordsMap);
    }

    const nonDtStatusHandlers = {
        17: addToWaitlist, // 'on wait list'
        19: okToCheckOut, // 'ok to check out'
        20: addTextedTimestampOnWaitlist, // 'texted'
        22: handleReadyStatus, // 'ready'
        23: addTechAppt, // 'add to tech column'
        34: addInPatient, // 'inpatient'
        // 44: addTechAppt, // in wc sx lobby
    };

    const statusHandler = nonDtStatusHandlers[appointment.status_id];

    if (statusHandler) return statusHandler(appointment, uaLoc);

    if (webhookType === 'appointment_created') {
        const apptTypeID = appointment.type_id;

        // appointment type 37 is a walk in and appointment type 77 is a new client walk in
        if (apptTypeID === 37 || apptTypeID === 77) {
            return addToWaitlist(appointment, uaLoc);
        }

        else if (EZYVET_WORK_IN_TECH_APPT_TYPE_ID === apptTypeID) {
            return addTechAppt(appointment, uaLoc);
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

function handleDTAppointment(appointment, uaLoc, locationToRoomCoordsMap) {
    if (locationToRoomCoordsMap) { // this would mean that its a room status
        return moveToRoom(appointment, uaLoc, locationToRoomCoordsMap);
    }

    const dtStatusHandlers = {
        19: okToCheckOut, // 'ok to check out'
        22: handleReadyStatus, // 'ready'
        34: addInPatient // 'inpatient'
    }

    const handler = dtStatusHandlers[appointment.status_id];

    return handler ? handler(appointment, uaLoc) : null;
}
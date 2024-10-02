function handleAppointment(webhookType, appointment) {
    // first, send to aus/echo tracker sheet/script if its an echo or aus
    if (echoApptTypeIDsSet.has(appointment.type_id)) {
        handleEchoOrAUS(appointment, 'Echos');
    }
    if (ausApptTypeIDsSet.has(appointment.type_id)) {
        handleEchoOrAUS(appointment, 'AUS');
    }

    // below here is for this sheetty
    if (appointment.type_id === 4) return; // block off type

    const location = whichLocation(appointment.resources[0].id);
    const locationToRoomCoordsMap = roomStatusLocationToCoords[appointment.status_id];

    if (location === 'DT') return handleDTAppointment(appointment, location, locationToRoomCoordsMap);

    const isToday = isTodayInUserTimezone(
        convertEpochToUserTimezoneDate(appointment.start_at)
    )

    if (!isToday) return;

    if (!appointment.active) {
        return handleInactiveApptOnWaitlist(appointment, location);
    }

    appointment.description = removeVetstoriaDescriptionText(appointment.description);
       
    if (locationToRoomCoordsMap) {
        return moveToRoom(appointment, location, locationToRoomCoordsMap);
    }
    
    // if (isRoomStatus(appointment.status_id)) {
    //     return moveToRoom(appointment, location);
    // }

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

    if (statusHandler) return statusHandler(appointment, location);

    if (webhookType === 'appointment_created') {
        const apptTypeID = appointment.type_id;

        // appointment type 37 is a walk in and appointment type 77 is a new client walk in
        if (apptTypeID === 37 || apptTypeID === 77) {
            return addToWaitlist(appointment, location);
        }

        // appointment type 19 is a tech appointment
        else if (apptTypeID === 19) {
            return addTechAppt(appointment, location);
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

function handleDTAppointment(appointment, location, locationToRoomCoordsMap) {
    const timestampDate = convertEpochToUserTimezoneDate(appointment.start_at);
    const couldBeNextDayDtAppt = isOnNextDayOfDtAppts(timestampDate);
    if (couldBeNextDayDtAppt) {
        return handleNextDayDtAppt(appointment, location);
    }

    if (!isTodayInUserTimezone(timestampDate)) return null;

    if (isRoomStatus(appointment.status_id)) {
        return moveToRoom(appointment, location, locationToRoomCoordsMap);
    }

    const dtStatusHandlers = {
        19: okToCheckOut, // 'ok to check out'
        22: handleReadyStatus, // 'ready'
        34: addInPatient // 'inpatient'
    }

    const handler = dtStatusHandlers[appointment.status_id];

    return handler ? handler(appointment, location) : null;
}
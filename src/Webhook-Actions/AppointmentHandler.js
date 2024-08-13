function handleAppointment(webhookType, appointment) {
    // first, send to aus/echo tracker sheet/script if its an echo or aus
    if (echoApptTypeIDsSet.has(appointment.type_id)) {
        handleEchoOrAUS(appointment, 'Echos');
    }
    if (ausApptTypeIDsSet.has(appointment.type_id)) {
        handleEchoOrAUS(appointment, 'AUS');
    }

    // below here is for this sheet
    const timestampDate = convertEpochToUserTimezoneDate(appointment.start_at);

    const couldBeNextDayDtAppt = isOnNextDayOfDtAppts(timestampDate);
    if (couldBeNextDayDtAppt) {
        return handleNextDayDtAppt(appointment);
    }

    if (!isTodayInUserTimezone(timestampDate)) return;

    if (!appointment.active) {
        return handleInactiveApptOnWaitlist(appointment);
    }

    appointment.description = removeVetstoriaDescriptionText(appointment.description);

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
    const statusHandlers = {
        17: addToWaitlist, // 'on wait list'
        19: okToCheckOut, // 'ok to check out'
        20: addTextedTimestampOnWaitlist, // 'texted'
        22: handleReadyStatus, // 'ready'
        23: addTechAppt, // 'add to tech column'
        34: addInPatient // 'inpatient'
    }

    const handler = statusHandlers[appointment.status_id];

    return handler ? handler(appointment) : null;
};
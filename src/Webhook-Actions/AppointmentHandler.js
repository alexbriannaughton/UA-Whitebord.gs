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
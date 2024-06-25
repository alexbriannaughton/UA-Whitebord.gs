// check which urban animal facility based on appointment resource id
// note: webhooks send resourceIDs as numbers, but get requests for appointments send resourceIDs as strings
// this function only works for parsing webhooks (resourceIDs as numbers)
function whichLocation(resourceID) {
    const resourceIDToLocationMap = new Map();

    // calendar resource ids for CH:
    // 24: CH DVM 1
    // 25: CH DVM 2
    // 26: CH DVM 3
    // 27: CH INT MED
    // 28: CH Tech
    // 29: CH Procedure 1
    // 30: CH Procedure 2
    // 65: CH IM Procedure
    // 1063: CH DVM 4
    // 1081: Walk Ins (with CH as dept)
    [24, 25, 26, 27, 28, 29, 30, 65, 1063, 1081]
        .forEach(id => resourceIDToLocationMap
            .set(id, 'CH')
        );

    // calendar resource ids for DT:
    // 35: DT DVM 1(Light)
    // 55: DT DVM 2(West)
    // 56: DT Tech
    // 57: DT Procedure 1
    // 58: DT Procedure 2
    // 1015: DT DVM 3(Kreyenhagen)
    // 1082: Walk Ins(Relief DVM)(with DT as dept)
    [35, 55, 56, 57, 58, 1015, 1082]
        .forEach(id => resourceIDToLocationMap
            .set(id, 'DT')
        );

    // calendar resource ids for WC:
    // 39: WC DVM 1
    // 59: WC DVM 2
    // 60: WC Tech
    // 61: WC Procedure 1
    // 62: WC Procedure 2
    // 1083: Walk Ins(with WC as dept)
    // 1384: WC DVM 3
    [39, 59, 60, 61, 62, 1083, 1384]
        .forEach(id => resourceIDToLocationMap
            .set(id, 'WC')
        );

    return resourceIDToLocationMap.get(resourceID);
};

// check if status ID is an appointment status for being in a room
function isRoomStatus(statusID) {
    // rooms two through ten are have status ids of 25 through 33
    // the following status ids we also handle as if they are a room status
    // 18, // room 1
    // 36, // room 11,
    // 39, // in dog lobby,
    // 40, // in cat lobby

    return (statusID >= 25 && statusID <= 33) || [18, 36, 39, 40].includes(statusID);
};

function filterForValidDtAppts(allTargetDayAppts) {
    return allTargetDayAppts.items.filter(({ appointment }) => {
        return appointment.details.resource_list.some(id => dtResourceIDs.has(id)) // is in a DT exam column
            && dtDVMApptTypeIDs.has(appointment.details.appointment_type_id); // is a dt doctor exam type
    });
};
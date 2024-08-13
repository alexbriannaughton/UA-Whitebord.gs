function whichLocation(resourceID) {
    console.log(resourceID)
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

    Array.from(dtResourceIDs)
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
        return appointment.details.resource_list.some(id => dtResourceIDs.has(Number(id))) // is in a DT exam column
            && dtDVMApptTypeIDs.has(Number(appointment.details.appointment_type_id)); // is a dt doctor exam type
    });
};

function getCancellationReason(id) {
    const idToReason = new Map([
        [1, 'No show'],
        [2, 'Owners request'],
        [3, 'Incorrect entry'],
        [4, 'Symptoms subsiding'],
        [5, 'Unable to see (waitlist closed)'],
        [6, 'Seen at another location'],
        [7, 'Rescheduled'],
        [8, 'No deposit sent']
    ]);

    return idToReason.get(id);
}

const echoApptTypeIDsSet = new Set([30]);
const ausApptTypeIDsSet = new Set([29, 91]);

const dtResourceIDs = new Set([ // non procedures dt columns
    35, // dt dvm 1
    // 55, // used to be dt dvm 2, though it is not currently active 3/16/24
    56, // dt tech
    // 1015, // used to be dt dvm 3, though it is not currently active 3/16/24
    1082, // dt DVM :15/:45
    57, // dt procedure 1
    58, // dt procedure 2
]);
const dtDVMApptTypeIDs = new Set([
    79, // downtown - appointment
    95, // Downtown - Appointment (:15/:45)
    93, // Downtown - Same Day Sick
]);

// takes appointment.type_id and outputs a string for the procedure type
const typeIDToCategoryMap = new Map([
    [7, 'sx'], [76, 'sx'], [89, 'sx'], [90, 'sx'],   // Surgery type IDs
    [29, 'aus'], [91, 'aus'],                             // Ultrasound type IDs
    [30, 'echo'],                                           // Echocardiogram type ID
    [28, 'dental'], [86, 'dental'], [94, 'dental'],     // Dental type IDs
    [81, 'h/c'],                                            // Health certificate appointment type ID
    // NOTE: secondary type ids sorted as other in the daily inpatient job
    [31, 'secondary'], [32, 'secondary'], [33, 'secondary'], [36, 'secondary'], [38, 'secondary'], [82, 'secondary'], [83, 'secondary'], [88, 'secondary'],
    [26, 'IM'], [27, 'IM'], [34, 'IM'], [35, 'IM'],
    [19, 'tech'], [85, 'tech'],
    [80, 'euth']
]);

const speciesMap = { 1: 'K9', 2: 'FEL' }; // ezyvet animal.species_id => species string

// const statusIDToNameMap = new Map([
//     [1, 'no status'],
//     [2, 'confirmed'],
//     [13, 'complete'],
//     [15, 'unconfirmed'],
//     [16, 'triaged/bumped'],
//     [18, 'room 1'],
//     [17, 'on wait list'],
//     [19, 'ok to check out'],
//     [20, 'texted'],
//     [21, 'in lobby'],
//     [22, 'ready'],
//     [23, 'add to tech column'],
//     [24, 'checked out'],
//     [25, 'room 2'],
//     [26, 'room 3'],
//     [27, 'room 4'],
//     [28, 'room 5'],
//     [29, 'room 6'],
//     [30, 'room 7'],
//     [31, 'room 8'],
//     [32, 'room 9'],
//     [33, 'room 10'],
//     [34, 'inpatient'],
//     [35, 'chart complete'],
//     [36, 'room 11'],
//     [37, 'deposit paid'],
//     [38, 'deposit requested'],
//     [39, 'dog lob'],
//     [40, 'cat lobby'],
// ])
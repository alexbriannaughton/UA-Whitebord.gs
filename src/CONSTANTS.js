const CH_NAME = 'CH';
const DT_NAME = 'DT';
const WC_NAME = 'WC';

const EV_PROXY = 'https://api.ezyvet.com';
const SITE_PREFIX = 'https://urbananimalnw.usw2.ezyvet.com';

const UNKNOWN_SPECIES_STRING = 'unknown species';

const USER_TIMEZONE = 'America/Los_Angeles';

const DATE_STRING_PATTERN = 'EEEE MM/dd/yyyy';

const DT_NDA_ROW_START_NUMBER = 15;
const DT_NDA_COORDS = `K${DT_NDA_ROW_START_NUMBER}:R85`;

const SAME_FAM_STRING = '^same fam^';

const APPT_CATEGORY_TO_COLOR = new Map([
    // ['tech', '#90EE90'], // bright green , not including this bc i dont want them to be bright green on inpatient daily job
    ['euth', '#cfe2f3'], // blue
    ['sx', '#fff2cc'],// light yellowish
    ['aus', '#cfe2f3'],// light blue 3
    ['echo', '#f4cccc'],// light red
    ['dental', '#d9ead3'], // light green
    ['h/c', '#fce5cd'],// light orangish
    ['secondary', '#fce5cd'],// light orangish
    ['IM', '#d9d2e9'] // light purplish
]);

// for obtaining a particular location's default background color for the inpatient box
const UA_LOC_INPATIENT_DEFAULT_COLOR = new Map([
    [CH_NAME, '#f3f3f3'], // gray for cap hill
    [DT_NAME, '#d0e0e3'], // cyan for downtown
    [WC_NAME, '#ead1dc']  // magenta for white center
]);

const UA_LOC_TEXTED_COLOR = new Map([
    [CH_NAME, '#ff9fbd'],
    [WC_NAME, 'yellow']
]);

const UA_LOC_INPATIENT_COORDS = new Map([
    [CH_NAME, 'R3:W36'],
    [DT_NAME, 'B14:H42'],
    [WC_NAME, 'B20:I60']
]);

const UA_LOC_MAX_ROOMS_CELL_COORDS = new Map([
    [CH_NAME, 'O4'],
    [WC_NAME, 'I3']
]);

// function WHICH_LOCATION(resourceID) {
//     const resourceIDToLocationMap = new Map();

//     // calendar resource ids for CH:
//     // 24: CH DVM 1
//     // 25: CH DVM 2
//     // 26: CH DVM 3
//     // 27: CH INT MED
//     // 28: CH Tech
//     // 29: CH Procedure 1
//     // 30: CH Procedure 2
//     // 65: CH IM Procedure
//     // 1063: CH DVM 4
//     // 1081: Walk Ins (with CH as dept)
//     [24, 25, 26, 27, 28, 29, 30, 65, 1063, 1081]
//         .forEach(id => resourceIDToLocationMap
//             .set(id, CH_NAME)
//         );

//     Array.from(DT_RESOURCE_IDS)
//         .forEach(id => resourceIDToLocationMap
//             .set(id, DT_NAME)
//         );

//     // calendar resource ids for WC:
//     // 39: WC DVM 1
//     // 59: WC DVM 2
//     // 60: WC Tech
//     // 61: WC Procedure 1
//     // 62: WC Procedure 2
//     // 1083: Walk Ins(with WC as dept)
//     // 1384: WC DVM 3
//     [39, 59, 60, 61, 62, 1083, 1384]
//         .forEach(id => resourceIDToLocationMap
//             .set(id, WC_NAME)
//         );

//     return resourceIDToLocationMap.get(resourceID);
// };

function FILTER_FOR_VALID_DT_APPTS(allTargetDayAppts) {
    return allTargetDayAppts.items.filter(({ appointment }) => {
        return appointment.details.resource_list.some(id => DT_RESOURCE_IDS.has(Number(id))) // is in a DT exam column
            && DT_DVM_APPT_IDS.has(Number(appointment.details.appointment_type_id)); // is a dt doctor exam type
    });
};

function GET_CANCELLATION_REASON(id) {
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

const ECHO_APPT_TYPE_IDS = new Set([30]);
const AUS_APPT_TYPE_IDS = new Set([29, 91]);

const DT_RESOURCE_IDS = new Set([ // non procedures dt columns
    35, // dt dvm 1
    // 55, // used to be dt dvm 2, though it is not currently active 3/16/24
    56, // dt tech
    // 1015, // used to be dt dvm 3, though it is not currently active 3/16/24
    1082, // dt DVM :15/:45
    57, // dt procedure 1
    58, // dt procedure 2
]);
const DT_DVM_APPT_IDS = new Set([
    79, // downtown - appointment
    95, // Downtown - Appointment (:15/:45)
    93, // Downtown - Same Day Sick
]);

// takes appointment.type_id and outputs a string for the procedure type
const TYPE_ID_TO_CATEGORY = new Map([
    [7, 'sx'], [76, 'sx'], [89, 'sx'], [90, 'sx'], [100, 'sx'], [101, 'sx'],  // Surgery type IDs
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

const SPECIES_MAP = { 1: 'K9', 2: 'FEL' }; // ezyvet animal.species_id => species string

const ROOM_STATUS_LOCATION_TO_COORDS = {
    18: { // room 1
        [CH_NAME]: 'C3:C11',
        [DT_NAME]: 'C3:C11',
        [WC_NAME]: 'C3:C11'
    },
    25: { // room 2
        [CH_NAME]: 'D3:D11',
        [DT_NAME]: 'D3:D11',
        [WC_NAME]: 'D3:D11'
    },
    26: { // room 3
        [CH_NAME]: 'E3:E11',
        [DT_NAME]: 'E3:E11',
        [WC_NAME]: 'E3:E11'
    },
    27: { // room 4
        [CH_NAME]: 'F3:F11',
        [DT_NAME]: 'F3:F11',
        [WC_NAME]: 'F3:F11'
    },
    28: { // room 5
        [CH_NAME]: 'G3:G11',
        [DT_NAME]: 'G3:G11',
        [WC_NAME]: 'G3:G11'
    },
    29: { // room 6
        [CH_NAME]: 'C13:C21',
        [DT_NAME]: 'H3:H11',
        [WC_NAME]: null
    },
    30: { // room 7
        [CH_NAME]: 'D13:D21',
        [DT_NAME]: 'I3:I11',
        [WC_NAME]: null
    },
    31: { // room 8
        [CH_NAME]: 'E13:E21',
        [DT_NAME]: null,
        [WC_NAME]: null
    },
    32: { // room 9
        [CH_NAME]: 'F13:F21',
        [DT_NAME]: null,
        [WC_NAME]: null
    },
    33: { // room 10
        [CH_NAME]: 'G13:G21',
        [DT_NAME]: null,
        [WC_NAME]: null
    },
    36: { // room 11
        [CH_NAME]: 'H13:H21',
        [DT_NAME]: null,
        [WC_NAME]: null
    },
    39: { // dog lob
        [CH_NAME]: 'I13:I21',
        [DT_NAME]: null,
        [WC_NAME]: null
    },
    40: { // cat lob
        [CH_NAME]: 'H3:H11', // first column
        [DT_NAME]: null,
        [WC_NAME]: null
    },
    43: { // wc sx 1
        [CH_NAME]: null,
        [DT_NAME]: null,
        [WC_NAME]: 'C13:C21'
    },
    42: { // wc sx 2
        [CH_NAME]: null,
        [DT_NAME]: null,
        [WC_NAME]: 'D13:D21'
    },
    41: { // wc sx 3
        [CH_NAME]: null,
        [DT_NAME]: null,
        [WC_NAME]: 'E13:E21'
    },
    // 44: { // wc sx lobby
    //     [CH_NAME]: null,
    //     [DT_NAME]: null,
    //     [WC_NAME]: ''
    // }

}

const BLOCK_OFF_APPT_TYPE_ID = 4;
const NO_SHOW_APPT_ID = 98;
const EOD_APPT_ID = 96;
const UNHANDLED_APPT_TYPE_IDS = [
    BLOCK_OFF_APPT_TYPE_ID,
    NO_SHOW_APPT_ID,
    EOD_APPT_ID,
];
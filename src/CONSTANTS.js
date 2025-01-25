const CH_SHEET_NAME = 'CH';
const DT_SHEET_NAME = 'DT';
const WC_SHEET_NAME = 'WC';

const ALL_LOCATION_SHEETS = [CH_SHEET_NAME, DT_SHEET_NAME, WC_SHEET_NAME];

const UA_LOC_SHEET_NAMES_MAP = {
    'Capitol Hill': CH_SHEET_NAME,
    'Downtown': DT_SHEET_NAME,
    'White Center': WC_SHEET_NAME,
};

const EV_PROXY = 'https://api.ezyvet.com';
const SITE_PREFIX = 'https://urbananimalnw.usw2.ezyvet.com';

const UNKNOWN_SPECIES_STRING = 'unknown species';

const USER_TIMEZONE = 'America/Los_Angeles';

const DATE_STRING_PATTERN = 'EEEE MM/dd/yyyy';

const DT_NDA_ROW_START_NUMBER = 15;
const DT_NDA_COORDS = `K${DT_NDA_ROW_START_NUMBER}:R85`;

const SAME_FAM_STRING = '^same fam^';


// for obtaining a particular location's default background color for the inpatient box
const UA_LOC_INPATIENT_DEFAULT_COLOR = new Map([
    [CH_SHEET_NAME, '#f3f3f3'], // gray for cap hill
    [DT_SHEET_NAME, '#d0e0e3'], // cyan for downtown
    [WC_SHEET_NAME, '#ead1dc']  // magenta for white center
]);

const UA_LOC_TEXTED_COLOR = new Map([
    [CH_SHEET_NAME, '#ff9fbd'],
    [WC_SHEET_NAME, 'yellow']
]);

const UA_LOC_INPATIENT_COORDS = new Map([
    [CH_SHEET_NAME, 'R3:W36'],
    [DT_SHEET_NAME, 'B14:H42'],
    [WC_SHEET_NAME, 'B20:I60']
]);

const UA_LOC_MAX_ROOMS_CELL_COORDS = new Map([
    [CH_SHEET_NAME, 'O4'],
    [WC_SHEET_NAME, 'I3']
]);

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

class ApptCategory {
    constructor(ezyVetTypeIds, name, color, sortValue) {
        this.ezyVetTypeIds = ezyVetTypeIds;
        this.name = name;
        this.color = color;
        this.sortValue = sortValue;
    }
}

const EZYVET_SX_TYPE_ID = 7;
const EZYVET_SPAY_NEUTER_TYPE_ID = 76;
const EZYVET_DT_SPAY_NEUTER_TYPE_ID = 89;
const EZYVET_DT_SX_TYPE_ID = 90;
const EZYVET_WC_SPAY_NEUTER_TYPE_ID = 100;
const EZYVET_WC_SX_TYPE_ID = 101;
const EZYVET_SX_TYPE_IDS = [
    EZYVET_SX_TYPE_ID,
    EZYVET_SPAY_NEUTER_TYPE_ID,
    EZYVET_DT_SX_TYPE_ID,
    EZYVET_WC_SPAY_NEUTER_TYPE_ID,
    EZYVET_WC_SX_TYPE_ID,
];
const SX_APPT_CATEGORY_NAME = 'sx';
const SX_APPT_CATEGORY = new ApptCategory(EZYVET_SX_TYPE_IDS, SX_APPT_CATEGORY_NAME, '#fff2cc', 0);

const EZYVET_AUS_TYPE_ID = 29;
const EZYVET_DT_AUS_TYPE_ID = 91;
const EZYVET_AUS_TYPE_IDS = [EZYVET_AUS_TYPE_ID, EZYVET_DT_AUS_TYPE_ID];
const AUS_APPT_CATEGORY_NAME = 'aus';
const AUS_APPT_CATEGORY = new ApptCategory(EZYVET_AUS_TYPE_IDS, AUS_APPT_CATEGORY_NAME, '#cfe2f3', 1);

const EZYVET_ECHO_TYPE_IDS = [30];
const ECHO_APPT_CATEGORY_NAME = 'echo';
const ECHO_APPT_CATEGORY = new ApptCategory(EZYVET_ECHO_TYPE_IDS, ECHO_APPT_CATEGORY_NAME, '#f4cccc', 2);

const EZYVET_CH_DENTAL_TYPE_ID = 28;
const EZYVET_DT_DENTAL_TYPE_ID = 86;
const EZYVET_WC_THURS_DENTAL_TYPE_ID = 94;
const EZYVET_DENTAL_TYPE_IDS = [
    EZYVET_CH_DENTAL_TYPE_ID,
    EZYVET_DT_DENTAL_TYPE_ID,
    EZYVET_WC_THURS_DENTAL_TYPE_ID
];
const DENTAL_APPT_CATEGORY_NAME = 'dental';
const DENTAL_APPT_CATEGORY = new ApptCategory(EZYVET_DENTAL_TYPE_IDS, DENTAL_APPT_CATEGORY_NAME, '#d9ead3', 4);

const EZYVET_HC_TYPE_IDS = [81];
const HC_APPT_CATEGORY_NAME = 'hc';
const HC_APPT_CATEGORY = new ApptCategory(EZYVET_HC_TYPE_IDS, HC_APPT_CATEGORY_NAME, '#fce5cd', 6);

const EZYVET_IM_CONSULT_TYPE_ID = 26;
const EZYVET_IM_RECECK_TYPE_ID = 27;
const EZYVET_IM_PROCEDURE_TYPE_ID = 34;
const EZYVET_IM_TECH_APPT_TYPE_ID = 35;
const EZYVET_IM_APPT_TYPES = [
    EZYVET_IM_CONSULT_TYPE_ID,
    EZYVET_IM_RECECK_TYPE_ID,
    EZYVET_IM_PROCEDURE_TYPE_ID,
    EZYVET_IM_TECH_APPT_TYPE_ID
];
const IM_APPT_CATEOGRY_NAME = 'im';
const IM_APPT_CATEGORY = new ApptCategory(EZYVET_IM_APPT_TYPES, IM_APPT_CATEOGRY_NAME, '#d9d2e9', 5);

const EZYVET_TECH_APPT_TYPE_ID = 19;
const EZYVET_DT_TECH_APPT_TYPE_ID = 85;
const EZYVET_TECH_APPT_IDS = [EZYVET_TECH_APPT_TYPE_ID, EZYVET_DT_TECH_APPT_TYPE_ID];
const TECH_APPT_CATEGORY_NAME = 'tech';
const TECH_APPT_CATEGORY = new ApptCategory(EZYVET_TECH_APPT_IDS, TECH_APPT_CATEGORY_NAME, '#90EE90', 3);

const EZYVET_EUTH_APPT_ID = 80;
const EZYVET_DT_EUTH_APPT_ID = 87;
const EZYVET_EUTH_APPT_IDS = [
    EZYVET_EUTH_APPT_ID,
    EZYVET_DT_EUTH_APPT_ID
];
const EZYVET_EUTH_APPT_CATEGORY_NAME = 'euth';

const EUTH_APPT_CATEGORY = new ApptCategory(EZYVET_EUTH_APPT_IDS, EZYVET_EUTH_APPT_CATEGORY_NAME, '#cfe2f3', 3);

const APPT_CATEGORIES = [
    SX_APPT_CATEGORY,
    AUS_APPT_CATEGORY,
    ECHO_APPT_CATEGORY,
    DENTAL_APPT_CATEGORY,
    HC_APPT_CATEGORY,
    IM_APPT_CATEGORY,
    TECH_APPT_CATEGORY,
    EUTH_APPT_CATEGORY
];

const TYPE_ID_TO_CATEGORY = new Map();
APPT_CATEGORIES.forEach(category => {
    category.ezyVetTypeIds.forEach(id => {
        TYPE_ID_TO_CATEGORY.set(id, category);
    });
});

const APPT_CATEGORY_TO_COLOR = new Map([
    // ['tech', '#90EE90'], // bright green , not including this bc i dont want them to be bright green on inpatient daily job
    ['euth', '#cfe2f3'], // blue
    ['sx', '#fff2cc'],// light yellowish
    ['aus', '#cfe2f3'],// light blue 3
    ['echo', '#f4cccc'],// light red
    ['dental', '#d9ead3'], // light green
    ['h/c', '#fce5cd'],// light orangish
    // ['secondary', '#fce5cd'],// light orangish
    ['IM', '#d9d2e9'] // light purplish
]);

const SPECIES_MAP = { 1: 'K9', 2: 'FEL' }; // ezyvet animal.species_id => species string

const ROOM_STATUS_LOCATION_TO_COORDS = {
    18: { // room 1
        [CH_SHEET_NAME]: 'C3:C11',
        [DT_SHEET_NAME]: 'C3:C11',
        [WC_SHEET_NAME]: 'C3:C11'
    },
    25: { // room 2
        [CH_SHEET_NAME]: 'D3:D11',
        [DT_SHEET_NAME]: 'D3:D11',
        [WC_SHEET_NAME]: 'D3:D11'
    },
    26: { // room 3
        [CH_SHEET_NAME]: 'E3:E11',
        [DT_SHEET_NAME]: 'E3:E11',
        [WC_SHEET_NAME]: 'E3:E11'
    },
    27: { // room 4
        [CH_SHEET_NAME]: 'F3:F11',
        [DT_SHEET_NAME]: 'F3:F11',
        [WC_SHEET_NAME]: 'F3:F11'
    },
    28: { // room 5
        [CH_SHEET_NAME]: 'G3:G11',
        [DT_SHEET_NAME]: 'G3:G11',
        [WC_SHEET_NAME]: 'G3:G11'
    },
    29: { // room 6
        [CH_SHEET_NAME]: 'C13:C21',
        [DT_SHEET_NAME]: 'H3:H11',
        [WC_SHEET_NAME]: null
    },
    30: { // room 7
        [CH_SHEET_NAME]: 'D13:D21',
        [DT_SHEET_NAME]: 'I3:I11',
        [WC_SHEET_NAME]: null
    },
    31: { // room 8
        [CH_SHEET_NAME]: 'E13:E21',
        [DT_SHEET_NAME]: null,
        [WC_SHEET_NAME]: null
    },
    32: { // room 9
        [CH_SHEET_NAME]: 'F13:F21',
        [DT_SHEET_NAME]: null,
        [WC_SHEET_NAME]: null
    },
    33: { // room 10
        [CH_SHEET_NAME]: 'G13:G21',
        [DT_SHEET_NAME]: null,
        [WC_SHEET_NAME]: null
    },
    36: { // room 11
        [CH_SHEET_NAME]: 'H13:H21',
        [DT_SHEET_NAME]: null,
        [WC_SHEET_NAME]: null
    },
    39: { // dog lob
        [CH_SHEET_NAME]: 'I13:I21',
        [DT_SHEET_NAME]: null,
        [WC_SHEET_NAME]: null
    },
    40: { // cat lob
        [CH_SHEET_NAME]: 'H3:H11', // first column
        [DT_SHEET_NAME]: null,
        [WC_SHEET_NAME]: null
    },
    43: { // wc sx 1
        [CH_SHEET_NAME]: null,
        [DT_SHEET_NAME]: null,
        [WC_SHEET_NAME]: 'C13:C21'
    },
    42: { // wc sx 2
        [CH_SHEET_NAME]: null,
        [DT_SHEET_NAME]: null,
        [WC_SHEET_NAME]: 'D13:D21'
    },
    41: { // wc sx 3
        [CH_SHEET_NAME]: null,
        [DT_SHEET_NAME]: null,
        [WC_SHEET_NAME]: 'E13:E21'
    },
    // 44: { // wc sx lobby
    //     [CH_SHEET_NAME]: null,
    //     [DT_SHEET_NAME]: null,
    //     [WC_SHEET_NAME]: ''
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
const CH_PROCEDURE_1_RESOURCE_ID = '29';
const CH_PROCEDURE_2_RESOURCE_ID = '30';
const CH_IM_RESOURCE_ID = '27';
const CH_IM_PROCEDURE_RESOURCE_ID = '65';
const DT_PROCEDURE_1_RESOURCE_ID = '57';
const DT_PROCEDURE_2_RESOURCE_ID = '58';
const WC_PROCEDURE_1_RESOURCE_ID = '61';
const WC_PROCEDURE_2_RESOURCE_ID = '62';

const SCHEDULED_PROCEDURES_RESOURCE_IDS = [
    CH_PROCEDURE_1_RESOURCE_ID,
    CH_PROCEDURE_2_RESOURCE_ID,
    CH_IM_RESOURCE_ID,
    CH_IM_PROCEDURE_RESOURCE_ID,
    DT_PROCEDURE_1_RESOURCE_ID,
    DT_PROCEDURE_2_RESOURCE_ID,
    WC_PROCEDURE_1_RESOURCE_ID,
    WC_PROCEDURE_2_RESOURCE_ID,
];

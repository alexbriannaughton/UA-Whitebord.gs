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

const TECH_IN_ROOM_TEXT = ' (TECH)';

const SPECIES_MAP = { 1: 'K9', 2: 'FEL' }; // ezyvet animal.species_id => species string

const STANDARD_GREY = '#f3f3f3'; // gray
const OTHER_APPT_COLOR = '#fce5cd'; // light orange
const OTHER_PROCEDURE_SORT_VALUE = 3;

const UA_LOC_INPATIENT_DEFAULT_COLOR = new Map([
    [CH_SHEET_NAME, STANDARD_GREY], // gray for cap hill
    [DT_SHEET_NAME, '#d0e0e3'], // cyan/light bluish for downtown
    [WC_SHEET_NAME, '#ead1dc']  // magenta/pinkish for white center
]);

const UA_LOC_TEXTED_COLOR = new Map([
    [CH_SHEET_NAME, '#ff9fbd'], // carnation pink
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

// ezyvet appt type handlers
const BLOCK_OFF_APPT_TYPE_ID = 4;
const NO_SHOW_APPT_ID = 98;
const EOD_APPT_ID = 96;
const UNHANDLED_APPT_TYPE_IDS = [
    BLOCK_OFF_APPT_TYPE_ID,
    NO_SHOW_APPT_ID,
    EOD_APPT_ID,
];

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
const SX_APPT_CATEGORY = new ApptCategory(
    [
        EZYVET_SX_TYPE_ID,
        EZYVET_SPAY_NEUTER_TYPE_ID,
        EZYVET_DT_SPAY_NEUTER_TYPE_ID,
        EZYVET_DT_SX_TYPE_ID,
        EZYVET_WC_SPAY_NEUTER_TYPE_ID,
        EZYVET_WC_SX_TYPE_ID,
    ],
    'sx',
    '#fff2cc', // light yellowish/orange
    0
);

const EZYVET_AUS_TYPE_ID = 29;
const EZYVET_DT_AUS_TYPE_ID = 91;
const AUS_APPT_CATEGORY = new ApptCategory(
    [EZYVET_AUS_TYPE_ID, EZYVET_DT_AUS_TYPE_ID],
    'aus',
    '#cfe2f3', // light blue
    1
);

const EZYVET_ECHO_TYPE_ID = 30;
const ECHO_APPT_CATEGORY = new ApptCategory(
    [EZYVET_ECHO_TYPE_ID],
    'echo',
    '#f4cccc', // light red
    2
);

const EZYVET_CH_DENTAL_TYPE_ID = 28;
const EZYVET_DT_DENTAL_TYPE_ID = 86;
const EZYVET_WC_THURS_DENTAL_TYPE_ID = 94;
const DENTAL_APPT_CATEGORY = new ApptCategory(
    [
        EZYVET_CH_DENTAL_TYPE_ID,
        EZYVET_DT_DENTAL_TYPE_ID,
        EZYVET_WC_THURS_DENTAL_TYPE_ID
    ],
    'dental',
    '#d9ead3', // light green
    4
);

const EZYVET_HC_TYPE_ID = 81;
const EZYVET_BEHAVIOR_CONSULT_TYPE_ID = 102;
const EZYVET_BEHAVIOR_VET_CARE_TRAINING_TYPE_ID = 103;
const EZYVET_BEHAVIOR_FU_IN_PERSON_TYPE_ID = 104;
const EZYVET_BEHAVIOR_FU_VIRTUAL_TYPE_ID = 105;
const EZYVET_BEHAVIOR_OFF_SITE_1_TYPE_ID = 106;
const EZYVET_BEHAVIOR_OFF_SITE_2_TYPE_ID = 107;
const EZYVET_BEHAVIOR_OFF_SITE_3_TYPE_ID = 108;
const EZYVET_BEHAVIOR_OFF_SITE_EXTENDED_TYPE_ID = 109;
const EZYVET_COMFORT_CONSULT_1_TYPE_ID = 110;
const EZYVET_COMFORT_CONSULT_2_TYPE_ID = 111;
const EZYVET_COMFORT_CONSULT_3_TYPE_ID = 112;
const EZYVET_COMFORT_EUTH_TYPE_ID = 113;
const EZYVET_COMFORT_AT_HOME_EUTH_TYPE_ID = 114;
const SPECIAL_APPT_CATEGORY = new ApptCategory(
    [
        EZYVET_HC_TYPE_ID,
        EZYVET_BEHAVIOR_CONSULT_TYPE_ID,
        EZYVET_BEHAVIOR_VET_CARE_TRAINING_TYPE_ID,
        EZYVET_BEHAVIOR_FU_IN_PERSON_TYPE_ID,
        EZYVET_BEHAVIOR_FU_VIRTUAL_TYPE_ID,
        EZYVET_BEHAVIOR_OFF_SITE_1_TYPE_ID,
        EZYVET_BEHAVIOR_OFF_SITE_2_TYPE_ID,
        EZYVET_BEHAVIOR_OFF_SITE_3_TYPE_ID,
        EZYVET_BEHAVIOR_OFF_SITE_EXTENDED_TYPE_ID,
        EZYVET_COMFORT_CONSULT_1_TYPE_ID,
        EZYVET_COMFORT_CONSULT_2_TYPE_ID,
        EZYVET_COMFORT_CONSULT_3_TYPE_ID,
        EZYVET_COMFORT_EUTH_TYPE_ID,
        EZYVET_COMFORT_AT_HOME_EUTH_TYPE_ID
    ],
    'special',
    OTHER_APPT_COLOR, // light orange
    6
);

const EZYVET_IM_CONSULT_TYPE_ID = 26;
const EZYVET_IM_RECECK_TYPE_ID = 27;
const EZYVET_IM_PROCEDURE_TYPE_ID = 34;
const EZYVET_IM_TECH_APPT_TYPE_ID = 35;
const IM_APPT_CATEGORY = new ApptCategory(
    [
        EZYVET_IM_CONSULT_TYPE_ID,
        EZYVET_IM_RECECK_TYPE_ID,
        EZYVET_IM_PROCEDURE_TYPE_ID,
        EZYVET_IM_TECH_APPT_TYPE_ID
    ],
    'im',
    '#d9d2e9', // light purple
    5
);

const EZYVET_TECH_APPT_TYPE_ID = 19;
const EZYVET_DT_TECH_APPT_TYPE_ID = 85;
const EZYVET_AGE_TNT_APPT_TYPE_ID = 121;
const TECH_APPT_CATEGORY = new ApptCategory(
    [
        EZYVET_TECH_APPT_TYPE_ID,
        EZYVET_DT_TECH_APPT_TYPE_ID,
        EZYVET_AGE_TNT_APPT_TYPE_ID,
    ],
    'tech',
    '#90EE90', // pastel green
    OTHER_PROCEDURE_SORT_VALUE
);

const EZYVET_EUTH_APPT_ID = 80;
const EZYVET_DT_EUTH_APPT_ID = 87;
const EUTH_APPT_CATEGORY = new ApptCategory(
    [EZYVET_EUTH_APPT_ID, EZYVET_DT_EUTH_APPT_ID],
    'euth',
    '#cfe2f3', // light blue
    OTHER_PROCEDURE_SORT_VALUE
);

const EZYVET_ACTH_STIM_APPT_ID = 31;
const EZYVET_BILE_ACIDS_APPT_ID = 32;
const EZYVET_BG_CURVE_APPT_ID = 33;
const EZYVET_SEDATED_PROCEDURE_APPT_ID = 36;
const EZYVET_LDDST_APPT_ID = 38;
const EZYVET_DROP_OFF_APPT_ID = 82;
const EZYVET_HOSP_PT_APPT_ID = 83;
const EZYVET_DT_SEDATED_PROCEDURE_APPT_ID = 88;
const OTHER_APPT_CATEGORY = new ApptCategory(
    [
        EZYVET_ACTH_STIM_APPT_ID,
        EZYVET_BILE_ACIDS_APPT_ID,
        EZYVET_BG_CURVE_APPT_ID,
        EZYVET_SEDATED_PROCEDURE_APPT_ID,
        EZYVET_LDDST_APPT_ID,
        EZYVET_DROP_OFF_APPT_ID,
        EZYVET_HOSP_PT_APPT_ID,
        EZYVET_DT_SEDATED_PROCEDURE_APPT_ID,
    ],
    'other',
    OTHER_APPT_COLOR,
    OTHER_PROCEDURE_SORT_VALUE,
);

const EZYVET_WELLNESS_APPT_ID = 115;
const EZYVET_ILLNESS_APPT_ID = 116;
const EZYVET_FU_ROUTINE_EYE_EAR_APPT_ID = 117;
const EZYVET_FU_ILLNESS_APPT_ID = 122;
const CH_AND_WC_SCHEDULED_APPT_CATEGORY = new ApptCategory(
    [
        EZYVET_WELLNESS_APPT_ID,
        EZYVET_ILLNESS_APPT_ID,
        EZYVET_FU_ROUTINE_EYE_EAR_APPT_ID,
        EZYVET_FU_ILLNESS_APPT_ID
    ],
    'ch and wc non procedure dvm appointments',
    '#ff9fbd', // flamingo pink
    OTHER_PROCEDURE_SORT_VALUE
);

const APPT_CATEGORIES = [
    SX_APPT_CATEGORY,
    AUS_APPT_CATEGORY,
    ECHO_APPT_CATEGORY,
    DENTAL_APPT_CATEGORY,
    SPECIAL_APPT_CATEGORY,
    IM_APPT_CATEGORY,
    TECH_APPT_CATEGORY,
    EUTH_APPT_CATEGORY,
    OTHER_APPT_CATEGORY,
    CH_AND_WC_SCHEDULED_APPT_CATEGORY
];

const TYPE_ID_TO_CATEGORY = new Map();
APPT_CATEGORIES.forEach(category => {
    category.ezyVetTypeIds.forEach(id => {
        TYPE_ID_TO_CATEGORY.set(id, category);
    });
});

// ezyvet resource ids
const CH_PROCEDURE_1_RESOURCE_ID = 29;
const CH_PROCEDURE_2_RESOURCE_ID = 30;
const CH_IM_RESOURCE_ID = 27;
const CH_IM_PROCEDURE_RESOURCE_ID = 65;
const CH_DVM_4_APPTS_RESOURCE_ID = 1063;
const CH_TECH_RESOURCE_ID = 28;
const CH_TNT_AGE_RESOURCE_ID = 1066;
const WC_TNT_AGE_RESOURCE_ID = 973;
const DT_PROCEDURE_1_RESOURCE_ID = 57;
const DT_PROCEDURE_2_RESOURCE_ID = 58;
const DT_TECH_RESOURCE_ID = 56;
const WC_PROCEDURE_1_RESOURCE_ID = 61;
const WC_PROCEDURE_2_RESOURCE_ID = 62;
const WC_DVM_3_APPTS_RESOURCE_ID = 1384;
const WC_TECH_RESOURCE_ID = 60;
const DT_DVM_RESOURCE_IDS = [ // non procedures dt columns
    35, // dt dvm 1
    1082, // dt DVM :15/:45
];

const SCHEDULED_DVM_APPTS_RESOURCE_IDS = [
    CH_DVM_4_APPTS_RESOURCE_ID,
    WC_DVM_3_APPTS_RESOURCE_ID
];

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

const NON_PROCEDURE_SCHEDULED_APPT_RESOURCE_IDS = [
    ...DT_DVM_RESOURCE_IDS,
    ...SCHEDULED_DVM_APPTS_RESOURCE_IDS,
    DT_TECH_RESOURCE_ID,
    WC_TECH_RESOURCE_ID,
    CH_TECH_RESOURCE_ID,
    CH_TNT_AGE_RESOURCE_ID,
    WC_TNT_AGE_RESOURCE_ID,
];

const IM_RESOURCE_IDS = [CH_IM_RESOURCE_ID, CH_IM_PROCEDURE_RESOURCE_ID];

// dt
const DT_DVM_APPT_IDS = [
    79, // downtown - appointment
    95, // Downtown - Appointment (:15/:45)
    93, // Downtown - Same Day Sick
];

function CONTAINS_VALID_DT_NDA_IDS(resourceIds, apptTypeId) {
    return resourceIds.some(id => DT_DVM_RESOURCE_IDS.includes(Number(id))) // is in a DT exam column
        && DT_DVM_APPT_IDS.includes(Number(apptTypeId)); // is a dt doctor exam type
};

const WC_SX_LOBBY_STATUS_ID = 44;
const CAT_LOBBY_STATUS_ID = 40;

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
    [CAT_LOBBY_STATUS_ID]: { // cat lob
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
    [WC_SX_LOBBY_STATUS_ID]: { // wc sx lobby
        [CH_SHEET_NAME]: null,
        [DT_SHEET_NAME]: null,
        [WC_SHEET_NAME]: 'F13:F21' // first column
    }

};
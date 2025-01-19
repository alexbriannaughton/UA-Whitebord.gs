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

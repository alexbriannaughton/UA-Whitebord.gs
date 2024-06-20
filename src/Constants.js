const proxy = 'https://api.ezyvet.com';
const sitePrefix = 'https://urbananimalnw.usw2.ezyvet.com';

const speciesMap = { 1: 'K9', 2: 'FEL' }; // ezyvet animal.species_id => species string

const userTimezone = 'America/Los_Angeles';

const dateStringPattern = 'EEEE MM/dd/yyyy';

const dtNextDayApptsCoords = 'K15:R85';

const sameFamString = '^same fam^';

const echoApptTypeIDsSet = new Set([30]);
const ausApptTypeIDsSet = new Set([29, 91]);

const dtDVMColumnResourceIDs = new Set([ // non procedures dt columns
    '35', // dt dvm 1
    '55', // used to be dt dvm 2, though it is not currently active 3/16/24
    // '56', // dt tech
    '1015', // used to be dt dvm 3, though it is not currently active 3/16/24
    '1082' // dt DVM :15/:45
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

const typeCategoryToColorMap = new Map([
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
const inpatientDefaultColorMap = new Map([
    ['CH', '#f3f3f3'], // gray for cap hill
    ['DT', '#d0e0e3'], // cyan for downtown
    ['WC', '#ead1dc']  // magenta for white center
]);

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

// returns the cell coordinates for the location's inpatient box
function inpatientBoxCoords(location) {
    return location === 'CH'
        ? 'R3:W36' // coords for cap hills inpatient box
        : 'B14:H42'; // coords for dt and wc inpatient boxes
};
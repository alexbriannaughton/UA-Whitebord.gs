const proxy = 'https://api.ezyvet.com';
const sitePrefix = 'https://urbananimalnw.usw2.ezyvet.com';
let token;
let props;

function putTokenInCache(cache, token) {
    cache.put('ezyVet_token', token, 30600); // store for 8.5 hours
}

const speciesMap = { 1: 'K9', 2: 'FEL' }; // ezyvet animal.species_id => species string

const userTimezone = 'America/Los_Angeles';

const echoApptTypeIDsSet = new Set([30]);
const ausApptTypeIDsSet = new Set([29, 91]);

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

// returns the cell coordinates for the location's inpatient box
function inpatientBoxCoords(location) {
    return location === 'CH'
        ? 'R3:W36' // coords for cap hills inpatient box
        : 'B14:H42'; // coords for dt and wc inpatient boxes
};
const proxy = 'https://api.ezyvet.com';
const sitePrefix = 'https://urbananimalnw.usw2.ezyvet.com';

// takes appointment.type_id and outputs a string for the procedure type
const typeIDToNameMap = new Map([
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

const typeNameToColorMap = new Map([
    ['tech', '#90EE90'], // bright green
    ['euth', '#cfe2f3'], // blue
    ['sx', '#fff2cc'],// light yellowish
    ['aus', '#cfe2f3'],// light blue 3
    ['echo', '#f4cccc'],// light red
    ['dental', '#d9ead3'], // light green
    ['h/c', '#fce5cd'],// light orangish
    ['secondary', '#fce5cd']// light orangish
]); // note that IM is not handled here -- handle seperately bc we also take resource column into account
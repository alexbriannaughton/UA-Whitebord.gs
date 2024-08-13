const proxy = 'https://api.ezyvet.com';
const sitePrefix = 'https://urbananimalnw.usw2.ezyvet.com';

const unknownSpeciesString = 'unknown species';

const userTimezone = 'America/Los_Angeles';

const dateStringPattern = 'EEEE MM/dd/yyyy';

const dtNextDayApptsRowStartNumber = 15;
const dtNextDayApptsCoords = `K${dtNextDayApptsRowStartNumber}:R85`;

const sameFamString = '^same fam^';

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

const locationTextedColorMap = new Map([
    ['CH', '#ff9fbd'],
    ['WC', 'yellow']
]);

// returns the cell coordinates for the location's inpatient box
function inpatientBoxCoords(location) {
    return location === 'CH'
        ? 'R3:W36' // coords for cap hills inpatient box
        : 'B14:H42'; // coords for dt and wc inpatient boxes
};
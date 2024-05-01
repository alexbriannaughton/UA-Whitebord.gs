const highPriorityColor = '#ffff00';

async function getTomorrowsDTAppts() {
    console.log('running getTomrrowsDTAppts job...');
    const [tomorrowStart, tomorrowEnd] = epochRangeForTomorrow();
    const tomorrowsDateStr = convertEpochToUserTimezoneDate(tomorrowStart);
    console.log('querying for tomorrows appointments...')
    const url = `${proxy}/v1/appointment?active=1&time_range_start=${tomorrowStart}&time_range_end=${tomorrowEnd}&limit=200`;
    const allOfTomorrowsAppts = fetchAndParse(url);
    const dtAppts = filterAndSortDTAppts(allOfTomorrowsAppts);
    await getAllEzyVetData(dtAppts, tomorrowsDateStr);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DT Next Day Checklist');
    const range = sheet.getRange(`A4:H204`)
    range.clearContent()
        .setWrap(true)
        .setFontColor("black")
        .setBackground("white")
        .setFontLine("none");

    putDataOnSheet(dtAppts, range, tomorrowsDateStr);
};

function filterAndSortDTAppts(allOfTomorrowsAppts) {
    // filter all appts down to DT exams/techs
    const dtResourceIDs = new Set([ // non procedures dt columns
        '35', // dt dvm 1
        '55', // used to be dt dvm 2, though it is not currently active 3/16/24
        // '56', // dt tech
        '1015', // used to be dt dvm 3, though it is not currently active 3/16/24
        '1082' // dt DVM :15/:45
    ]);
    const dtAppts = allOfTomorrowsAppts.items.filter(({ appointment }) => {
        return appointment.details.resource_list.some(id => dtResourceIDs.has(id)) // is in a DT exam or tech column
            && appointment.details.appointment_type_id !== '4'; // & is not a blocked off spot
    });

    return dtAppts.sort((a, b) => a.appointment.start_time - b.appointment.start_time);
    // .slice(0, 3); // slicing for dev
};

// get data from all endpoints that we care about that are associated with each appointment
async function getAllEzyVetData(dtAppts, tomorrowsDateStr) {
    const animalAttachmentData = firstRoundOfFetches(dtAppts); // animal, contact, consults for animal, prescriptions
    const ezyVetFolder = driveFolderProcessing(tomorrowsDateStr);
    const consultAttachmentData = secondRoundOfFetches(dtAppts); // prescription items, other animals of contact
    await processRecords(animalAttachmentData, consultAttachmentData, dtAppts, ezyVetFolder)
    fetchDataToCheckIfFirstTimeClient(dtAppts, tomorrowsDateStr);
}
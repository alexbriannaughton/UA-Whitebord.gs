// Index.js
// dtJobMain is the main function for the job that grabs the next day of dt appointments
async function dtJobMain() {
    const startTime = new Date();
    console.log('running getTomrrowsDTAppts job...');
    const  { dtAppts, targetDateStr } = getNextDayDtAppts();
    await getAllEzyVetData(dtAppts, targetDateStr);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DT');
    const range = sheet.getRange(`K15:R60`)
    formatNextDayApptsCells(sheet, range, dtAppts.length);
    putDataOnSheet(dtAppts, range, targetDateStr);
    const endTime = new Date();
    const executionTime = (endTime - startTime) / 1000;
    console.log(`finished getTomorrowsDtAppts job at ${executionTime} seconds!`);
};

function getNextDayDtAppts() {
    let dtAppts = [];
    let daysAhead = 0;
    let targetDateStr;
    while (!dtAppts.length && daysAhead < 10) {
        const [targetDayStart, targetDayEnd] = epochRangeForFutureDay(++daysAhead);
        targetDateStr = convertEpochToUserTimezoneDate(targetDayStart);
        console.log(`querying for appointments on ${targetDateStr}...`);
        const url = `${proxy}/v1/appointment?active=1&time_range_start=${targetDayStart}&time_range_end=${targetDayEnd}&limit=200`;
        const allTargetDayAppts = fetchAndParse(url);
        dtAppts = filterAndSortDTAppts(allTargetDayAppts);
    }
    return { dtAppts, targetDateStr};
}

function filterAndSortDTAppts(allTargetDayAppts) {
    // filter all appts down to DT exams/techs
    const dtResourceIDs = new Set([ // non procedures dt columns
        '35', // dt dvm 1
        '55', // used to be dt dvm 2, though it is not currently active 3/16/24
        // '56', // dt tech
        '1015', // used to be dt dvm 3, though it is not currently active 3/16/24
        '1082' // dt DVM :15/:45
    ]);
    const dtAppts = allTargetDayAppts.items.filter(({ appointment }) => {
        return appointment.details.resource_list.some(id => dtResourceIDs.has(id)) // is in a DT exam or tech column
            && appointment.details.appointment_type_id !== '4'; // & is not a blocked off spot
    });

    return dtAppts.sort((a, b) => a.appointment.start_time - b.appointment.start_time);
    // .slice(0, 3); // slicing for dev
};

// fetch data for all appointments from all endpoints that we care about
async function getAllEzyVetData(dtAppts, targetDateStr) {
    // ezyvet endpoints: animal, contact, consults, prescriptions, attachments of animal_id
    const animalAttachmentData = firstRoundOfFetches(dtAppts);
    const ezyVetFolder = driveFolderProcessing(targetDateStr);
    // get more data for every appointment for the following endponts:
    // prescription items, other animals of contact, attachments based on all of the animal's consults
    const consultAttachmentData = secondRoundOfFetches(dtAppts);
    await processRecords(animalAttachmentData, consultAttachmentData, dtAppts, ezyVetFolder)
    fetchDataToCheckIfFirstTimeClient(dtAppts, targetDateStr);
}
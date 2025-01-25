// Index.js
// dtJobMain is the main function for the job that grabs the next day of dt appointments
async function dtJobMain() {
    const startTime = new Date();
    console.log('running getTomrrowsDTAppts job...');
    const { dtAppts, targetDateStr } = getNextDayDtAppts();
    await getAllEzyVetData(dtAppts, targetDateStr);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DT_SHEET_NAME); 
    const range = sheet.getRange(DT_NDA_COORDS);
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
        const url = `${EV_PROXY}/v1/appointment?active=1&time_range_start=${targetDayStart}&time_range_end=${targetDayEnd}&limit=200`;
        const allTargetDayAppts = fetchAndParse(url);
        dtAppts = filterAndSortDTAppts(allTargetDayAppts);
    }
    CacheService.getScriptCache().put('days_to_next_dt_appts', daysAhead, 21600);
    return { dtAppts, targetDateStr };
}

function filterAndSortDTAppts(allTargetDayAppts) {
    // filter all appts down to DT exams/techs
    const dtAppts = FILTER_FOR_VALID_DT_NDAS(allTargetDayAppts);

    dtAppts.sort((a, b) => a.appointment.start_time - b.appointment.start_time);

    // check for contacts with multiple appointments for different pets who are scheduled within an hour of each other
    for (let i = 0; i < dtAppts.length - 1; i++) {
        const appt1 = dtAppts[i];
        for (let j = i + 1; j < dtAppts.length; j++) {
            const appt2 = dtAppts[j];
            
            const withinAnHour = Math.abs(appt2.appointment.start_time - appt1.appointment.start_time) <= 3600; 
            if (!withinAnHour) break;

            const isSameContact = appt1.appointment.details.contact_id === appt2.appointment.details.contact_id;
            if (isSameContact) {
                dtAppts.splice(j, 1);
                dtAppts.splice(i + 1, 0, appt2);
                break;
            }
        }
    }

    return dtAppts
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
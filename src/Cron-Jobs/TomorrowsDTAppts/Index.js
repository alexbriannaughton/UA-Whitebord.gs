// Index.js
// dtJobMain is the main function for the job that grabs the next day of dt appointments
async function executeNdaJobDt() {
    const startTime = new Date();
    console.log('running nda job for dt...');
    const ndaSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('NDAs');
    ndaSheet.getRange("A3:H").clearContent()
        .setWrap(true)
        .setFontColor("black")
        .setBackground("white")
        .setFontLine("none")
        .setBorder(false, false, false, false, false, false);
    const headerRow = [
        "Time:",
        "Patient name:",
        "Deposit paid:",
        "Reason:",
        "First time?",
        "Records:",
        "Hx fractious:",
        "Traz/gaba:",
        "Location:"
    ];
    ndaSheet.getRange(1, 1, 1, headerRow.length)
        .setValues([headerRow])
        .setFontWeight("bold")
        .setBackground("#d9d9d9");
    // Freeze the header row
    ndaSheet.setFrozenRows(1);

    const uaLoc = DT_SHEET_NAME;
    const { appts, targetDateStr } = getNextDayAppts(uaLoc);
    await getAllEzyVetData(appts, targetDateStr);
    const dtNdaRange = ndaSheet.getRange(`A3:H${appts.length}`);
    formatNextDayApptsCells(ndaSheet, dtNdaRange, appts.length, targetDateStr, uaLoc);
    putDataOnSheet(appts, range);
    const endTime = new Date();
    const executionTime = (endTime - startTime) / 1000;
    console.log(`finished nda job for dt at ${executionTime} seconds!`);
}
async function executeNdaJobCh() {
    const startTime = new Date();
    console.log('running nda job for ch...');
    const ndaSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('NDAs');
    const uaLoc = CH_SHEET_NAME;
    const { appts, targetDateStr } = getNextDayAppts(uaLoc);
    await getAllEzyVetData(appts, targetDateStr);
    const lastRowWithData = ndaSheet.getLastRow();
    const chNdaRange = ndaSheet.getRange(lastRowWithData + 2, 1, appts.length, 8);;
    formatNextDayApptsCells(ndaSheet, chNdaRange, appts.length, targetDateStr, uaLoc);
    putDataOnSheet(appts, range);
    const endTime = new Date();
    const executionTime = (endTime - startTime) / 1000;
    console.log(`finished nda job for ch at ${executionTime} seconds!`);
}
async function ndaJobMain(range, targetDateStr) {
    // const { appts, targetDateStr } = getNextDayAppts(uaLoc);
    // await getAllEzyVetData(appts, targetDateStr);
    // const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DT_SHEET_NAME);
    // const range = sheet.getRange(DT_NDA_COORDS);
    // const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('NDAs');
    // const range = sheet.getRange(`A3:H${appts.length + 10}`);
    // formatNextDayApptsCells(sheet, range, appts.length);
    // putDataOnSheet(appts, range, targetDateStr);
};

function getNextDayAppts(uaLoc) {
    let appts = [];
    let daysAhead = 0;
    let targetDateStr;
    while (!appts.length && daysAhead < 10) {
        const [targetDayStart, targetDayEnd] = epochRangeForFutureDay(++daysAhead);
        targetDateStr = convertEpochToUserTimezoneDate(targetDayStart);
        console.log(`querying for appointments on ${targetDateStr}...`);
        const url = `${EV_PROXY}/v1/appointment?active=1&time_range_start=${targetDayStart}&time_range_end=${targetDayEnd}&limit=200`;
        const allTargetDayAppts = fetchAndParse(url);
        appts = filterAndSortAppts(allTargetDayAppts, uaLoc);
    }
    CacheService.getScriptCache().put(`days_to_next_${uaLoc.toLowerCase()}_appts`, daysAhead, 21600);
    return { appts, targetDateStr };
}

function filterAndSortAppts(allTargetDayAppts, uaLoc) {
    const allPossResourceIds = NDA_SCHEDULED_RESOURCES_MAP[uaLoc];
    const allPossApptTypeIds = NDA_APPT_TYPES_MAP[uaLoc];
    // filter all appts down to exams/techs
    const appts = allTargetDayAppts.items
        .filter(({ appointment }) => containsValidNdaIds(
            allPossResourceIds,
            allPossApptTypeIds,
            appointment.details.resource_list,
            appointment.details.appointment_type_id
        ));

    appts.sort((a, b) => a.appointment.start_time - b.appointment.start_time);

    // check for contacts with multiple appointments for different pets who are scheduled within an hour of each other
    for (let i = 0; i < appts.length - 1; i++) {
        const appt1 = appts[i];
        for (let j = i + 1; j < appts.length; j++) {
            const appt2 = appts[j];

            const withinAnHour = Math.abs(appt2.appointment.start_time - appt1.appointment.start_time) <= 3600;
            if (!withinAnHour) break;

            const isSameContact = appt1.appointment.details.contact_id === appt2.appointment.details.contact_id;
            if (isSameContact) {
                appts.splice(j, 1);
                appts.splice(i + 1, 0, appt2);
                break;
            }
        }
    }

    return appts
    // .slice(0, 3); // slicing for dev


};

// fetch data for all appointments from all endpoints that we care about
async function getAllEzyVetData(appts, targetDateStr) {
    // ezyvet endpoints: animal, contact, consults, prescriptions, attachments of animal_id
    const animalAttachmentData = firstRoundOfFetches(appts);
    const ezyVetFolder = driveFolderProcessing(targetDateStr);
    // get more data for every appointment for the following endponts:
    // prescription items, other animals of contact, attachments based on all of the animal's consults
    const consultAttachmentData = secondRoundOfFetches(appts);
    await processRecords(animalAttachmentData, consultAttachmentData, appts, ezyVetFolder)
    fetchDataToCheckIfFirstTimeClient(appts, targetDateStr);
}
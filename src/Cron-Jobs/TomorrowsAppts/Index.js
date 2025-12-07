// Index.js
async function runAllNdaJobs() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ndaSheet = ss.getSheetByName('NDAs');

    // 1) Baseline formatting once at the top
    setBaselineNdaConditionalFormatting(ndaSheet);

    // 2) DT first, as the main block at A3
    await executeNdaJob(ndaSheet, DT_SHEET_NAME, { isFirstSection: true });

    // 3) Other locations appended below
    const otherLocations = ['CH', 'WC']; // add/remove as needed

    for (const loc of otherLocations) {
        await executeNdaJob(ndaSheet, loc);
    }
}

async function executeNdaJob(ndaSheet, sheetName, { isFirstSection = false } = {}) {
    const startTime = new Date();
    console.log(`running nda job for ${sheetName}...`);

    const uaLoc = sheetName;
    const { appts, targetDateStr } = getNextDayAppts(uaLoc);
    await getAllEzyVetData(appts, targetDateStr, uaLoc);

    let range;

    if (isFirstSection) {
        // DT-style section: fixed start at A3
        // A3 with `appts.length` rows and 8 columns (A–H)
        range = ndaSheet.getRange(3, 1, appts.length, 8);
    } else {
        // Other locations: append after existing data + 2 blank rows
        const lastRowWithData = ndaSheet.getLastRow();
        range = ndaSheet.getRange(lastRowWithData + 2, 1, appts.length, 8);
    }

    formatNextDayApptsCells(ndaSheet, range, appts.length, targetDateStr, uaLoc);
    putDataOnSheet(appts, range);

    const executionTime = (new Date() - startTime) / 1000;
    console.log(`finished nda job for ${sheetName} at ${executionTime} seconds!`);
}


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
async function getAllEzyVetData(appts, targetDateStr, uaLoc) {
    // ezyvet endpoints: animal, contact, consults, prescriptions, attachments of animal_id
    const animalAttachmentData = firstRoundOfFetches(appts);
    const ezyVetFolder = driveFolderProcessing(targetDateStr, uaLoc);
    // get more data for every appointment for the following endponts:
    // prescription items, other animals of contact, attachments based on all of the animal's consults
    const consultAttachmentData = secondRoundOfFetches(appts);
    await processRecords(animalAttachmentData, consultAttachmentData, appts, ezyVetFolder)
    fetchDataToCheckIfFirstTimeClient(appts, targetDateStr);
}

// this will run with a daily trigger to put scheduled procedures in the in patient box.
function getTodaysAppointments() {
    console.log('running getTodaysAppointments in ScheduledProcedures.js...');
    getCacheVals();
    const [todayStart, todayEnd] = getTodayRange();
    const url = `${EV_PROXY}/v1/appointment?time_range_start=${todayStart}&time_range_end=${todayEnd}&limit=200`;
    const appts = fetchAndParse(url);
    return processProcedures(appts.items);
};

function processProcedures(apptItems) {
    const allLocationProcedures = new Map(
        ALL_LOCATION_SHEETS.map(sheetName => [sheetName, []])
    );

    apptItems.sort((a, b) => a.appointment.start_time - b.appointment.start_time);

    apptItems.forEach(({ appointment }) => {
        const resourceID = Number(appointment.details.resource_list[0]);
        if (!SCHEDULED_PROCEDURES_RESOURCE_IDS.includes(resourceID)) return;
        if (UNHANDLED_APPT_TYPE_IDS.includes(Number(appointment.details.appointment_type_id))) return;
        const uaLoc = whichLocation(resourceID);
        const procedure = getColorAndSortValue(appointment.details, resourceID);
        const uaLocSheetName = UA_LOC_SHEET_NAMES_MAP[uaLoc];
        allLocationProcedures.get(uaLocSheetName).push(procedure);
    });

    allLocationProcedures.forEach((oneLocationProcedures, uaLocSheetName) => {
        oneLocationProcedures.sort((a, b) => {
            return a.sortValue === b.sortValue
                ? Number(a.appointment_type_id) - Number(b.appointment_type_id)
                : a.sortValue - b.sortValue;
        });
        addScheduledProcedures(oneLocationProcedures, uaLocSheetName);
    });
};

function getColorAndSortValue(procedure, resourceID) {
    // this function sorts procedures by type and adds a color to the procedure/appointment object
    const isInImColumn = [CH_IM_RESOURCE_ID, CH_IM_PROCEDURE_RESOURCE_ID].includes(resourceID);
    let apptCategory = isInImColumn
        ? IM_APPT_CATEGORY
        : TYPE_ID_TO_CATEGORY.get(Number(procedure.appointment_type_id));

    if (!apptCategory || [TECH_APPT_CATEGORY, EUTH_APPT_CATEGORY].includes(apptCategory)) {
        apptCategory = OTHER_APPT_CATEGORY;
    }

    procedure = { ...procedure, ...apptCategory };

    return procedure;
};

function addScheduledProcedures(oneLocationProcedures, uaLocSheetName) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(uaLocSheetName);
    const inpatientBox = sheet.getRange(UA_LOC_INPATIENT_COORDS.get(uaLocSheetName));
    const defaultColor = UA_LOC_INPATIENT_DEFAULT_COLOR.get(uaLocSheetName);
    clearInpatientBox(inpatientBox, defaultColor);
    const numOfColumnsInBox = inpatientBox.getNumColumns();
    let rowOfInpatientBox = 0;
    for (const procedure of oneLocationProcedures) {
        if (!procedure.animal_id) continue; // skip the empty object
        const rowRange = inpatientBox.offset(rowOfInpatientBox++, 0, 1, numOfColumnsInBox);
        rowRange.setBackground(procedure.color || defaultColor);
        populateInpatientRow(procedure, rowRange, uaLocSheetName);
    }
    return;
};

function clearInpatientBox(inpatientBox, color) {
    inpatientBox
        .clearContent()
        .setBackground(color)
        .setFontColor('black')
        .setFontLine(null);
    return;
};
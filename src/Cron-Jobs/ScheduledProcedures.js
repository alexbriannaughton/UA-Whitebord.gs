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
        const resourceID = appointment.details.resource_list[0];
        if (!SCHEDULED_PROCEDURES_RESOURCE_IDS.includes(resourceID)) return;
        const uaLoc = whichLocation(resourceID);
        const procedure = getColorAndSortValue(appointment.details, resourceID);
        const uaLocSheetName = UA_LOC_SHEET_NAMES_MAP[uaLoc]
        allLocationProcedures.get(uaLocSheetName).push(procedure);
    });

    allLocationProcedures.forEach((oneLocationProcedures, uaLocSheetName) => {
        oneLocationProcedures.sort((a, b) => a.sortValue - b.sortValue);
        addScheduledProcedures(oneLocationProcedures, uaLocSheetName);
    });
};

function getColorAndSortValue(procedure, resourceID) {
    // this function sorts procedures by type and adds a color to the procedure/appointment object
    const procedureName = TYPE_ID_TO_CATEGORY.get(
        parseInt(procedure.appointment_type_id)
    );
    procedure.color = APPT_CATEGORY_TO_COLOR.get(procedureName);

    // anything that is in the IM column, despite the appointment_type, will be grouped as IM
    if (resourceID === '27' || resourceID === '65' || procedureName === 'IM') {
        procedure.color = APPT_CATEGORY_TO_COLOR.get('IM');
        procedure.sortValue = 5;
    }
    else if (procedureName === 'sx') {
        procedure.sortValue = 0;
    }
    else if (procedureName === 'aus') {
        procedure.sortValue = 1;
    }
    else if (procedureName === 'echo') {
        procedure.sortValue = 2;
    }
    else if (procedureName === 'dental') {
        procedure.sortValue = 4;
    }
    else if (procedureName === 'h/c') {
        procedure.sortValue = 6;
    }
    else procedure.sortValue = 3; // put before im, dental and h/c if type_id not mentioned above

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
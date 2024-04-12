// this will run with a daily trigger to put scheduled procedures in the in patient box.
function getTodaysAppointments() {
    console.log('running getTodaysAppointments in ScheduledProcedures.js...');
    const [todayStart, todayEnd] = getTodayRange();
    const url = `${proxy}/v1/appointment?time_range_start=${todayStart}&time_range_end=${todayEnd}&limit=200`;
    const appts = fetchAndParse(url);
    return processProcedures(appts.items);
};

function processProcedures(apptItems) {
    const allLocationProcedures = new Map([
        ['CH', []],
        ['DT', []],
        ['WC', []]
    ]);

    const locationForProcedureMap = new Map([
        ['29', 'CH'], ['30', 'CH'], // cap hill resource ids for procedure columns
        ['27', 'CH'], ['65', 'CH'], // cap hill resource ids for IM columns
        ['57', 'DT'], ['58', 'DT'], // dt resource ids for procedure columns
        ['61', 'WC'], ['62', 'WC'], // wc resource ids for procedure columns
    ]); // this map serves to check if the appointment is in the above column, and sorts per location

    apptItems.forEach(({ appointment }) => {
        const resourceID = appointment.details.resource_list[0];
        const location = locationForProcedureMap.get(resourceID);

        if (location) {
            const procedure = getColorAndSortValue(appointment.details, resourceID);
            allLocationProcedures.get(location).push(procedure);
        }
    });

    allLocationProcedures.forEach((oneLocationProcedures, location) => {
        oneLocationProcedures.sort((a, b) => a.sortValue - b.sortValue);
        addScheduledProcedures(oneLocationProcedures, location);
    });
};

function getColorAndSortValue(procedure, resourceID) {
    // this function sorts procedures by type and adds a color to the procedure/appointment object
    const procedureName = typeIDToCategoryMap.get(
        parseInt(procedure.appointment_type_id)
    );
    procedure.color = typeCategoryToColorMap.get(procedureName);

    // anything that is in the IM column, despite the appointment_type, will be grouped as IM
    if (resourceID === '27' || resourceID === '65' || procedureName === 'IM') {
        procedure.color = typeCategoryToColorMap.get('IM');
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

function addScheduledProcedures(oneLocationProcedures, location) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(location);
    const inpatientBox = sheet.getRange(inpatientBoxCoords(location));
    const defaultColor = inpatientDefaultColorMap.get(location);
    clearInpatientBox(inpatientBox, defaultColor);
    const numOfColumnsInBox = inpatientBox.getNumColumns();
    let rowOfInpatientBox = 0;
    for (const procedure of oneLocationProcedures) {
        if (!procedure.animal_id) continue; // skip the empty object
        const rowRange = inpatientBox.offset(rowOfInpatientBox++, 0, 1, numOfColumnsInBox);
        rowRange.setBackground(procedure.color || defaultColor);
        populateInpatientRow(procedure, rowRange);
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
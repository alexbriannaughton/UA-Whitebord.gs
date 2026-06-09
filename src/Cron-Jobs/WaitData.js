function getWaitData(numOfRoomsInUse, sheets) {
    const desiredCapText = getDesiredWaitlistCapText();
    const waitData = [
        getWaitValsForLocation(CH_SHEET_NAME, numOfRoomsInUse, sheets, desiredCapText),
        getWaitValsForLocation(WC_SHEET_NAME, numOfRoomsInUse, sheets, desiredCapText)
    ];
    return waitData;
}

function getWaitValsForLocation(uaLocSheetName, numOfRoomsInUse, sheets, desiredCapText) {
    const waitlistSheet = sheets.find(sheet => sheet.getName() === `${uaLocSheetName} Wait List`);
    const waitlistRange = waitlistSheet.getRange('C2:D4');
    const waitlistVals = waitlistRange.getValues();
    const currentCapText = waitlistVals[0][1];
    const capText = currentCapText === desiredCapText ? currentCapText : desiredCapText;

    if (currentCapText !== desiredCapText) {
        waitlistRange.offset(0, 1, 1, 1).setValue(desiredCapText);
    }

    const { soft_cap, hard_cap } = checkForCap(capText);

    const mainSheet = sheets.find(sheet => sheet.getName() === uaLocSheetName);
    const maxRoomCellCoords = UA_LOC_MAX_ROOMS_CELL_COORDS.get(uaLocSheetName);
    const cellValAsString = String(mainSheet.getRange(maxRoomCellCoords).getValue());
    const maxDvmRooms = Number(cellValAsString.slice(0, 2)) || 0;

    return {
        max_dvm_rooms: maxDvmRooms || 0,
        location: uaLocSheetName,
        soft_cap,
        hard_cap,
        dvms_on_floor: Number(waitlistVals[1][0]) || 0,
        wait_time: Number(waitlistVals[2][0]) || 0,
        pts_waiting: waitlistVals[0][0],
        rooms_in_use: numOfRoomsInUse[uaLocSheetName],
    };
}

function checkForCap(capText) {
    const soft_cap = capText === 'Cancellation List Only';
    const hard_cap = capText.includes('Not Currently Accepting Walk-ins');
    return { soft_cap, hard_cap };
}

function getDesiredWaitlistCapText(date = new Date()) {
    return isWalkinOpen(date) ? 'Currently Accepting Walk-ins' : 'Not Currently Accepting Walk-ins';
}

function isWalkinOpen(date) {
    const dayOfWeek = Utilities.formatDate(date, USER_TIMEZONE, 'EEE');
    const hour = Number(Utilities.formatDate(date, USER_TIMEZONE, 'H'));
    const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].indexOf(dayOfWeek) !== -1;
    const isOpenHour = hour >= 8 && hour < 19;

    return isWeekday && isOpenHour && !isUsFederalHoliday(date);
}

function isUsFederalHoliday(date) {
    const dateKey = Utilities.formatDate(date, USER_TIMEZONE, 'yyyy-MM-dd');
    const year = Number(Utilities.formatDate(date, USER_TIMEZONE, 'yyyy'));
    const holidays = getUsFederalHolidayKeys(year);

    return holidays.indexOf(dateKey) !== -1;
}

function getUsFederalHolidayKeys(year) {
    const holidayDates = [
        new Date(year, 0, 1), // New Year's Day
        getNthWeekdayOfMonth(year, 0, 1, 3), // Martin Luther King Jr. Day
        // getNthWeekdayOfMonth(year, 1, 1, 3), // Presidents' Day - UA is open
        getLastWeekdayOfMonth(year, 4, 1), // Memorial Day
        new Date(year, 5, 19), // Juneteenth
        new Date(year, 6, 4), // Independence Day
        getNthWeekdayOfMonth(year, 8, 1, 1), // Labor Day
        getNthWeekdayOfMonth(year, 9, 1, 2), // Indigenous Peoples' Day
        new Date(year, 10, 11), // Veterans Day
        getNthWeekdayOfMonth(year, 10, 4, 4), // Thanksgiving Day
        new Date(year, 11, 25), // Christmas Day
    ];

    return holidayDates.map(formatHolidayKey);
}

function getNthWeekdayOfMonth(year, monthIndex, weekday, occurrence) {
    const date = new Date(year, monthIndex, 1);
    const offset = (weekday - date.getDay() + 7) % 7;
    date.setDate(1 + offset + ((occurrence - 1) * 7));

    return date;
}

function getLastWeekdayOfMonth(year, monthIndex, weekday) {
    const date = new Date(year, monthIndex + 1, 0);
    const offset = (date.getDay() - weekday + 7) % 7;
    date.setDate(date.getDate() - offset);

    return date;
}

function formatHolidayKey(date) {
    return Utilities.formatDate(date, USER_TIMEZONE, 'yyyy-MM-dd');
}

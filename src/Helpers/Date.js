// check if utc timestamp is today in user timezone
function isTodayInUserTimezone(appointment) {
    const userTimeZoneDate = convertEpochToUserTimezoneDate(appointment.start_at);
    const todaysDate = Utilities.formatDate(
        new Date(),
        USER_TIMEZONE,
        DATE_STRING_PATTERN
    );
    return userTimeZoneDate === todaysDate;
}

function checkIfIsOnNextDayOfAppts(appointment, uaLoc) {
    const userTimeZoneDate = convertEpochToUserTimezoneDate(appointment.start_at);
    const date = new Date();
    date.setDate(date.getDate() + daysToNextApptsByUaLoc[uaLoc]);

    const nextDTApptDateFormatted = Utilities.formatDate(
        date,
        USER_TIMEZONE,
        DATE_STRING_PATTERN
    );

    return userTimeZoneDate === nextDTApptDateFormatted;
}

function convertEpochToUserTimezone(epoch) {
    return Utilities.formatDate(
        new Date(epoch * 1000),
        USER_TIMEZONE,
        'h:mm'
    );
};

function convertEpochToUserTimezoneDate(epoch) {
    return Utilities.formatDate(
        new Date(epoch * 1000),
        USER_TIMEZONE,
        DATE_STRING_PATTERN
    );
}

function getDateAtMidnight(epochInSecs) {
    const date = new Date(epochInSecs * 1000);
    date.setHours(0, 0, 0, 0);
    return date;
}

function getDateForEndOfToday() {
    const date = new Date();
    date.setHours(23, 59, 59, 999);
    return date;
}

function epochRangeForFutureDay(numOfDaysFromToday) {
    const now = new Date().toLocaleString("en-US", { timeZone: USER_TIMEZONE });
    const targetDay = new Date(now);
    targetDay.setDate(targetDay.getDate() + numOfDaysFromToday); // Move to targetDay
    const targetDayStart = Math.floor(targetDay.setHours(0, 0, 0, 0) / 1000);
    const targetDayEnd = Math.floor(targetDay.setHours(23, 59, 59, 999) / 1000);
    return [targetDayStart, targetDayEnd];
}

function getTodayRange() {
    const now = new Date().toLocaleString("en-US", { timeZone: USER_TIMEZONE });
    const todayStart = Math.floor(new Date(now).setHours(0, 0, 0, 0) / 1000);
    const todayEnd = Math.floor(new Date(now).setHours(23, 59, 59, 999) / 1000);
    return [todayStart, todayEnd];
};
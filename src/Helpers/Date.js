// check if utc timestamp is today in PST
function isTodayInUserTimezone(timestamp) {
    const timestampDate = Utilities.formatDate(
        new Date(timestamp * 1000),
        userTimezone,
        'yyyy-MM-dd'
    );
    const todaysDate = Utilities.formatDate(
        new Date(),
        userTimezone,
        'yyyy-MM-dd'
    );
    return timestampDate === todaysDate;
}

function convertEpochToUserTimezone(epoch) {
    return Utilities.formatDate(
        new Date(epoch * 1000),
        userTimezone,
        'h:mm'
    );
};

function convertEpochToUserTimezoneDate(epoch) {
    return Utilities.formatDate(
        new Date(epoch * 1000),
        userTimezone,
        'MM/dd/yyyy'
    );
}

function convertEpochToUserTimezoneDayOfWeek(epoch) {
    return Utilities.formatDate(
        new Date(epoch * 1000),
        userTimezone,
        'EEEE'
    );
}

function epochRangeForFutureDay(numOfDaysFromToday) {
    const now = new Date().toLocaleString("en-US", { timeZone: userTimezone });
    const targetDay = new Date(now);
    targetDay.setDate(targetDay.getDate() + numOfDaysFromToday); // Move to targetDay
    const targetDayStart = Math.floor(targetDay.setHours(0, 0, 0, 0) / 1000);
    const targetDayEnd = Math.floor(targetDay.setHours(23, 59, 59, 999) / 1000);
    return [targetDayStart, targetDayEnd];
}

function getTodayRange() {
    const now = new Date().toLocaleString("en-US", { timeZone: userTimezone });
    const todayStart = Math.floor(new Date(now).setHours(0, 0, 0, 0) / 1000);
    const todayEnd = Math.floor(new Date(now).setHours(23, 59, 59, 999) / 1000);
    return [todayStart, todayEnd];
};
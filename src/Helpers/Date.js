// check if utc timestamp is today in user timezone
function isTodayInUserTimezone(timestampDate) {
    const todaysDate = Utilities.formatDate(
        new Date(),
        userTimezone,
        dateStringPattern
    );
    return timestampDate === todaysDate;
}

function isOnNextDayOfDtAppts(timestampDate) {
    const date = new Date();
    date.setDate(date.getDate() + daysToNextDtAppts);
    const nextDTApptDateFormatted = Utilities.formatDate(
        date,
        userTimezone,
        'EEEE MM/dd/yyyy'
    );
    console.log('nextDTApptDateFormatted-->', nextDTApptDateFormatted)
    
    return timestampDate === nextDTApptDateFormatted;
}

function convertEpochToUserTimezone(epoch) {
    return Utilities.formatDate(
        new Date(epoch * 1000),
        userTimezone,
        'h:mm'
    );
};

function convertEpochToUserTimezone2(epoch) {
    return Utilities.formatDate(
        new Date(epoch * 1000),
        userTimezone,
        'h:mma'
    );
};

function convertEpochToUserTimezoneDate(epoch) {
    return Utilities.formatDate(
        new Date(epoch * 1000),
        userTimezone,
        dateStringPattern
    );
}

function getDateAtMidnight(epochInSecs) {
    const date = new Date(epochInSecs * 1000);
    date.setHours(0, 0, 0, 0);
    return date;
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
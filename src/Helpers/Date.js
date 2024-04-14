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

function epochRangeForTomorrow() {
    const now = new Date().toLocaleString("en-US", { timeZone: userTimezone });
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 2); // Move to tomorrow
    const tomorrowStart = Math.floor(tomorrow.setHours(0, 0, 0, 0) / 1000);
    const tomorrowEnd = Math.floor(tomorrow.setHours(23, 59, 59, 999) / 1000);
    return [tomorrowStart, tomorrowEnd];
}

function getTodayRange() {
    const now = new Date().toLocaleString("en-US", { timeZone: userTimezone });
    const todayStart = Math.floor(new Date(now).setHours(0, 0, 0, 0) / 1000);
    const todayEnd = Math.floor(new Date(now).setHours(23, 59, 59, 999) / 1000);
    return [todayStart, todayEnd];
};
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

function epochRangeForTomorrow() {
    // get epochs for range of tomorrow
    const now = new Date().toLocaleString("en-US", { timeZone: userTimezone });
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1); // Move to tomorrow
    const tomorrowStart = Math.floor(tomorrow.setHours(0, 0, 0, 0) / 1000); // midnight tomorrow in seconds
    const tomorrowEnd = Math.floor(tomorrow.setHours(23, 59, 59, 999) / 1000); // end of tomorrow in seconds
    return [tomorrowStart, tomorrowEnd];
}

function getTodayRange() {
    const now = new Date().toLocaleString("en-US", { timeZone: userTimezone });
    const todayStart = Math.floor(new Date(now).setHours(0, 0, 0, 0) / 1000); // midnight today in seconds
    const todayEnd = Math.floor(new Date(now).setHours(23, 59, 59, 999) / 1000); // end of day in seconds
    return [todayStart, todayEnd];
};
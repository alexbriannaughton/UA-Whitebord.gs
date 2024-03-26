// check if utc timestamp is today in PST
function isTodayInSeattle(timestamp) {
    const timestampDate = Utilities.formatDate(
        new Date(timestamp * 1000),
        'America/Los_Angeles',
        'yyyy-MM-dd'
    );
    const todaysDate = Utilities.formatDate(
        new Date(),
        'America/Los_Angeles',
        'yyyy-MM-dd'
    );
    return timestampDate === todaysDate;
}

function convertEpochToSeattleTime(epoch) {
    const date = new Date(epoch * 1000);
    return Utilities.formatDate(date, 'America/Los_Angeles', 'hh:mm a');
};

function epochRangeForTomorrow() {
    // get epochs for range of tomorrow
    const now = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1); // Move to tomorrow
    const tomorrowStart = Math.floor(tomorrow.setHours(0, 0, 0, 0) / 1000); // midnight tomorrow in seconds
    const tomorrowEnd = Math.floor(tomorrow.setHours(23, 59, 59, 999) / 1000); // end of tomorrow in seconds
    return [tomorrowStart, tomorrowEnd];
}

function getTodayRange() {
    const now = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
    const todayStart = Math.floor(new Date(now).setHours(0, 0, 0, 0) / 1000); // midnight today in seconds
    const todayEnd = Math.floor(new Date(now).setHours(23, 59, 59, 999) / 1000); // end of day in seconds
    return [todayStart, todayEnd];
};
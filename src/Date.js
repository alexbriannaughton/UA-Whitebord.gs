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
};

// convert utc time stamp to 12 hour time
// used for converting ezyVet timestamps
function getTime(timestamp) {
    const now = new Date(timestamp * 1000);
    const hour = now.getHours() > 12
        ? now.getHours() - 12
        : now.getHours();
    const minute = now.getMinutes() < 10
        ? `0${now.getMinutes()}`
        : now.getMinutes();
    return hour + ":" + minute;
};

function convertEpochToSeattleTime(epoch) {
    const date = new Date(epoch * 1000);
    return Utilities.formatDate(date, 'America/Los_Angeles', 'hh:mm a');
};
const TOKEN_NAME = 'ezyVet_token';
// const DAYS_TO_NDA_DT_APPTS_NAME = 'days_to_next_dt_appts';
const ALL_LOCS_DAYS_TO_NDA_KEY_NAMES = ALL_LOCATION_SHEETS.map(uaLoc => ndaUaLocTokenName(uaLoc));
const EZYVET_RESOURCE_TO_UA_LOC_NAME = 'ezyvet_resource_to_ua_loc';

let token;
let daysToNextDtAppts;
let daysToNextChAppts;
let daysToNextWcAppts;
let ezyVetResourceToUaLoc;
let daysToNextApptsByUaLoc = {};

function ndaUaLocTokenName(uaLoc) {
    return `days_to_next_${uaLoc}_appts`;
}

function getCacheVals() {
    const cache = CacheService.getScriptCache();
    const cacheVals = cache.getAll([TOKEN_NAME, ...ALL_LOCS_DAYS_TO_NDA_KEY_NAMES, EZYVET_RESOURCE_TO_UA_LOC_NAME]);

    token = cacheVals[TOKEN_NAME];
    if (!token) token = updateToken(cache);

    daysToNextApptsByUaLoc = {}; // reset

    ALL_LOCATION_SHEETS.forEach(uaLoc => {
        const keyName = ndaUaLocTokenName(uaLoc);
        let val = cacheVals[keyName];
        if (!val) val = getDaysAhead(cache, uaLoc);  // this function already writes to cache
        else val = Number(val);
        daysToNextApptsByUaLoc[uaLoc] = val;
    });

    const mapJson = cacheVals[EZYVET_RESOURCE_TO_UA_LOC_NAME];
    ezyVetResourceToUaLoc = handleEzyVetResourceMapCache(cache, mapJson);
}

function handleEzyVetResourceMapCache(cache, mapJson) {
    if (mapJson) return JSON.parse(mapJson);
    else return fetchAndBuildEzyVetResourceMap(cache);
}

function getDaysAhead(cache, uaLoc) {
    let foundDay = false;
    let daysAhead = 0;

    while (!foundDay && daysAhead < 10) {
        const [targetDayStart, targetDayEnd] = epochRangeForFutureDay(++daysAhead);

        const url = `${EV_PROXY}/v1/appointment?active=1&time_range_start=${targetDayStart}&time_range_end=${targetDayEnd}&limit=200`;

        const allTargetDayAppts = fetchAndParse(url);

        const appts = allTargetDayAppts.items
            .filter(({ appointment }) =>
                containsValidNdaIds(
                    NDA_SCHEDULED_RESOURCES_MAP[uaLoc],
                    NDA_APPT_TYPES_MAP[uaLoc],
                    appointment.details.resource_list,
                    appointment.details.appointment_type_id
                ));

        if (appts.length) foundDay = true;
    }

    if (!foundDay) {
        throw new Error('unable to find next day of dt appts in Cache.js');
    }

    console.log(`putting ${daysAhead} as ${ndaUaLocTokenName(uaLoc)} into cache...`);
    cache.put(ndaUaLocTokenName(uaLoc), daysAhead, 21600);
    return daysAhead;
};
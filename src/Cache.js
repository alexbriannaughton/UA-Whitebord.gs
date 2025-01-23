const TOKEN_NAME = 'ezyVet_token';
const DAYS_TO_NDA_DT_APPTS_NAME = 'days_to_next_dt_appts';
const EZYVET_RESOURCE_TO_UA_LOC_NAME = 'ezyvet_resource_to_ua_loc';

let token;
let daysToNextDtAppts;
let ezyVetResourceToUaLoc;

function getCacheVals() {
    const cache = CacheService.getScriptCache();
    const cacheVals = cache.getAll([TOKEN_NAME, DAYS_TO_NDA_DT_APPTS_NAME, EZYVET_RESOURCE_TO_UA_LOC_NAME]);

    token = cacheVals[TOKEN_NAME];
    if (!token) token = updateToken(cache);

    daysToNextDtAppts = Number(cacheVals[DAYS_TO_NDA_DT_APPTS_NAME]);
    if (!daysToNextDtAppts) daysToNextDtAppts = getDaysAheadDT(cache);

    const mapJson = cacheVals[EZYVET_RESOURCE_TO_UA_LOC_NAME];
    ezyVetResourceToUaLoc = handleEzyVetResourceMapCache(cache, mapJson);
}

function handleEzyVetResourceMapCache(cache, mapJson) {
    if (mapJson) return JSON.parse(mapJson);
    else return fetchAndBuildEzyVetResourceMap(cache);
}

function getDaysAheadDT(cache) {
    let foundDay = false;
    let daysAhead = 0;

    while (!foundDay && daysAhead < 10) {
        const [targetDayStart, targetDayEnd] = epochRangeForFutureDay(++daysAhead);
        const url = `${EV_PROXY}/v1/appointment?active=1&time_range_start=${targetDayStart}&time_range_end=${targetDayEnd}&limit=200`;
        const allTargetDayAppts = fetchAndParse(url);
        dtAppts = FILTER_FOR_VALID_DT_APPTS(allTargetDayAppts);
        if (dtAppts.length) foundDay = true;
    }

    if (!foundDay) {
        throw new Error('unable to find next day of dt appts in Cache.js');
    }

    console.log(`putting ${daysAhead} as days_to_next_dt_appts into cache...`);
    cache.put(DAYS_TO_NDA_DT_APPTS_NAME, daysAhead, 21600);

    return daysAhead;
};
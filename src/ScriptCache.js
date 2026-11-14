const TOKEN_NAME = 'ezyVet_broker_token_v1';
const EZYVET_RESOURCE_TO_UA_LOC_NAME = 'ezyvet_resource_to_ua_loc';

let token;
let tokenCredential;
let ezyVetResourceToUaLoc;
let daysToNextApptsByUaLoc = {};

function ndaUaLocTokenName(uaLoc) {
    return `days_to_next_${uaLoc}_appts`;
}

function getCacheVals() {
    const cache = CacheService.getScriptCache();
    // Only initialize dependencies used by the live whiteboard. Parked NDA
    // date caches must not trigger appointment searches on normal webhooks.
    const cacheVals = cache.getAll([TOKEN_NAME, EZYVET_RESOURCE_TO_UA_LOC_NAME]);

    setObservedSummary('cache', {
        tokenHit: Boolean(cacheVals[TOKEN_NAME]),
        resourceMapHit: Boolean(cacheVals[EZYVET_RESOURCE_TO_UA_LOC_NAME]),
        ndaDateLookupsEnabled: false,
    });

    token = getToken();

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

        const allTargetDayAppts = observePhase(
            'cache_day_lookup',
            () => fetchAndParse(url),
            { daysAhead, location: uaLoc },
        );

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

    cache.put(ndaUaLocTokenName(uaLoc), daysAhead, 21600);
    return daysAhead;
};

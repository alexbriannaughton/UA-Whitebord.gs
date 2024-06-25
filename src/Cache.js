let token;
let daysToNextDtAppts;

function getCacheVals() {
    const cache = CacheService.getScriptCache();
    const cacheVals = cache.getAll(['ezyVet_token', 'days_to_next_dt_appts']);

    token = cacheVals.ezyVet_token;
    if (!token) token = updateToken(cache);

    daysToNextDtAppts = Number(cacheVals.days_to_next_dt_appts);
    if (!daysToNextDtAppts) daysToNextDtAppts = getDaysAheadDT(cache);
}

function getDaysAheadDT(cache) {
    let foundDay = false;
    let daysAhead = 0;

    while (!foundDay && daysAhead < 10) {
        const [targetDayStart, targetDayEnd] = epochRangeForFutureDay(++daysAhead);
        const url = `${proxy}/v1/appointment?active=1&time_range_start=${targetDayStart}&time_range_end=${targetDayEnd}&limit=200`;
        const allTargetDayAppts = fetchAndParse(url);
        dtAppts = filterForValidDtAppts(allTargetDayAppts);
        if (dtAppts.length) foundDay = true;
    }

    if (!foundDay) {
        throw new Error('unable to find next day of dt appts in Cache.js');
    }

    console.log(`putting ${daysAhead} as days_to_next_dt_appts into cache...`);
    cache.put('days_to_next_dt_appts', daysAhead, 21600);

    return daysAhead;
};

function filterForValidDtAppts(allTargetDayAppts) {
    return allTargetDayAppts.items.filter(({ appointment }) => {
        return appointment.details.resource_list.some(id => dtResourceIDs.has(id)) // is in a DT exam column
            && appointment.details.appointment_type_id !== '4'; // & is not a blocked off spot
    });
};
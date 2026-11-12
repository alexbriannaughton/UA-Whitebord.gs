// NDA-only reads leave capacity for live callbacks. The shared fetch helper
// still owns broker lookup and exact-token recovery; this code never mints.
let ndaReadSession = null;

function startNdaReadSession() {
  ndaReadSession = {
    deadline: Date.now() + 240000,
    nextReadAt: 0,
    endpointReadAt: new Map(),
    responses: new Map(),
    requests: 0,
  };
  return ndaReadSession;
}

function ndaRead(url) {
  if (!ndaReadSession) throw new Error('NDA read session required');
  if (ndaReadSession.responses.has(url)) return ndaReadSession.responses.get(url);
  const endpoint = url.match(/\/v1(?:\.1)?\/([^/?]+)/)?.[1];
  if (!endpoint) throw new Error('Unsupported NDA read endpoint');

  for (let attempt = 0; attempt < 3; attempt++) {
    const now = Date.now();
    const wait = Math.max(0, ndaReadSession.nextReadAt - now,
      (ndaReadSession.endpointReadAt.get(endpoint) || 0) - now);
    if (now + wait >= ndaReadSession.deadline) throw new Error('NDA read budget exhausted');
    if (wait) Utilities.sleep(wait);
    ndaReadSession.nextReadAt = Date.now() + 750;
    ndaReadSession.endpointReadAt.set(endpoint, Date.now() + 1500);
    ndaReadSession.requests++;
    try {
      const response = url.startsWith(`${EV_PROXY}/v1.1/animal?`)
        ? fetchAndParsePage(url) : fetchAndParse(url);
      if (!response || !Array.isArray(response.items)) throw new Error('Incomplete NDA read response');
      ndaReadSession.responses.set(url, response);
      return response;
    } catch (error) {
      // Retry this GET, never an entire successful batch or a new token.
      const transient = /Address unavailable|timed?\s*out|connection reset|socket|DNS|Service unavailable/i.test(error.message || '');
      if (!transient || attempt === 2) throw new Error(transient ? 'NDA read transport unavailable' : 'NDA read failed');
    }
  }
}

function ndaReadAll(url) {
  if (url.startsWith(`${EV_PROXY}/v1.1/animal?`)) return ndaReadAnimalPages(url);
  const items = [];
  const seen = new Set();
  const endpoint = url.match(/\/v1(?:\.1)?\/([^/?]+)/)?.[1];
  let pages = 1;
  for (let page = 1; page <= pages; page++) {
    const response = ndaRead(`${url}&page=${page}`);
    const count = Number(response.meta?.items_page_total);
    if (!Number.isInteger(count) || count < 0 || count > 100 || (count === 0 && response.items.length)) {
      throw new Error('Invalid NDA pagination');
    }
    if (page > 1 && Math.max(1, count) !== pages) throw new Error('NDA pagination changed');
    if (response.meta.items_page !== undefined && Number(response.meta.items_page) !== page) {
      throw new Error('NDA pagination repeated a page');
    }
    pages = Math.max(1, count);
    for (const item of response.items) {
      const id = String(item[endpoint]?.id);
      if (!/^[1-9]\d*$/.test(id) || seen.has(id)) throw new Error('NDA pagination contains missing or duplicate records');
      seen.add(id);
    }
    items.push(...response.items);
  }
  return items;
}

// DEV keeps the existing animal v1.1 migration. Read each cursor page through
// the NDA pacing/cache boundary, retaining the original filters on every page.
function ndaReadAnimalPages(url) {
  const items = [];
  const cursors = new Set();
  const ids = new Set();
  let cursor = '';
  for (let page = 0; page < 32; page++) {
    const response = ndaRead(cursor ? `${url}&next_token=${encodeURIComponent(cursor)}` : url);
    const next = response.meta?.next_token;
    if (!(next === null || typeof next === 'string')) throw new Error('Invalid NDA animal cursor');
    for (const item of response.items) {
      const id = String(item.animal?.id);
      if (!/^[1-9]\d*$/.test(id) || ids.has(id)) throw new Error('NDA pagination contains missing or duplicate records');
      ids.add(id);
    }
    items.push(...response.items);
    if (!next) return items;
    if (cursors.has(next)) throw new Error('Repeated NDA animal cursor');
    cursors.add(next);
    cursor = next;
  }
  throw new Error('NDA animal pagination exceeds 32 pages');
}

function ndaFetchByIds(endpoint, key, ids, extra = '') {
  const unique = [...new Set(ids.map(String))].sort((a, b) => Number(a) - Number(b));
  if (unique.some(id => !/^[1-9]\d*$/.test(id))) throw new Error('Invalid NDA filter id');
  const output = [];
  for (let offset = 0; offset < unique.length; offset += 50) {
    const chunk = unique.slice(offset, offset + 50);
    const filter = encodeURIComponent(JSON.stringify({ in: chunk }));
    const route = endpoint === 'animal' ? 'v1.1/animal?active=1&page_size=200' : `v1/${endpoint}?active=1&limit=200`;
    const items = ndaReadAll(`${EV_PROXY}/${route}&${key}=${filter}${extra}`);
    // A rejected/ignored filter must never attach another patient's data.
    for (const item of items) {
      const record = item[endpoint];
      const id = record?.[key] ?? record?.details?.[key];
      if (!record || !chunk.includes(String(id))) throw new Error('NDA result outside requested scope');
    }
    output.push(...items);
  }
  return output;
}

function ndaGroup(items, endpoint, key) {
  const groups = new Map();
  for (const item of items) {
    const id = String(item[endpoint][key]);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(item);
  }
  return groups;
}

function fetchNdaIdentities(appts) {
  const animals = ndaGroup(ndaFetchByIds('animal', 'id', appts.map(a => a.appointment.details.animal_id)), 'animal', 'id');
  const contacts = ndaGroup(ndaFetchByIds('contact', 'id', appts.map(a => a.appointment.details.contact_id)), 'contact', 'id');
  let missing = false;
  for (const appt of appts) {
    appt.animal = animals.get(String(appt.appointment.details.animal_id))?.[0]?.animal;
    appt.contact = contacts.get(String(appt.appointment.details.contact_id))?.[0]?.contact;
    appt.ndaIdentityUnavailable = !appt.animal || !appt.contact;
    missing ||= appt.ndaIdentityUnavailable;
  }
  if (missing) throw new Error('NDA identity unavailable');
}

function fetchNdaMedicalData(appts) {
  // Share lookups across duplicate appointments and exhaust every page before
  // treating an empty medication list as a verified negative result.
  const animalIds = appts.map(a => a.appointment.details.animal_id);
  const consults = ndaGroup(ndaFetchByIds('consult', 'animal_id', animalIds), 'consult', 'animal_id');
  for (const appt of appts) appt.consults = consults.get(String(appt.appointment.details.animal_id)) || [];
  const prescriptions = ndaGroup(ndaFetchByIds('prescription', 'animal_id', animalIds), 'prescription', 'animal_id');
  const ids = [...prescriptions.values()].flat().map(p => p.prescription.id);
  const items = ndaGroup(ndaFetchByIds('prescriptionitem', 'prescription_id', ids), 'prescriptionitem', 'prescription_id');
  for (const appt of appts) {
    appt.prescriptions = prescriptions.get(String(appt.appointment.details.animal_id)) || [];
    appt.prescriptionItems = appt.prescriptions.flatMap(p => items.get(String(p.prescription.id)) || []);
    appt.ndaMedicationReady = true;
  }
}

function fetchNdaAttachmentData(appts) {
  if (appts.some(a => !Array.isArray(a.consults))) throw new Error('NDA consult history unavailable');
  const animalIds = appts.map(a => a.appointment.details.animal_id);
  const consultIds = appts.flatMap(a => a.consults.map(c => c.consult.id));
  const animals = ndaGroup(ndaFetchByIds('attachment', 'record_id', animalIds, '&record_type=Animal'), 'attachment', 'record_id');
  const consults = ndaGroup(ndaFetchByIds('attachment', 'record_id', consultIds, '&record_type=Consult'), 'attachment', 'record_id');
  return {
    animalAttachments: appts.map(a => animals.get(String(a.appointment.details.animal_id)) || []),
    consultAttachments: appts.map(a => a.consults.flatMap(c => consults.get(String(c.consult.id)) || [])),
  };
}

function fetchDataToCheckIfFirstTimeClient(appts, targetDateStr) {
  // Complete all history reads before asserting first-time status. A failed
  // optional lookup must remain unknown, including for another pet's history.
  if (appts.some(a => !Array.isArray(a.consults))) throw new Error('NDA consult history unavailable');
  const targetDate = new Date(targetDateStr.split(' ')[1]);
  const consultIds = appts.flatMap(a => a.consults.map(c => c.consult.id));
  const appointments = ndaFetchByIds('appointment', 'consult_id', consultIds);
  const withAppointment = new Set(appointments.map(a => String(a.appointment.details.consult_id)));
  const firstVisit = [];
  for (const appt of appts) {
    const previous = appt.consults.map(c => c.consult)
      .filter(c => getDateAtMidnight(c.date) < targetDate && withAppointment.has(String(c.id)))
      .sort((a, b) => Number(b.date) - Number(a.date))[0];
    if (previous) {
      appt.patientsLastVisitDate = convertEpochToUserTimezoneDate(previous.date).split(' ')[1];
      appt.ndaVisitHistoryReady = true;
    }
    else firstVisit.push(appt);
  }
  const animals = ndaFetchByIds('animal', 'contact_id', firstVisit.map(a => a.appointment.details.contact_id));
  const currentAnimalIds = new Set(appts.map(a => String(a.appointment.details.animal_id)));
  const otherAnimalIds = animals.map(a => a.animal.id).filter(id => !currentAnimalIds.has(String(id)));
  const otherConsults = ndaFetchByIds('consult', 'animal_id', otherAnimalIds);
  const otherAppointments = ndaFetchByIds('appointment', 'consult_id', otherConsults.map(c => c.consult.id));
  const otherVisited = new Set(otherAppointments.map(a => String(a.appointment.details.consult_id)));
  const visitedAnimals = new Set(otherConsults.filter(c => getDateAtMidnight(c.consult.date) < targetDate && otherVisited.has(String(c.consult.id)))
    .map(c => String(c.consult.animal_id)));
  for (const appt of appts) if (appt.patientsLastVisitDate) visitedAnimals.add(String(appt.appointment.details.animal_id));
  for (const appt of firstVisit) {
    const names = animals.filter(a => String(a.animal.contact_id) === String(appt.appointment.details.contact_id)
      && String(a.animal.id) !== String(appt.appointment.details.animal_id) && visitedAnimals.has(String(a.animal.id)))
      .map(a => a.animal.name);
    if (names.length) appt.otherAnimalsWhoHaveBeenHere = names.join(', ');
    else appt.firstTime = true;
  }
  for (const appt of appts) appt.ndaVisitHistoryReady = true;
}

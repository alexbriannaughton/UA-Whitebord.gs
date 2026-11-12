async function runAllNdaJobs() {
  return runNdaBuild([DT_SHEET_NAME, CH_SHEET_NAME, WC_SHEET_NAME]);
}

// These editor entrypoints recover one location without clearing the others.
async function rebuildNdaDt() { return runNdaBuild([DT_SHEET_NAME]); }
async function rebuildNdaCh() { return runNdaBuild([CH_SHEET_NAME]); }
async function rebuildNdaWc() { return runNdaBuild([WC_SHEET_NAME]); }

async function runNdaBuild(locations) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('NDAs');
  const session = startNdaReadSession();
  const states = [];
  const failures = [];
  try {
    // Phase 1: Publish every basic list before any history, medication, or
    // attachment lookup. A failed location retains its previous section;
    // already built locations never depend on a later location succeeding.
    withNdaSheetLock(() => setBaselineNdaConditionalFormatting(sheet));
    for (const location of locations) {
      try {
        states.push(executeNdaJob(sheet, location));
      } catch (error) {
        recordNdaFailure(failures, location, 'appointments', error);
      }
    }

    // Phase 2: Resolve names and demeanor for all locations before starting
    // expensive enrichment. Missing identities keep an exact chart link and
    // an explicit unavailable value instead of suppressing a patient row.
    for (const state of states) {
      await runNdaStage(sheet, state, 'identity', () => fetchNdaIdentities(state.appts), failures);
    }

    // Phase 3: Give every location medication data before starting attachment
    // and previous-visit work. Each optional stage has an independent failure
    // boundary; the four-minute read budget leaves time to finish sheet writes.
    for (const stage of ['medication', 'records', 'visitHistory']) {
      for (const state of states) {
        await runNdaStage(sheet, state, stage, () => getNdaEnrichment(state, stage), failures);
      }
    }
    const summary = {
      event: 'nda_build_completed',
      locations: states.map(s => ({ location: s.location, appointments: s.appts.length })),
      requests: session.requests,
      failures,
    };
    console.log(JSON.stringify(summary));
    // Preserve normal Apps Script failure notification rather than silently
    // reporting success when any list or enrichment still needs attention.
    if (failures.length) throw new Error(`NDA build needs attention: ${failures.map(f => `${f.location}/${f.stage}`).join(', ')}`);
    return summary;
  } finally {
    ndaReadSession = null;
  }
}

function executeNdaJob(sheet, location) {
  const { appts, targetDateStr, daysAhead } = getNextDayAppts(location);
  // Build the complete in-memory row payload before replacing any old rows.
  publishNdaSection(sheet, location, targetDateStr, appts);
  CacheService.getScriptCache().put(ndaUaLocTokenName(location), daysAhead, 21600);
  console.log(JSON.stringify({ event: 'nda_list_ready', location, appointments: appts.length }));
  return { location, targetDateStr, appts };
}

async function runNdaStage(sheet, state, stage, action, failures) {
  try {
    if (Date.now() >= ndaReadSession.deadline) throw new Error('NDA read budget exhausted');
    await action();
  } catch (error) {
    for (const appt of state.appts) {
      if (stage === 'identity') appt.ndaIdentityUnavailable = !appt.animal || !appt.contact;
      if (stage === 'medication' && !appt.ndaMedicationReady) appt.ndaMedicationUnavailable = true;
      if (stage === 'records' && !appt.ndaRecordsReady) appt.ndaRecordsUnavailable = true;
      if (stage === 'visitHistory' && !appt.ndaVisitHistoryReady) appt.ndaVisitHistoryUnavailable = true;
    }
    recordNdaFailure(failures, state.location, stage, error);
  }
  try {
    // Re-read current patient links and fill only still-pending enrichment
    // cells. Webhook changes, inserted/deleted rows, and staff edits survive.
    enrichNdaSection(sheet, state.location, state.targetDateStr, state.appts);
  } catch (error) {
    recordNdaFailure(failures, state.location, 'publish_' + stage, error);
  }
}

async function getNdaEnrichment(state, stage) {
  const { appts, targetDateStr, location } = state;
  if (stage === 'medication') return fetchNdaMedicalData(appts);
  if (stage === 'visitHistory') return fetchDataToCheckIfFirstTimeClient(appts, targetDateStr);
  const { animalAttachments, consultAttachments } = fetchNdaAttachmentData(appts);
  if (ENABLE_NDA_ATTACHMENT_DOWNLOADS && appts.some(a => !a.animal || !a.contact)) {
    throw new Error('NDA identity unavailable for attachment download');
  }
  const folder = ENABLE_NDA_ATTACHMENT_DOWNLOADS ? driveFolderProcessing(targetDateStr, location) : null;
  await processRecords(animalAttachments, consultAttachments, appts, folder);
  for (const appt of appts) appt.ndaRecordsReady = true;
}

function recordNdaFailure(failures, location, stage, error) {
  const reason = error.message === 'NDA read budget exhausted' ? 'read_budget' : 'unavailable';
  failures.push({ location, stage, reason });
  // Never log provider bodies, patient identities, or protected request URLs.
  console.error(JSON.stringify({ event: 'nda_stage_failed', location, stage, reason }));
}

function getNextDayAppts(location) {
  for (let daysAhead = 1; daysAhead <= 10; daysAhead++) {
    const [start, end] = epochRangeForFutureDay(daysAhead);
    const url = `${EV_PROXY}/v1/appointment?active=1&limit=200&time_range_start=${start}&time_range_end=${end}`;
    const items = ndaReadAll(url);
    const appts = filterAndSortAppts({ items }, location);
    if (!appts.length) continue;
    for (const { appointment } of appts) {
      if (!/^[1-9]\d*$/.test(String(appointment.details.animal_id))
        || !/^[1-9]\d*$/.test(String(appointment.details.contact_id))
        || !Number.isFinite(Number(appointment.start_time))) throw new Error('Invalid NDA appointment identity');
    }
    return { appts, targetDateStr: convertEpochToUserTimezoneDate(start), daysAhead };
  }
  throw new Error('No next-day appointments within ten days');
}

function filterAndSortAppts(allTargetDayAppts, uaLoc) {
    const allPossResourceIds = NDA_SCHEDULED_RESOURCES_MAP[uaLoc];
    const allPossApptTypeIds = NDA_APPT_TYPES_MAP[uaLoc];
    // filter all appts down to exams/techs
    const appts = allTargetDayAppts.items
        .filter(({ appointment }) => containsValidNdaIds(
            allPossResourceIds,
            allPossApptTypeIds,
            appointment.details.resource_list,
            appointment.details.appointment_type_id
        ));

    appts.sort((a, b) => a.appointment.start_time - b.appointment.start_time);

    // check for contacts with multiple appointments for different pets who are scheduled within an hour of each other
    for (let i = 0; i < appts.length - 1; i++) {
        const appt1 = appts[i];
        for (let j = i + 1; j < appts.length; j++) {
            const appt2 = appts[j];

            const withinAnHour = Math.abs(appt2.appointment.start_time - appt1.appointment.start_time) <= 3600;
            if (!withinAnHour) break;

            const isSameContact = appt1.appointment.details.contact_id === appt2.appointment.details.contact_id;
            if (isSameContact) {
                appts.splice(j, 1);
                appts.splice(i + 1, 0, appt2);
                break;
            }
        }
    }

    return appts
    // .slice(0, 3); // slicing for dev


};

const unmatchedVetstoriaContactID = '72038';
const NDA_PENDING_VALUE = 'Pending lookup - see chart';
const NDA_UNAVAILABLE_VALUE = 'Unavailable - see chart';
const NDA_PENDING_PATIENT = 'Patient details pending - open chart';

function prepareNdaRows(appts) {
  const values = [];
  const rich = [];
  for (let i = 0; i < appts.length; i++) {
    const appt = appts[i];
    const { appointment, animal, contact } = appt;
    const unavailable = (ready, failed) => ready ? null : (failed ? NDA_UNAVAILABLE_VALUE : NDA_PENDING_VALUE);
    const patient = animal && contact
      ? `${animal.name} ${contact.last_name} (${SPECIES_MAP[animal.species_id] || UNKNOWN_SPECIES_STRING})`
      : (appt.ndaIdentityUnavailable ? NDA_UNAVAILABLE_VALUE : NDA_PENDING_PATIENT);
    let history = unavailable(appt.ndaVisitHistoryReady, appt.ndaVisitHistoryUnavailable);
    if (!history) {
      history = appt.firstTime ? 'yes' : appt.patientsLastVisitDate
        ? `last seen ${appt.patientsLastVisitDate}` : appt.otherAnimalsWhoHaveBeenHere
          ? `first time for ${animal?.name || 'this patient'} but owner has been in with ${appt.otherAnimalsWhoHaveBeenHere}`
          : NDA_UNAVAILABLE_VALUE;
    }
    let medication = unavailable(appt.ndaMedicationReady, appt.ndaMedicationUnavailable);
    if (!medication) {
      const rx = processPrescriptionItems(appt.prescriptions, appt.prescriptionItems);
      medication = rx.rxErrorItem ? NDA_UNAVAILABLE_VALUE : rx.sedativeName === undefined ? 'no'
        : `${rx.sedativeName} last filled ${convertEpochToUserTimezoneDate(rx.sedativeDateLastFilled).split(' ')[1]}`;
    }
    const records = appt.ndaRecordsReady && appt.records ? appt.records.text
      : unavailable(false, appt.ndaRecordsUnavailable);
    const demeanor = ['0', '1'].includes(String(animal?.is_hostile))
      ? (String(animal.is_hostile) === '1' ? 'yes' : 'no')
      : unavailable(false, appt.ndaIdentityUnavailable);
    const type = Number(appointment.details.appointment_type_id);
    const row = [
      getTimeCellValue(i, appointment.start_time, appointment.details.contact_id, appts),
      patient,
      String(appointment.details.appointment_status_id) === '37' ? 'yes' : 'no',
      extractChckupClientNotes(appointment.details.description || ''),
      history, records, demeanor, medication,
      ALL_NDA_DVM_APPT_IDS.has(type) ? 'DVM' : ALL_NDA_TECH_APPT_IDS.has(type) ? 'tech' : '',
      '', // Filled from the known location by formatNextDayApptsCells.
    ];
    if (String(appointment.details.contact_id) === unmatchedVetstoriaContactID) {
      row[1] = getUnmatchedNdaText(appointment);
      for (const column of [2, 4, 5, 6, 7]) row[column] = '-';
    }
    const links = row.map(value => simpleTextToRichText(value instanceof Date ? '' : String(value)));
    if (String(appointment.details.contact_id) !== unmatchedVetstoriaContactID) {
      links[1] = makeLink(row[1], `${SITE_PREFIX}/?recordclass=Animal&recordid=${appointment.details.animal_id}`);
    }
    if (appt.ndaRecordsReady && appt.records?.link) links[5] = makeLink(row[5], appt.records.link);
    values.push(row);
    rich.push(links);
  }
  return { values, rich };
}

function putDataOnSheet(appts, range, snapshot = prepareNdaRows(appts)) {
  const location = range.getCell(1, 10).getValue();
  // Commit the complete row payload in batches; API calls happen elsewhere.
  for (let i = 0; i < snapshot.values.length; i++) {
    snapshot.values[i][9] = location;
    snapshot.rich[i][9] = simpleTextToRichText(location);
  }
  range.setValues(snapshot.values);
  range.offset(0, 1, appts.length, 9).setRichTextValues(snapshot.rich.map(row => row.slice(1)));
}

function getTimeCellValue(i, startTime, contactID, appts) {
  const previous = i > 0 ? appts[i - 1].appointment.details.contact_id : null;
  if (String(contactID) === String(previous) && String(contactID) !== unmatchedVetstoriaContactID) return SAME_FAM_STRING;
  return new Date(Number(startTime) * 1000);
}

function getUnmatchedNdaText(appointment) {
  const parts = String(appointment.details.description || '').split(' - ');
  if (parts.length < 4) return 'UNMATCHED PATIENT/CLIENT - see appointment';
  const animal = parts[1].replace(/^\s*\(New client\) ?/, '').trim();
  const [email, phone] = parts[3].split(' ');
  return `UNMATCHED PATIENT/CLIENT:\n${animal}\n${parts[2]}\n${email || ''}\n${phone || ''}`;
}

function processPrescriptionItems(prescriptions, prescriptionItems) {
    const productIDMap = {
        'gabapentin': new Set(['794', '1201', '1249', '5799', '1343']),
        'trazadone': new Set(['1244', '950']),
        'acepromazine': new Set(['11', '13']),
    };

    let sedativeName;
    let sedativeDateLastFilled = -Infinity;

    for (const { prescriptionitem } of prescriptionItems) {
        const productID = prescriptionitem.product_id;
        for (const [drugName, idSet] of Object.entries(productIDMap)) {
            if (idSet.has(productID)) {
                const rxDate = getRxDate(prescriptions, prescriptionitem.prescription_id);
                if (!rxDate) {
                    return { rxErrorItem: prescriptionitem }
                }
                if (rxDate > sedativeDateLastFilled) {
                    sedativeName = drugName;
                    sedativeDateLastFilled = rxDate;
                }
                break;
            }
        }
    }

    return { sedativeName, sedativeDateLastFilled };
};

function getRxDate(prescriptions, prescriptionID) {
    const rx = prescriptions.find(({ prescription }) => {
        return prescription.id === prescriptionID;
    });
    if (!rx) {
        return undefined;
    }
    return Number(rx.prescription.date_of_prescription);
}

// Fetch.js
function fetchDataToCheckIfFirstTimeClient(dtAppts, targetDateStr) {
    const targetDate = new Date(targetDateStr.split(' ')[1]);
    findLastVisitAndGetOtherAnimalConsults(dtAppts, targetDate);

    for (let i = 0; i < dtAppts.length; i++) {
        const {
            patientsLastVisitDate,
            otherAnimalConsults,
            otherAnimalsOfContact,
            animal,
            contact
        } = dtAppts[i];

        if (patientsLastVisitDate) continue; // this means i already have the data i want for the 'first time?' cell
        if (!otherAnimalConsults || !otherAnimalConsults.length) {
            // this means its for sure their first time here
            dtAppts[i].firstTime = true;
            continue;
        }

        // otherwise we need to parse through otherAnimalConsults to decide if theyve been here with another pet
        const animalName = `${animal.name} ${contact.last_name}`;
        const animalsOfContactWhoHaveBeenHere = parseOtherAnimalConsults(
            otherAnimalConsults,
            otherAnimalsOfContact,
            animalName,
            targetDate
        );
        console.log('animals of contact who have been here-->', animalsOfContactWhoHaveBeenHere);
        if (animalsOfContactWhoHaveBeenHere.size) {
            const namesOfAnimalsString = Array.from(animalsOfContactWhoHaveBeenHere).join(', ');
            dtAppts[i].otherAnimalsWhoHaveBeenHere = namesOfAnimalsString;
        }
        else {
            dtAppts[i].firstTime = true;
        }
    }
}

// findLastVisitAndGetOtherAnimalConsults will iterate through dtAppts and:
// 1. look for a valid previous appointment. if found it will attach the date to dtAppt[i].patientsLastVisitDate
// 2. if we do not find a valid previous appointment for this patient, and the owner has other pets on file,
// then we're going to send a request to ezyvet for the consults of those other pets and we'll attach those consults to dtAppts[i].otherAnimalConsuts
function findLastVisitAndGetOtherAnimalConsults(dtAppts, targetDate) {
    const consultsForOtherContactAnimalsRequests = [];
    const fetchedForOtherAnimalConsultsMap = [];
    // fetchedForOtherAnimalConsultsMap = is a map array where array[i] cooresponsds to dtAppts[i] to represent if we needed to fetch for that appointment's contact's other animals's consults 
    // first check if this patient has previous valid consults
    // if so, were just going to put that last date of this patients visit, and we're not going to check if they have other animals who have had consults
    for (let i = 0; i < dtAppts.length; i++) {
        const { appointment, consults, otherAnimalsOfContact, encodedConsultIDs } = dtAppts[i];
        // note: appointments created through vetstoria do not have an consult, but we want to count it for this
        const apptHasConsult = appointment.details.consult_id; // check for existence of appointment's consult
        const numberOfConsults = apptHasConsult ? consults.length : consults.length + 1;
        if (numberOfConsults > 1) { // if the animal has potentially been here before..
            consults.sort((a, b) => b.consult.date - a.consult.date);
            const { items: appts } = fetchAndParse(`${proxy}/v1/appointment?active=1&limit=200&consult_id=${encodedConsultIDs}`);
            for (const { consult } of consults) {
                // if the consult does not have an appointment, it is probably not an actual visit
                // e.g. a fecal drop off will sometimes have a consult and not a visit, and we dont want to count that as a visit.
                const consultHasAppointment = appts.some(({ appointment }) => Number(consult.id) === appointment.details.consult_id);
                const consultDate = getDateAtMidnight(consult.date);
                if (consultHasAppointment && consultDate < targetDate) {
                    // then we have confirmed a valid last consult for this patient
                    const [_consultDayOfWeek, consultDayMonthYear] = convertEpochToUserTimezoneDate(consult.date).split(' ');
                    dtAppts[i].patientsLastVisitDate = consultDayMonthYear;
                    break;
                }
                // if consult does not have an appointment
                // or if this consult has the same date or is further in the future than the original appt we are comparing to
                // that means we dont want to count this visit as the previous visit, so move on to the next consult
            }
        }

        const isAnimalsFirstTime = dtAppts[i].patientsLastVisitDate === undefined;

        // if we were unable to find a valid previous visit for this animal, and the owner has other pets,
        // we're going to fetch for those animals' consults
        if (isAnimalsFirstTime && otherAnimalsOfContact.length) {
            const otherAnimalIDsOfContact = otherAnimalsOfContact.map(({ animal }) => animal.id);
            const encodedOtherAnimalIDs = encodeURIComponent(JSON.stringify({ "in": otherAnimalIDsOfContact }));
            consultsForOtherContactAnimalsRequests.push(
                bodyForEzyVetGet(`${proxy}/v1/consult?active=1&animal_id=${encodedOtherAnimalIDs}`)
            );
            fetchedForOtherAnimalConsultsMap.push(true);

        }
        else fetchedForOtherAnimalConsultsMap.push(false);
    }

    // send the fetch all for the other animals's consults
    const contactOtherAnimalsConsultData = fetchAllResponses(
        consultsForOtherContactAnimalsRequests,
        `contact's other animals' consults where needed`
    );

    // attach the other animal consults to the appropriate appointment
    let contactOtherAnimalsConsultDataIndex = 0;
    for (let i = 0; i < dtAppts.length; i++) {
        const didTheFetch = fetchedForOtherAnimalConsultsMap[i];
        if (didTheFetch) {
            const otherAnimalConsults = contactOtherAnimalsConsultData[contactOtherAnimalsConsultDataIndex++];
            dtAppts[i].otherAnimalConsults = otherAnimalConsults;
        }
    }
}

function parseOtherAnimalConsults(
    otherAnimalConsults,
    otherAnimalsOfContact,
    animalName,
    targetDate
) {
    const animalIDToNameMap = {};
    for (const { animal } of otherAnimalsOfContact) {
        animalIDToNameMap[animal.id] = animal.name;
    }
    console.log('target date: ', targetDate)
    console.log('other animal consults: ', otherAnimalConsults)
    console.log('other animals of contact: ', otherAnimalsOfContact)
    console.log('animalIDToNameMap: ', animalIDToNameMap);
    const animalsWhoHaveBeenHere = new Set();
    const encodedConsultIDs = otherAnimalConsults.map(({ consult }) => consult.id);
    console.log(`getting consults for siblings of ${animalName}...`);
    const { items: appts } = fetchAndParse(`${proxy}/v1/appointment?active=1&limit=200&consult_id=${encodedConsultIDs}`);
    for (const { consult } of otherAnimalConsults) {
        const consultHasAppointment = appts.some(({ appointment }) => Number(consult.id) === appointment.details.consult_id);
        const consultDate = getDateAtMidnight(consult.date);
        console.log(`consult ${consult.id} has appointment: ${consultHasAppointment}, date: ${consultDate}`);
        if (consultHasAppointment && consultDate < targetDate) {
            animalsWhoHaveBeenHere.add(animalIDToNameMap[consult.animal_id]);
        }
    }
    return animalsWhoHaveBeenHere;
}

function firstRoundOfFetches(dtAppts) {
    const animalRequests = [];
    const contactRequests = [];
    const allConsultsForAnimalRequests = [];
    const prescriptionRequests = [];
    const animalAttachmentRequests = [];

    dtAppts.forEach(({ appointment }) => {
        const animalID = appointment.details.animal_id;
        animalRequests.push(bodyForEzyVetGet(`${proxy}/v1/animal/${animalID}`));
        contactRequests.push(bodyForEzyVetGet(`${proxy}/v1/contact/${appointment.details.contact_id}`));
        allConsultsForAnimalRequests.push(bodyForEzyVetGet(`${proxy}/v1/consult?active=1&limit=200&animal_id=${animalID}`));
        prescriptionRequests.push(bodyForEzyVetGet(`${proxy}/v1/prescription?active=1&limit=200&animal_id=${animalID}`));
        animalAttachmentRequests.push(bodyForEzyVetGet(`${proxy}/v1/attachment?active=1&limit=200&record_type=Animal&record_id=${animalID}`));
    });

    const animalData = fetchAllResponses(animalRequests, "animal");
    const contactData = fetchAllResponses(contactRequests, "contact");
    const allConsultsForAnimalData = fetchAllResponses(allConsultsForAnimalRequests, "consult");
    const prescriptionData = fetchAllResponses(prescriptionRequests, "prescription");

    for (let i = 0; i < dtAppts.length; i++) {
        const consults = allConsultsForAnimalData[i];
        const consultIDs = consults.map(({ consult }) => consult.id);
        const encodedConsultIDs = encodeURIComponent(JSON.stringify({ "in": consultIDs }));

        const prescriptions = prescriptionData[i];
        const prescriptionIDs = prescriptions.map(({ prescription }) => prescription.id);

        const newApptData = {
            consults,
            encodedConsultIDs,
            prescriptions,
            prescriptionIDs,
            animal: animalData[i].at(-1).animal,
            contact: contactData[i].at(-1).contact,

        }
        dtAppts[i] = { ...dtAppts[i], ...newApptData };
    }

    const animalAttachmentData = fetchAllResponses(animalAttachmentRequests, "animal attachment");
    return animalAttachmentData;
}

function bodyForEzyVetGet(url) {
    return {
        muteHttpExceptions: true,
        url,
        method: "GET",
        headers: { authorization: token }
    }
};

function handleRespsForFetchAll(
    responses,
    outputItems,
    resourceName,
    requests,
    retry = false
) {
    for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        const contentText = response.getContentText();
        const data = jsonParser(contentText);

        if (!data || response.getResponseCode() !== 200) {
            console.error(`Error at index ${i} fetching ${resourceName} data.`);
            console.error('Error from ezyVet: ', contentText);

            if (retry === false && contentText.includes('too many requests recently')) {
                console.log('Rate limit error detected. Retrying after 1 minute.');
                Utilities.sleep(60000);
                return handleRespsForFetchAll(
                    responses,
                    outputItems,
                    resourceName,
                    requests,
                    true // is a retry
                );
            }

            console.error(`All ${resourceName} Requests:`, requests);
            outputItems = [];
            break;
        }

        outputItems.push(data.items);
    }
}

function fetchAllResponses(requests, resourceName) {
    let outputItems = [];

    try {
        console.log(`getting all ${resourceName} data...`);
        const responses = UrlFetchApp.fetchAll(requests);
        handleRespsForFetchAll(responses, outputItems, resourceName, requests);
    }

    catch (error) {
        console.error(`Error fetching ${resourceName} data:`, error);
        console.error(`${resourceName} Requests:`);
        requests.forEach(req => console.error(req));

        if (error.message?.toLowerCase().includes('url length')) {
            try {
                console.log(`second try getting ${resourceName} data after url length error...`)
                const responses = UrlFetchApp.fetchAll(requests);
                handleRespsForFetchAll(responses, outputItems, resourceName, requests);
            }
            catch (error) {
                console.error('error at second try after url length error: ', error);
                outputItems = [];
            }
        }
    }

    return outputItems;
}

function secondRoundOfFetches(dtAppts) {
    const consultAttachmentRequests = [];
    const prescriptionItemRequests = [];
    const animalsOfContactRequests = [];

    for (const appt of dtAppts) {
        consultAttachmentRequests.push(
            bodyForEzyVetGet(`${proxy}/v1/attachment?limit=200&active=1&record_type=Consult&record_id=${appt.encodedConsultIDs}`)
        );
        const encodedPrescriptionIDs = encodeURIComponent(JSON.stringify({ "in": appt.prescriptionIDs }));
        prescriptionItemRequests.push(
            bodyForEzyVetGet(`${proxy}/v1/prescriptionitem?active=1&limit=200&prescription_id=${encodedPrescriptionIDs}`)
        );
        animalsOfContactRequests.push(
            bodyForEzyVetGet(`${proxy}/v1/animal?active=1&contact_id=${appt.contact.id}&limit=200`)
        );
    }

    const prescriptionItemData = fetchAllResponses(prescriptionItemRequests, 'prescription item');
    const animalsOfContactData = fetchAllResponses(animalsOfContactRequests, 'animals of contact');

    for (let i = 0; i < dtAppts.length; i++) {
        const prescriptionItems = prescriptionItemData[i];
        const animalsOfContact = animalsOfContactData[i];
        const otherAnimalsOfContact = animalsOfContact.filter(({ animal }) => animal.id !== dtAppts[i].animal.id);

        const newApptData = { prescriptionItems, otherAnimalsOfContact };

        dtAppts[i] = { ...dtAppts[i], ...newApptData };
    }

    const consultAttachmentData = fetchAllResponses(consultAttachmentRequests, 'consult attachment');
    return consultAttachmentData;
};

function jsonParser(input) {
    try {
        const output = JSON.parse(input);
        return output;
    }
    catch {
        return null;
    }
}
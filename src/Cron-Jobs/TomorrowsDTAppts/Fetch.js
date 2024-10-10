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
// 1. look for a valid previous appointment. if found it will store the date to dtAppt[i].patientsLastVisitDate
// 2. if we do not find a valid previous appointment for this patient, and the owner has other pets on file,
// then we're going to send a request to ezyvet for the consults of those other pets and we'll store those consults to dtAppts[i].otherAnimalConsuts
function findLastVisitAndGetOtherAnimalConsults(dtAppts, targetDate) {
    const consultsForOtherContactAnimalsRequests = [];
    const fetchedForOtherAnimalConsultsMap = [];
    // fetchedForOtherAnimalConsultsMap = is a map array where array[i] cooresponsds to dtAppts[i] to represent if we needed to fetch for that appointment's contact's other animals's consults 
    // first check if this patient has previous valid consults
    // if so, were just going to put that last date of this patients visit, and we're not going to check if they have other animals who have had consults
    const consultsForOtherContactAnimalsRequestBaseUrl = `${proxy}/v1/consult?active=1&animal_id=`
    for (let i = 0; i < dtAppts.length; i++) {
        const { appointment, consults, otherAnimalsOfContact, consultIDs } = dtAppts[i];
        // note: appointments created through vetstoria do not have an consult, but we want to count it for this
        const apptHasConsult = appointment.details.consult_id; // check for existence of appointment's consult
        const numberOfConsults = apptHasConsult ? consults.length : consults.length + 1;
        if (numberOfConsults > 1) { // if the animal has potentially been here before..
            consults.sort((a, b) => b.consult.date - a.consult.date);
            // const encodedConsultIDs = encodeURIComponent(JSON.stringify({ "in": consultIDs }));
            const appts = getit(`${proxy}/v1/appointment?active=1&limit=200&consult_id=`, consultIDs);
            // const { items: appts } = fetchAndParse(`${proxy}/v1/appointment?active=1&limit=200&consult_id=${encodedConsultIDs}`);
            for (const { consult } of consults) {
                // if the consult does not have an appointment, it is probably not an actual visit
                // e.g. a fecal drop off will sometimes have a consult and not a visit, and we dont want to count that as a visit.
                const consultHasAppointment = appts.some(({ appointment }) => Number(consult.id) === appointment.details.consult_id);
                const consultDate = getDateAtMidnight(consult.date);
                if (consultHasAppointment && consultDate < targetDate) {
                    // then we have confirmed a valid last consult for this patient
                    const [_dayOfWeek, dateString] = convertEpochToUserTimezoneDate(consult.date).split(' ');
                    dtAppts[i].patientsLastVisitDate = dateString;
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
            // if its a rescue i dont want to get consultsforothercontactanimals
            // i just want to put in the cell that its this animals first time and the contact is a rescue

            const otherAnimalIDsOfContact = otherAnimalsOfContact.map(({ animal }) => animal.id);
            dtAppts[i].otherAnimalIDsOfContact = otherAnimalIDsOfContact;
            const encodedOtherAnimalIDs = encodeURIComponent(JSON.stringify({ "in": otherAnimalIDsOfContact }));
            consultsForOtherContactAnimalsRequests.push(
                bodyForEzyVetGet(consultsForOtherContactAnimalsRequestBaseUrl + encodedOtherAnimalIDs)
            );

            fetchedForOtherAnimalConsultsMap.push(true);

        }
        else fetchedForOtherAnimalConsultsMap.push(false);
    }

    // send the fetch all for the other animals's consults
    const contactOtherAnimalsConsultData = fetchAllResponses(
        consultsForOtherContactAnimalsRequests,
        `contact's other animals' consults where needed`,
        dtAppts,
        consultsForOtherContactAnimalsRequestBaseUrl,
        'otherAnimalIDsOfContact'
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
    const animalIDToNameMap = new Map();
    for (const { animal } of otherAnimalsOfContact) {
        let name = animal.name;
        if (animal.is_dead === '1') name += '(💀)';
        animalIDToNameMap.set(animal.id, name);
    }
    const animalsWhoHaveBeenHere = new Set();
    const allOtherAnimalConsultIDs = otherAnimalConsults.map(({ consult }) => consult.id);
    const encodedConsultIDsOfOtherAnimals = encodeURIComponent(JSON.stringify({ "in": allOtherAnimalConsultIDs }));
    console.log(`getting consults for siblings of ${animalName}...`);
    const { items: appts } = fetchAndParse(`${proxy}/v1/appointment?active=1&limit=200&consult_id=${encodedConsultIDsOfOtherAnimals}`);
    for (const { consult } of otherAnimalConsults) {
        const consultHasAppointment = appts.some(({ appointment }) => Number(consult.id) === appointment.details.consult_id);
        const consultDate = getDateAtMidnight(consult.date);
        if (consultHasAppointment && consultDate < targetDate) {
            animalsWhoHaveBeenHere.add(animalIDToNameMap.get(consult.animal_id));
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
        // const encodedConsultIDs = encodeURIComponent(JSON.stringify({ "in": consultIDs }));

        const prescriptions = prescriptionData[i];
        const prescriptionIDs = prescriptions.map(({ prescription }) => prescription.id);

        const newApptData = {
            consults,
            // encodedConsultIDs,
            consultIDs,
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

function secondRoundOfFetches(dtAppts) {
    const consultAttachmentRequests = [];
    const prescriptionItemRequests = [];
    const animalsOfContactRequests = [];

    const rxItemUrlBase = `${proxy}/v1/prescriptionitem?active=1&limit=200&prescription_id=`;
    const consultAttachmentUrlBase = `${proxy}/v1/attachment?limit=200&active=1&record_type=Consult&record_id=`;

    for (const appt of dtAppts) {
        const encodedConsultIDs = encodeURIComponent(JSON.stringify({ "in": appt.consultIDs }));
        consultAttachmentRequests.push(
            bodyForEzyVetGet(consultAttachmentUrlBase + encodedConsultIDs)
        );

        const encodedPrescriptionIDs = encodeURIComponent(JSON.stringify({ "in": appt.prescriptionIDs }));
        prescriptionItemRequests.push(
            bodyForEzyVetGet(rxItemUrlBase + encodedPrescriptionIDs)
        );
        animalsOfContactRequests.push(
            bodyForEzyVetGet(`${proxy}/v1/animal?active=1&contact_id=${appt.contact.id}&limit=200`)
        );
    }

    const prescriptionItemData = fetchAllResponses(
        prescriptionItemRequests,
        'prescription item',
        dtAppts,
        rxItemUrlBase,
        'prescriptionIDs'
    );

    const animalsOfContactData = fetchAllResponses(animalsOfContactRequests, 'animals of contact');

    for (let i = 0; i < dtAppts.length; i++) {
        const prescriptionItems = prescriptionItemData[i];
        const animalsOfContact = animalsOfContactData[i];
        const otherAnimalsOfContact = animalsOfContact.filter(({ animal }) => animal.id !== dtAppts[i].animal.id);

        const newApptData = { prescriptionItems, otherAnimalsOfContact };

        dtAppts[i] = { ...dtAppts[i], ...newApptData };
    }

    const consultAttachmentData = fetchAllResponses(
        consultAttachmentRequests,
        'consult attachment',
        dtAppts,
        consultAttachmentUrlBase,
        'consultIDs'
    );

    return consultAttachmentData;
};

function bodyForEzyVetGet(url) {
    return {
        muteHttpExceptions: true,
        url,
        method: "GET",
        headers: { authorization: token }
    }
};

function fetchAllResponses(requests, resourceName, dtAppts, urlBase, keyToIds) {
    let outputItems = [];

    let responses = tryFetchAll(requests, resourceName, outputItems, dtAppts, urlBase, keyToIds);
    if (outputItems.length) return outputItems;

    try {
        handleRespsForFetchAll(responses, outputItems, resourceName, requests);
    }
    catch (error) {
        console.error(error);
        if (error.message.includes('too many requests recently')) {
            console.log('Rate limit error detected. Going to wait 1 minute.');
            Utilities.sleep(60000);
            outputItems = [];
            responses = tryFetchAll(requests, resourceName, outputItems, dtAppts, urlBase, keyToIds);
            if (outputItems.length) return outputItems;
            handleRespsForFetchAll(responses, outputItems, resourceName);
        }
        else throw (error);
    }

    return outputItems;
}

function handleRespsForFetchAll(
    responses,
    outputItems,
    resourceName
) {
    for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        const contentText = response.getContentText();
        const data = jsonParser(contentText);

        if (!data || response.getResponseCode() !== 200) {
            console.error(`Error at index ${i} fetching ${resourceName} data.`);
            console.error('Error from ezyVet:');
            throw new Error(contentText);
        }

        outputItems.push(data.items);
    }
}


function tryFetchAll(requests, resourceName, outputItems, dtAppts, urlBase, keyToIds) {
    try {
        console.log(`getting all ${resourceName} data...`);
        const responses1 = UrlFetchApp.fetchAll(requests);
        return responses1;
    }
    catch (error) {
        console.error(error.message);
        // if error.message indicates url length is too long
        if (error.message.includes('URL Length')) {
            return splitUpFetches(resourceName, dtAppts, urlBase, keyToIds, outputItems);
        }

        console.error(`trying again to get all ${resourceName} data...`);
        const responses2 = UrlFetchApp.fetchAll(requests);
        return responses2;
    }
}

function splitUpFetches(resourceName, dtAppts, urlBase, keyToIds, outputItems) {
    console.log(`splitting up fetches for requesting ${resourceName}...`);
    for (const appt of dtAppts) {
        console.log(`attempting to get ${resourceName} for ${appt.animal.name} ${appt.contact.last_name}`);
        const idsArray = appt[keyToIds];
        // const itemsForOneAppt = [];
        // for (let i = 0; i < idsArray.length; i += 30) {
        //     const curIds = idsArray.slice(i, i + 30 + 1);
        //     const encodedIds = encodeURIComponent(JSON.stringify({ "in": curIds }));
        //     const { items } = fetchAndParse(urlBase + encodedIds);
        //     itemsForOneAppt.push(...items);
        // }
        const itemsForOneAppt = getit(urlBase, idsArray);
        outputItems.push(itemsForOneAppt);
    }
}

function getit(urlBase, idsArray = []) {
    const itemsForOneAppt = [];
    for (let i = 0; i < idsArray.length; i += 30) {
        const curIds = idsArray.slice(i, i + 30 + 1);
        const encodedIds = encodeURIComponent(JSON.stringify({ "in": curIds }));
        const { items } = fetchAndParse(urlBase + encodedIds);
        itemsForOneAppt.push(...items);
    }
    return itemsForOneAppt;
}

function jsonParser(input) {
    try {
        const output = JSON.parse(input);
        return output;
    }
    catch {
        return null;
    }
}
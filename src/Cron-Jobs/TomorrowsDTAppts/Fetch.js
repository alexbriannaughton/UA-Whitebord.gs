// Fetch.js
function fetchDataToCheckIfFirstTimeClient(dtAppts, tomorrowsDateStr) {
    const consultsForOtherContactAnimalsRequests = [];
    const fetchedForOtherAnimalConsultsArray = [];
    // first check if this patient has previous valid consults
    // if so, were just going to put that last date of this patients visit
    for (let i = 0; i < dtAppts.length; i++) {
        const { appointment, consults, otherAnimalsOfContact, encodedConsultIDs } = dtAppts[i];
        // appointments created through vetstoria do not have an appointment, but we want to count it for this
        const apptHasConsult = appointment.details.consult_id; // check for existence of appointment's consult
        const numberOfConsults = apptHasConsult ? consults.length : consults.length + 1;

        if (numberOfConsults > 1) { // if the animal appears to have been here before..
            consults.sort((a, b) => b.consult.date - a.consult.date);
            const { items: appts } = fetchAndParse(`${proxy}/v1/appointment?active=1&limit=200&consult_id=${encodedConsultIDs}`);
            for (const { consult } of consults) {
                const apptForThisConsult = appts.find(({ appointment }) => Number(consult.id) === appointment.details.consult_id);
                const consultDoesNotHaveAppointment = apptForThisConsult === undefined;
                const consultDateStr = convertEpochToUserTimezoneDate(consult.date);
                // console.log('consultDateStr: ', consultDateStr);
                if (consultDoesNotHaveAppointment || consultDateStr === tomorrowsDateStr) {
                    // if consult does not exists as an appointment
                    // or if the consult that were checking has the same date as tomorrows consult
                    // that means this is either the same consult, or the "consult" wasnt actually a visit, or its a double
                    // if these are true, we dont want to count this visit as the previous visit
                    continue;
                }

                // if we get here we have confirmed a valid last consult for this patient
                dtAppts[i].patientsLastVisitDate = consultDateStr;
                break;
            }

        }

        // if we were unable to find a valid previous visit for this animal, and the owner has other pets,
        // we're going to fetch for those animals' consults
        if (dtAppts[i].patientsLastVisitDate === undefined && otherAnimalsOfContact.length) {
            const otherAnimalIDsOfContact = otherAnimalsOfContact.map(({ animal }) => animal.id);
            const encodedOtherAnimalIDs = encodeURIComponent(JSON.stringify({ "in": otherAnimalIDsOfContact }));
            consultsForOtherContactAnimalsRequests.push(
                bodyForEzyVetGet(`${proxy}/v1/consult?active=1&animal_id=${encodedOtherAnimalIDs}`)
            );
            fetchedForOtherAnimalConsultsArray.push(true);

        }
        else fetchedForOtherAnimalConsultsArray.push(false);
    }

    const contactOtherAnimalsConsultData = fetchAllResponses(
        consultsForOtherContactAnimalsRequests,
        'consults for other animals of contacts where appointment animal has not already visited ua'
    );

    let contactOtherAnimalsConsultDataIndex = 0;
    for (let i = 0; i < dtAppts.length; i++) {
        const didAFetchForConsultsForOtherContactAnimals = fetchedForOtherAnimalConsultsArray[i];
        if (didAFetchForConsultsForOtherContactAnimals) {
            const otherAnimalConsults = contactOtherAnimalsConsultData[contactOtherAnimalsConsultDataIndex++];
            dtAppts[i].otherAnimalConsults = otherAnimalConsults;
        }
    }

    for (let i = 0; i < dtAppts.length; i++) {
        const appt = dtAppts[i];
        const { patientsLastVisitDate, otherAnimalConsults } = appt;
        // both of the above variables will be undefined if the patient has never had an appt AND the owner doesnt have other pets in the system

        if (patientsLastVisitDate) continue; // this means i already have the data i want for the 'first time?' cell
        if (!otherAnimalConsults || !otherAnimalConsults.length) {
            // this means its for sure their first time here
            dtAppts[i].firstTime = true;
            continue;
        }
        
        // otherwise we need to parse through otherAnimalConsults to decide if theyve been here with another pet
        dtAppts[i].itsPossibleTheyveBeenHereWithOtherPets = true;

    }


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

function fetchAllResponses(requests, resourceName) {
    let outputItems = [];

    try {
        console.log(`getting all ${resourceName} data...`);
        const responses = UrlFetchApp.fetchAll(requests);

        for (let i = 0; i < responses.length; i++) {
            const response = responses[i];
            const contentText = response.getContentText();
            const data = jsonParser(contentText);

            if (!data || response.getResponseCode() !== 200) {
                console.error(`Content text for error at index ${i} fetching ${resourceName} data:`, contentText);
                console.error(`All ${resourceName} Requests:`, requests);
                outputItems = [];
                break;
            }

            outputItems.push(data.items);
        }
    }

    catch (error) {
        console.error(`Error fetching ${resourceName} data:`, error);
        console.error(`${resourceName} Requests:`, requests);
        outputItems = [];
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
        return false;
    }
}
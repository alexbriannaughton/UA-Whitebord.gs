const UNAUTHORIZED = 401;
const OK = 200;
const TOO_MANY_REQUESTS = 429;

function fetchAndParse(url) {
    token = getToken();

    const options = {
        muteHttpExceptions: true,
        method: "GET",
        headers: {
            authorization: token
        }
    };

    const apiLabel = observedApiLabel(url);
    let response = observeExternalCall(
        apiLabel,
        () => UrlFetchApp.fetch(url, options),
        { externalAttempt: 1 },
    );
    if (response.getResponseCode() !== OK) {
        logObservedEvent('external_non_ok_response', {
            label: apiLabel,
            externalAttempt: 1,
            responseCode: response.getResponseCode(),
        });
    }

    if (response.getResponseCode() === UNAUTHORIZED) {
        options.headers.authorization = updateToken();
        response = observeExternalCall(
            apiLabel,
            () => UrlFetchApp.fetch(url, options),
            { externalAttempt: 2, retryReason: 'unauthorized' },
        );
    }

    if (response.getResponseCode() !== OK) {
        console.error(`Response Code: ${response.getResponseCode()}`);

        if (response.getResponseCode() === TOO_MANY_REQUESTS) {
            waitOn429(response);
            response = observeExternalCall(
                apiLabel,
                () => UrlFetchApp.fetch(url, options),
                { externalAttempt: 3, retryReason: 'rate_limited' },
            );
        }
    }

    const json = response.getContentText();

    return JSON.parse(json);
};

// use fetchAndParse() to store pet name and species from /animal endpoint
function getAnimalInfo(animalID) {
    const url = `${EV_PROXY}/v1/animal/${animalID}`;
    const animal = fetchAndParse(url).items.at(-1).animal;
    const species = SPECIES_MAP[animal.species_id] || undefined;

    return [animal.name, species];
};

// use fetchAndParse() to store last name from /contact endpoint
function getLastName(contactID) {
    const url = `${EV_PROXY}/v1/contact/${contactID}`;
    const lastName = fetchAndParse(url).items.at(-1).contact.last_name;

    return lastName;
};

function getContactIdFromAnimalId(animalID) {
    const url = `${EV_PROXY}/v1/animal/${animalID}`;
    const contactID = fetchAndParse(url).items.at(-1).contact_id;
    return contactID;
}

// this is like a promise.all to get animal name and last name at the same time
function getAnimalInfoAndLastName(animalID, contactID) {
    token = getToken();

    const animalRequest = {
        muteHttpExceptions: true,
        url: `${EV_PROXY}/v1/animal/${animalID}`,
        method: "GET",
        headers: {
            authorization: token
        }
    };

    const contactRequest = {
        muteHttpExceptions: true,
        url: `${EV_PROXY}/v1/contact/${contactID}`,
        method: "GET",
        headers: {
            authorization: token
        }
    };

    let [animalResponse, contactResponse] = observeExternalCall(
        'ezyvet_animal_contact',
        () => UrlFetchApp.fetchAll([animalRequest, contactRequest]),
        { externalAttempt: 1 },
    );

    if (animalResponse.getResponseCode() === UNAUTHORIZED || contactResponse.getResponseCode() === UNAUTHORIZED) {
        animalRequest.headers.authorization = updateToken();
        contactRequest.headers.authorization = token;
        [animalResponse, contactResponse] = observeExternalCall(
            'ezyvet_animal_contact',
            () => UrlFetchApp.fetchAll([animalRequest, contactRequest]),
            { externalAttempt: 2, retryReason: 'unauthorized' },
        );
    }

    if (animalResponse.getResponseCode() !== OK || contactResponse.getResponseCode() !== OK) {
        console.error(`Request failed: Animal response code: ${animalResponse.getResponseCode()}`);
        console.error(`Contact response code: ${contactResponse.getResponseCode()}`);

        const animalResponseIs429 = animalResponse.getResponseCode() === TOO_MANY_REQUESTS;
        const contactResponseIs429 = contactResponse.getResponseCode() === TOO_MANY_REQUESTS;
        if (animalResponseIs429 || contactResponseIs429) {
            if (animalResponseIs429) waitOn429(animalResponse);
            else if (contactResponseIs429) waitOn429(contactResponse);
            [animalResponse, contactResponse] = observeExternalCall(
                'ezyvet_animal_contact',
                () => UrlFetchApp.fetchAll([animalRequest, contactRequest]),
                { externalAttempt: 3, retryReason: 'rate_limited' },
            );
        }
    }

    const animalJSON = animalResponse.getContentText();
    const parsedAnimal = JSON.parse(animalJSON);
    const animal = parsedAnimal.items.at(-1).animal;
    const animalSpecies = SPECIES_MAP[animal.species_id] || undefined;
    const isHostile = animal.is_hostile === '1';

    const contactJSON = contactResponse.getContentText();
    const parsedContact = JSON.parse(contactJSON);
    const contactLastName = parsedContact.items.at(-1).contact.last_name;

    return [animal.name, animalSpecies, contactLastName, isHostile]
};

function getTwoAnimalContactIDsAsync(animalOneID, animalTwoID) {
    token = getToken();

    const animalOneRequest = {
        muteHttpExceptions: true,
        url: `${EV_PROXY}/v1/animal/${animalOneID}`,
        method: "GET",
        headers: {
            authorization: token
        }
    };

    const animalTwoRequest = {
        muteHttpExceptions: true,
        url: `${EV_PROXY}/v1/animal/${animalTwoID}`,
        method: "GET",
        headers: {
            authorization: token
        }
    };

    let [animalOneResponse, animalTwoResponse] = observeExternalCall(
        'ezyvet_two_animals',
        () => UrlFetchApp.fetchAll([animalOneRequest, animalTwoRequest]),
        { externalAttempt: 1 },
    );

    if (animalOneResponse.getResponseCode() === UNAUTHORIZED || animalTwoResponse.getResponseCode() === UNAUTHORIZED) {
        animalOneRequest.headers.authorization = updateToken();
        animalTwoRequest.headers.authorization = token;
        [animalOneResponse, animalTwoResponse] = observeExternalCall(
            'ezyvet_two_animals',
            () => UrlFetchApp.fetchAll([animalOneRequest, animalTwoRequest]),
            { externalAttempt: 2, retryReason: 'unauthorized' },
        );
    }

    if (animalOneResponse.getResponseCode() !== OK || animalTwoResponse.getResponseCode() !== OK) {
        console.error(`Request failed: Animal 1 response code: ${animalOneResponse.getResponseCode()}`);
        console.error(`Animal 2 response code: ${animalTwoResponse.getResponseCode()}`);

        const animalOneResponseIs429 = animalOneResponse.getResponseCode() === TOO_MANY_REQUESTS;
        const animalTwoResponseIs429 = animalTwoResponse.getResponseCode() === TOO_MANY_REQUESTS;
        if (animalOneResponseIs429 || animalTwoResponseIs429) {
            if (animalOneResponseIs429) waitOn429(animalOneResponse);
            else if (animalTwoResponseIs429) waitOn429(animalTwoResponse);
            [animalOneResponse, animalTwoResponse] = observeExternalCall(
                'ezyvet_two_animals',
                () => UrlFetchApp.fetchAll([animalOneRequest, animalTwoRequest]),
                { externalAttempt: 3, retryReason: 'rate_limited' },
            );
        }
    }

    const animalOneJSON = animalOneResponse.getContentText();
    const parsedAnimalOne = JSON.parse(animalOneJSON);
    const animalOneContactID = parsedAnimalOne.items.at(-1).animal.contact_id;

    const animalTwoJSON = animalTwoResponse.getContentText();
    const parsedAnimalTwo = JSON.parse(animalTwoJSON);
    const animalTwoContactID = parsedAnimalTwo.items.at(-1).animal.contact_id;

    return [animalOneContactID, animalTwoContactID];
};

function waitOn429(response) {
    const secondsTilNextRetryMatch = response.getContentText().match(/(\d+)\s+seconds/);
    const secondsTilNextRetry = secondsTilNextRetryMatch?.[1];
    if (secondsTilNextRetry) {
        logObservedEvent('external_retry_scheduled', {
            retryDelayMs: Number(secondsTilNextRetry) * 1000,
            retryReason: 'rate_limited',
        });
        Utilities.sleep(Number(secondsTilNextRetry) * 1000);
    }
}

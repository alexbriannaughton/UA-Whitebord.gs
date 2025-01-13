// singular get request to ezyvet api that will grab a new token if we get a 401 reponse
function fetchAndParse(url) {
    token = getToken();

    const options = {
        muteHttpExceptions: true,
        method: "GET",
        headers: {
            authorization: token
        }
    };

    let response = UrlFetchApp.fetch(url, options);

    if (response.getResponseCode() === 401) {
        options.headers.authorization = updateToken();
        response = UrlFetchApp.fetch(url, options);
    }

    if (response.getResponseCode() !== 200) {
        console.error(`Response Code: ${response.getResponseCode()}`);
        console.error(`Response Text: ${response.getContentText()}`);

        if (response.getResponseCode() === 429) {
            waitOn429(response);
            response = UrlFetchApp.fetch(url, options);
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

    let [animalResponse, contactResponse] = UrlFetchApp.fetchAll([animalRequest, contactRequest]);

    if (animalResponse.getResponseCode() === 401 || contactResponse.getResponseCode() === 401) {
        animalRequest.headers.authorization = updateToken();
        contactRequest.headers.authorization = token;
        [animalResponse, contactResponse] = UrlFetchApp.fetchAll([animalRequest, contactRequest]);
    }

    if (animalResponse.getResponseCode() !== 200 || contactResponse.getResponseCode() !== 200) {
        console.error(`Request failed: Animal response code: ${animalResponse.getResponseCode()}`);
        console.error(`Contact response code: ${contactResponse.getResponseCode()}`);
        console.error(`Animal response text: ${animalResponse.getContentText()}`);
        console.error(`Contact response text: ${contactResponse.getContentText()}`);

        const animalResponseIs429 = animalResponse.getResponseCode() === 429;
        const contactResponseIs429 = contactResponse.getResponseCode() === 429;
        if (animalResponseIs429 || contactResponseIs429) {
            if (animalResponseIs429) waitOn429(animalResponse);
            else if (contactResponseIs429) waitOn429(contactResponse);
            [animalResponse, contactResponse] = UrlFetchApp.fetchAll([animalRequest, contactRequest]);
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

    let [animalOneResponse, animalTwoResponse] = UrlFetchApp.fetchAll([animalOneRequest, animalTwoRequest]);

    if (animalOneResponse.getResponseCode() === 401 || animalTwoResponse.getResponseCode() === 401) {
        animalOneRequest.headers.authorization = updateToken();
        animalTwoRequest.headers.authorization = token;
        [animalOneResponse, animalTwoResponse] = UrlFetchApp.fetchAll([animalOneRequest, animalTwoRequest]);
    }

    if (animalOneResponse.getResponseCode() !== 200 || animalTwoResponse.getResponseCode() !== 200) {
        console.error(`Request failed: Animal 1 response code: ${animalOneResponse.getResponseCode()}`);
        console.error(`Animal 2 response code: ${animalTwoResponse.getResponseCode()}`);
        console.error(`Animal 1 response text: ${animalOneResponse.getContentText()}`);
        console.error(`Animal 2 response text: ${animalTwoResponse.getContentText()}`);
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
    console.log('match: ', secondsTilNextRetryMatch);
    const secondsTilNextRetry = secondsTilNextRetryMatch?.[1];
    console.error('seconds til next retry: ', secondsTilNextRetry);
    if (secondsTilNextRetry) {
        Utilities.sleep(Number(secondsTilNextRetry) * 1000);
    }
}
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

    const json = response.getContentText();

    return JSON.parse(json);
};

// use fetchAndParse() to store pet name and species from /animal endpoint
function getAnimalInfo(animalID) {
    const url = `${proxy}/v1/animal/${animalID}`;
    const animal = fetchAndParse(url).items.at(-1).animal;
    const species = speciesMap[animal.species_id] || undefined;

    return [animal.name, species];
};

// use fetchAndParse() to store last name from /contact endpoint
function getLastName(contactID) {
    const url = `${proxy}/v1/contact/${contactID}`;
    const lastName = fetchAndParse(url).items.at(-1).contact.last_name;

    return lastName;
};

function getContactIdFromAnimalId(animalID) {
    const url = `${proxy}/v1/animal/${animalID}`;
    const contactID = fetchAndParse(url).items.at(-1).contact_id;
    return contactID;
}

// this is like a promise.all to get animal name and last name at the same time
function getAnimalInfoAndLastName(animalID, contactID) {
    token = getToken();

    const animalRequest = {
        muteHttpExceptions: true,
        url: `${proxy}/v1/animal/${animalID}`,
        method: "GET",
        headers: {
            authorization: token
        }
    };

    const contactRequest = {
        muteHttpExceptions: true,
        url: `${proxy}/v1/contact/${contactID}`,
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

    const animalJSON = animalResponse.getContentText();
    const parsedAnimal = JSON.parse(animalJSON);
    const animal = parsedAnimal.items.at(-1).animal;
    const speciesMap = { 1: 'K9', 2: 'FEL' };
    const animalSpecies = speciesMap[animal.species_id] || undefined;

    const contactJSON = contactResponse.getContentText();
    const parsedContact = JSON.parse(contactJSON);
    const contactLastName = parsedContact.items.at(-1).contact.last_name;

    return [animal.name, animalSpecies, contactLastName]
};

function getTwoAnimalContactIDsAsync(animalOneID, animalTwoID) {
    token = getToken();

    const animalOneRequest = {
        muteHttpExceptions: true,
        url: `${proxy}/v1/animal/${animalOneID}`,
        method: "GET",
        headers: {
            authorization: token
        }
    };

    const animalTwoRequest = {
        muteHttpExceptions: true,
        url: `${proxy}/v1/animal/${animalTwoID}`,
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

    const animalOneJSON = animalOneResponse.getContentText();
    const parsedAnimalOne = JSON.parse(animalOneJSON);
    const animalOneContactID = parsedAnimalOne.items.at(-1).animal.contact_id;

    const animalTwoJSON = animalTwoResponse.getContentText();
    const parsedAnimalTwo = JSON.parse(animalTwoJSON);
    const animalTwoContactID = parsedAnimalTwo.items.at(-1).animal.contact_id;

    return [animalOneContactID, animalTwoContactID];
};
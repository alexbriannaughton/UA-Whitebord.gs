let token; // token is a global variable

function putTokenInCache(cache, token) {
    cache.put('ezyVet_token', token, 30600); // store for 8.5 hours
}

function updateToken() {
    const url = `${proxy}/v2/oauth/access_token`;
    const props = PropertiesService.getScriptProperties();
    const cache = CacheService.getScriptCache();
    const payload = {
        partner_id: props.getProperty('partner_id'),
        client_id: props.getProperty('client_id'),
        client_secret: props.getProperty('client_secret'),
        grant_type: props.getProperty('grant_type'),
        scope: props.getProperty('scope')
    };
    const options = {
        crossDomain: true,
        method: "POST",
        payload: payload
    };
    const response = UrlFetchApp.fetch(url, options);
    const json = response.getContentText();
    const dataObj = JSON.parse(json);
    token = `${dataObj.token_type} ${dataObj.access_token}`; // globally reset the token variable for this script execution
    props.setProperty('ezyVet_token', token);
    putTokenInCache(cache, token);
    console.log('updated ezyvet token');
    return token;
};

// singular get request to ezyvet api that will grab a new token if we get a 401 reponse
function fetchAndParse(url) {
    const cache = CacheService.getScriptCache();
    token = cache.get('ezyVet_token');
    if (!token) {
        token = PropertiesService.getScriptProperties().getProperty('ezyVet_token');
        putTokenInCache(cache, token);
        console.log('pulled token from props and added to cache');
    }

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
    const speciesMap = { 1: 'K9', 2: 'FEL' };
    const species = speciesMap[animal.species_id] || '';

    return [animal.name, species];
};

// use fetchAndParse() to store last name from /contact endpoint
function getLastName(contactID) {
    const url = `${proxy}/v1/contact/${contactID}`;
    const lastName = fetchAndParse(url).items.at(-1).contact.last_name;

    return lastName;
};

// this is like a promise.all to get animal name and last name at the same time
function getAnimalInfoAndLastName(animalID, contactID) {
    const cache = CacheService.getScriptCache();
    token = cache.get('ezyVet_token');
    if (!token) {
        token = PropertiesService.getScriptProperties().getProperty('ezyVet_token');
        putTokenInCache(cache, token);
        console.log('pulled token from props and added to cache');
    }

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
    const animalSpecies = speciesMap[animal.species_id] || 'Unknown species';

    const contactJSON = contactResponse.getContentText();
    const parsedContact = JSON.parse(contactJSON);
    const contactLastName = parsedContact.items.at(-1).contact.last_name;

    return [animal.name, animalSpecies, contactLastName]
};
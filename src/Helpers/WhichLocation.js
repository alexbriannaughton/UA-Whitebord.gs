function whichLocation(resourceId) {
    if (!ezyVetResourceToUaLoc) ezyVetResourceToUaLoc = fetchAndBuildEzyVetResourceMap();
    return ezyVetResourceToUaLoc.get(resourceId);
}

function fetchAndBuildEzyVetResourceMap(cache = CacheService.getScriptCache()) {
    const [separations, resources] = getSeparationsAndResources();
    const ezyVetResourceMap = {};

    resources.forEach(({ resource }) => {
        const separationOfUaLoc = separations.find(({ separation }) => separation.id === resource.ownership_id);
        if (!separationOfUaLoc) {
            console.error(`No Urban Animal Location for facility resource: ${resource}`);
            return;
        }

        const uaLoc = separationOfUaLoc.separation.name;
        if (!uaLoc) {
            console.error(`No uaLoc for ${separationOfUaLoc}`);
            return;
        }

        ezyVetResourceMap[resource.id] = uaLoc;
    });

    cache.put(EZYVET_RESOURCE_TO_UA_LOC_NAME, JSON.stringify(ezyVetResourceMap), 120);

    return ezyVetResourceMap;
}

function getSeparationsAndResources() {
    token = getToken();

    const separationsRequest = {
        muteHttpExceptions: true,
        url: `${EV_PROXY}/v1/separation?limit=200&active=1&type=Division&parent=1`,
        method: "GET",
        headers: {
            authorization: token
        }
    };

    const resourcesRequest = {
        muteHttpExceptions: true,
        url: `${EV_PROXY}/v1/resource?type=facility&limit=200&active=1`,
        method: "GET",
        headers: {
            authorization: token
        }
    };

    let [separationsResponse, resourcesResponse] = UrlFetchApp.fetchAll([separationsRequest, resourcesRequest]);

    if (separationsResponse.getResponseCode() === UNAUTHORIZED || resourcesResponse.getResponseCode() === UNAUTHORIZED) {
        separationsRequest.headers.authorization = updateToken();
        resourcesRequest.headers.authorization = token;
        [separationsResponse, resourcesResponse] = UrlFetchApp.fetchAll([separationsRequest, resourcesRequest]);
    }

    if (separationsResponse.getResponseCode() !== OK || resourcesResponse.getResponseCode() !== OK) {
        console.error(`Request failed: separations response code: ${separationsResponse.getResponseCode()}`);
        console.error(`resources response code: ${resourcesResponse.getResponseCode()}`);
        console.error(`separations response text: ${separationsResponse.getContentText()}`);
        console.error(`resources response text: ${resourcesResponse.getContentText()}`);

        const separationsResponseIs429 = separationsResponse.getResponseCode() === TOO_MANY_REQUESTS;
        const resourcesResponseIs429 = resourcesResponse.getResponseCode() === TOO_MANY_REQUESTS;
        if (separationsResponseIs429 || resourcesResponseIs429) {
            if (separationsResponseIs429) waitOn429(separationsResponse);
            else if (resourcesResponseIs429) waitOn429(resourcesResponse);
            [separationsResponse, resourcesResponse] = UrlFetchApp.fetchAll([separationsRequest, resourcesRequest]);
        }
    }

    const separationsJSON = separationsResponse.getContentText();
    const parsedSeparations = JSON.parse(separationsJSON);
    const separations = parsedSeparations.items;

    const resourcesJson = resourcesResponse.getContentText();
    const parsedResources = JSON.parse(resourcesJson);
    const resources = parsedResources.items;

    return [separations, resources];
};
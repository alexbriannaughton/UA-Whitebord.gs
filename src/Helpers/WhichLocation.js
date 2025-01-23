let ezyVetResourceToUaLoc;

function whichLocation(resourceId) {
    if (ezyVetResourceToUaLoc === undefined) {
        ezyVetResourceToUaLoc = buildEzyVetResourceMap();
    }
    
    console.log(ezyVetResourceToUaLoc)
    
    return ezyVetResourceToUaLoc.get(resourceId)
}

function buildEzyVetResourceMap() {
    const [separations, resources] = getSeparationsAndResources();
    const map = new Map();

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

        map.set(resource.id, uaLoc)
    });

    return map;
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
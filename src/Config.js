function getToken() {
    token = token || CacheService.getScriptCache().get(TOKEN_NAME);
    if (!token) token = updateToken();
    return token;
}

function updateToken(cache = CacheService.getScriptCache()) {
    const url = `${EV_PROXY}/v2/oauth/access_token`;
    const payload = getEvCreds();
    const options = {
        crossDomain: true,
        method: "POST",
        payload
    };

    const response = observeExternalCall(
        'ezyvet_token',
        () => UrlFetchApp.fetch(url, options),
    );
    const { token_type, access_token } = JSON.parse(response.getContentText());
    token = `${token_type} ${access_token}`;
    cache.put(TOKEN_NAME, token, 21600);

    return token;
};

function getEvCreds() {
    const props = PropertiesService.getScriptProperties();
    const api = `https://secretmanager.googleapis.com/v1/projects/${props.getProperty('gcp_id')}/secrets/${props.getProperty('secret_name')}/versions/${props.getProperty('secret_version')}:access`;
    const response = observeExternalCall(
        'secret_manager',
        () => UrlFetchApp.fetch(api, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
                'Content-Type': 'application/json',
            },
            muteHttpExceptions: true,
        }),
    );

    const { error, payload } = JSON.parse(response.getContentText());

    if (error) {
        throw new Error(error.message);
    }

    const bytes = Utilities.base64Decode(payload.data);
    const base64 = bytes.map((byte) => `%${byte.toString(16).padStart(2, '0')}`).join('');
    const val = decodeURIComponent(base64);
    return JSON.parse(val);
};

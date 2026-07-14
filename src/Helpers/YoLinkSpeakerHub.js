const YOLINK_TOKEN_URL = 'https://api.yosmart.com/open/yolink/token';
const YOLINK_API_URL = 'https://api.yosmart.com/open/yolink/v2/api';
const YOLINK_UAID_PROPERTY = 'yolink_uaid';
const YOLINK_UAC_SECRET_PROPERTY = 'yolink_uac_secret';
const YOLINK_ACCESS_TOKEN_CACHE_KEY = 'yolink_access_token';
const YOLINK_CACHE_MAX_SECONDS = 21600;
const YOLINK_DEFAULT_TOKEN_CACHE_SECONDS = 3300;
const YOLINK_ROOM_MESSAGE = 'Room ready';
const YOLINK_ROOM_VOLUME = 1;
const YOLINK_SPEAKERHUB_NAME_PROPERTY_BY_LOCATION = {
  CH: 'yolink_speakerhub_ch_name',
  DT: 'yolink_speakerhub_dt_name',
  WC: 'yolink_speakerhub_wc_name'
};

function playRoomPopulatedSound(uaLocSheetName) {
  try {
    // Phase 1: a location is enabled only when its device-name property exists.
    // This lets CH run the pilot while DT and WC remain intentionally silent.
    const deviceNameProperty =
      YOLINK_SPEAKERHUB_NAME_PROPERTY_BY_LOCATION[uaLocSheetName];
    if (!deviceNameProperty) return false;

    const deviceName = PropertiesService
      .getScriptProperties()
      .getProperty(deviceNameProperty);
    if (!deviceName) return false;

    // Phase 2: reuse the account token and resolved device information to keep
    // the room webhook fast. Both caches refresh automatically when they age
    // out, so adding a replacement device does not require a code change.
    const accessToken = getYoLinkAccessToken_();
    const speakerHub = getYoLinkSpeakerHub_(
      accessToken,
      uaLocSheetName,
      deviceName
    );

    // Phase 3: send only a generic spoken message. Sound failures are contained
    // here and can never unwind an otherwise successful whiteboard room write.
    playYoLinkSpeakerHub_(accessToken, speakerHub);
    return true;
  }
  catch (error) {
    console.error(
      `YoLink room sound failed for ${uaLocSheetName}: ${error.message}`
    );
    return false;
  }
}

function testChYoLinkRoomSound() {
  if (!playRoomPopulatedSound('CH')) {
    throw new Error('CH YoLink room sound test failed; check the execution log');
  }
}

function testYoLinkSpeakerHub() {
  // Phase 1: authenticate with the account-scoped credential stored only in
  // Apps Script properties. The smoke test shares production token caching so
  // it exercises the same authentication path used by room events.
  const accessToken = getYoLinkAccessToken_();

  // Phase 2: discover the pilot SpeakerHub through the account rather than
  // requiring its device ID and device token to be copied into configuration.
  // Requiring exactly one match keeps this test unambiguous while only the
  // pilot device is registered.
  const deviceListResponse = sendYoLinkApiRequest_(
    accessToken,
    {
      method: 'Home.getDeviceList',
      time: Date.now()
    }
  );
  const speakerHubs = (deviceListResponse.data?.devices || [])
    .filter(device => device.type === 'SpeakerHub');

  if (speakerHubs.length !== 1) {
    throw new Error(
      `Expected exactly one YoLink SpeakerHub, found ${speakerHubs.length}`
    );
  }

  // Phase 3: use the same generic message and minimum volume as production.
  // Do not include patient or appointment data in sound requests.
  const speakerHub = speakerHubs[0];
  const playResponse = playYoLinkSpeakerHub_(accessToken, speakerHub);

  console.log(`YoLink SpeakerHub smoke test succeeded: ${speakerHub.name}`);
  return playResponse;
}

function getYoLinkAccessToken_() {
  const cache = CacheService.getScriptCache();
  const cachedAccessToken = cache.get(YOLINK_ACCESS_TOKEN_CACHE_KEY);
  if (cachedAccessToken) return cachedAccessToken;

  const properties = PropertiesService.getScriptProperties();
  const uaid = properties.getProperty(YOLINK_UAID_PROPERTY);
  const uacSecret = properties.getProperty(YOLINK_UAC_SECRET_PROPERTY);

  if (!uaid || !uacSecret) {
    throw new Error(
      `Missing ${YOLINK_UAID_PROPERTY} or ${YOLINK_UAC_SECRET_PROPERTY}`
    );
  }

  const response = UrlFetchApp.fetch(
    YOLINK_TOKEN_URL,
    {
      method: 'post',
      payload: {
        grant_type: 'client_credentials',
        client_id: uaid,
        client_secret: uacSecret
      },
      muteHttpExceptions: true
    }
  );
  const responseCode = response.getResponseCode();
  const responseBody = parseYoLinkJson_(response.getContentText());

  if (responseCode < 200 || responseCode >= 300) {
    throw new Error(
      `YoLink authentication failed with HTTP ${responseCode}`
    );
  }

  if (!responseBody.access_token) {
    throw new Error('YoLink authentication response did not include an access token');
  }

  const expiresIn = Number(responseBody.expires_in);
  const cacheSeconds = Number.isFinite(expiresIn) && expiresIn > 120
    ? Math.min(Math.floor(expiresIn - 60), YOLINK_CACHE_MAX_SECONDS)
    : YOLINK_DEFAULT_TOKEN_CACHE_SECONDS;
  cache.put(
    YOLINK_ACCESS_TOKEN_CACHE_KEY,
    responseBody.access_token,
    cacheSeconds
  );

  return responseBody.access_token;
}

function getYoLinkSpeakerHub_(accessToken, uaLocSheetName, deviceName) {
  const cache = CacheService.getScriptCache();
  const cacheKey = `yolink_speakerhub_${uaLocSheetName}`;
  const cachedDevice = cache.get(cacheKey);

  if (cachedDevice) {
    const speakerHub = parseYoLinkJson_(cachedDevice);
    if (speakerHub.name === deviceName) return speakerHub;
  }

  const response = sendYoLinkApiRequest_(
    accessToken,
    {
      method: 'Home.getDeviceList',
      time: Date.now()
    }
  );
  const matchingDevices = (response.data?.devices || [])
    .filter(device =>
      device.type === 'SpeakerHub' && device.name === deviceName
    );

  if (matchingDevices.length !== 1) {
    throw new Error(
      `Expected one SpeakerHub named "${deviceName}", found ${matchingDevices.length}`
    );
  }

  const speakerHub = {
    deviceId: matchingDevices[0].deviceId,
    token: matchingDevices[0].token,
    name: matchingDevices[0].name
  };
  cache.put(cacheKey, JSON.stringify(speakerHub), YOLINK_CACHE_MAX_SECONDS);

  return speakerHub;
}

function playYoLinkSpeakerHub_(accessToken, speakerHub) {
  return sendYoLinkApiRequest_(
    accessToken,
    {
      method: 'SpeakerHub.playAudio',
      time: Date.now(),
      targetDevice: speakerHub.deviceId,
      token: speakerHub.token,
      params: {
        message: YOLINK_ROOM_MESSAGE,
        volume: YOLINK_ROOM_VOLUME,
        repeat: 1
      }
    }
  );
}

function sendYoLinkApiRequest_(accessToken, requestBody) {
  const response = UrlFetchApp.fetch(
    YOLINK_API_URL,
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    }
  );
  const responseCode = response.getResponseCode();
  const responseBody = parseYoLinkJson_(response.getContentText());

  if (responseCode < 200 || responseCode >= 300) {
    throw new Error(
      `YoLink ${requestBody.method} failed with HTTP ${responseCode}`
    );
  }

  if (responseBody.code !== '000000') {
    const description = responseBody.desc
      ? `: ${responseBody.desc}`
      : '';
    throw new Error(
      `YoLink ${requestBody.method} failed with code ${responseBody.code}${description}`
    );
  }

  return responseBody;
}

function parseYoLinkJson_(text) {
  try {
    return JSON.parse(text);
  }
  catch (_error) {
    throw new Error('YoLink returned a non-JSON response');
  }
}

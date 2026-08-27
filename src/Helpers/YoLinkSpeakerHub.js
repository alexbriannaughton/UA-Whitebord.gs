const YOLINK_TOKEN_URL = 'https://api.yosmart.com/open/yolink/token';
const YOLINK_API_URL = 'https://api.yosmart.com/open/yolink/v2/api';
const YOLINK_UAID_PROPERTY = 'yolink_uaid';
const YOLINK_UAC_SECRET_PROPERTY = 'yolink_uac_secret';
const YOLINK_ACCESS_TOKEN_CACHE_KEY = 'yolink_access_token';
const YOLINK_CACHE_MAX_SECONDS = 21600;
const YOLINK_DEFAULT_TOKEN_CACHE_SECONDS = 3300;
const YOLINK_ROOM_VOLUME = 1;
const YOLINK_TEST_MESSAGE = 'Test animal in Room 1';
const YOLINK_SPEAKERHUB_NAME_PROPERTY_BY_LOCATION = {
  CH: 'yolink_speakerhub_ch_name',
  DT: 'yolink_speakerhub_dt_name',
  WC: 'yolink_speakerhub_wc_name'
};
const YOLINK_SPACE_NAME_BY_LOCATION_AND_STATUS = {
  CH: {
    18: 'Room 1',
    25: 'Room 2',
    26: 'Room 3',
    27: 'Room 4',
    28: 'Room 5',
    29: 'Room 6',
    30: 'Room 7',
    31: 'Room 8',
    32: 'Room 9',
    33: 'Room 10',
    36: 'Room 11',
    39: 'Dog Lobby',
    40: 'Cat Lobby'
  },
  DT: {
    18: 'Room 1',
    25: 'Room 2',
    26: 'Room 3',
    27: 'Room 4',
    28: 'Room 5',
    29: 'Room 6',
    30: 'Room 7'
  },
  WC: {
    18: 'Walk-in Room 1',
    25: 'Walk-in Room 2',
    26: 'Walk-in Room 3',
    27: 'Walk-in Room 4',
    28: 'Walk-in Room 5',
    21: 'Walk-in Lobby',
    43: 'Appointment Room 1',
    42: 'Appointment Room 2',
    41: 'Appointment Room 3',
    44: 'Appointment Lobby'
  }
};

function playRoomPopulatedSound(uaLocSheetName, statusId, animalName) {
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
    const message = getYoLinkRoomMessage_(
      uaLocSheetName,
      statusId,
      animalName
    );

    // Phase 3: announce the animal and its new space. Sound failures are
    // contained here and can never unwind a successful whiteboard room write.
    playYoLinkSpeakerHub_(accessToken, speakerHub, message);
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
  if (!playRoomPopulatedSound('CH', 18, 'Test animal')) {
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

  // Phase 3: use a synthetic message and the same minimum volume as production.
  const speakerHub = speakerHubs[0];
  const playResponse = playYoLinkSpeakerHub_(
    accessToken,
    speakerHub,
    YOLINK_TEST_MESSAGE
  );

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

  const response = observeExternalCall(
    'yolink_token',
    () => UrlFetchApp.fetch(
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
    )
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

function getYoLinkRoomMessage_(uaLocSheetName, statusId, animalName) {
  const spaceName =
    YOLINK_SPACE_NAME_BY_LOCATION_AND_STATUS[uaLocSheetName]?.[statusId];
  if (!spaceName) {
    throw new Error(
      `No YoLink space name for ${uaLocSheetName} status ${statusId}`
    );
  }

  const trimmedAnimalName = String(animalName || '').trim();
  if (!trimmedAnimalName) {
    throw new Error('Cannot build a YoLink room message without an animal name');
  }

  return `${trimmedAnimalName} in ${spaceName}`;
}

function playYoLinkSpeakerHub_(accessToken, speakerHub, message) {
  return sendYoLinkApiRequest_(
    accessToken,
    {
      method: 'SpeakerHub.playAudio',
      time: Date.now(),
      targetDevice: speakerHub.deviceId,
      token: speakerHub.token,
      params: {
        message,
        volume: YOLINK_ROOM_VOLUME,
        repeat: 1
      }
    }
  );
}

function sendYoLinkApiRequest_(accessToken, requestBody) {
  const response = observeExternalCall(
    `yolink_${requestBody.method}`,
    () => UrlFetchApp.fetch(
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
    )
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

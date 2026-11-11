// All ezyVet issuance belongs to the Supabase broker. Cached tokens keep the
// normal room-update path direct to ezyVet, without a Supabase request.
function getToken() {
  const cache = CacheService.getScriptCache();
  if (isUsableEzyVetCredential(tokenCredential)) return tokenCredential.token;
  let stored;
  try { stored = JSON.parse(cache.get(TOKEN_NAME)); } catch { stored = null; }
  if (isUsableEzyVetCredential(stored)) {
    tokenCredential = stored;
    token = stored.token;
    return token;
  }
  return updateToken(cache, false);
}

function updateToken(cache = CacheService.getScriptCache(), rejected = true) {
  // The database serializes renewal across executions. Reuse a newer cached
  // token if another execution has already recovered the rejected credential.
  const rejectedToken = rejected ? token : undefined;
  {
    let stored;
    try { stored = JSON.parse(cache.get(TOKEN_NAME)); } catch { stored = null; }
    if (isUsableEzyVetCredential(stored) && stored.token !== rejectedToken) {
      tokenCredential = stored;
      token = stored.token;
      return token;
    }
    const props = PropertiesService.getScriptProperties();
    const url = props.getProperty('ezyvet_token_broker_url');
    if (!url || !/^https:\/\/[^/]+\/functions\/v1\/ezyvet-token-broker$/.test(url)) {
      throw new Error('ezyVet token broker is not configured');
    }
    // Fetch the broker credential through the existing Google identity boundary
    // only on the cold/recovery path. Warm token reads never visit Secret Manager.
    const secret = getBrokerSecret(props);
    const response = observeExternalCall('ezyvet_token_broker', () => UrlFetchApp.fetch(url, {
      method:'POST', contentType:'application/json', muteHttpExceptions:true,
      followRedirects:false,
      headers:{ 'x-ua-token-broker-secret':secret },
      payload:JSON.stringify(rejectedToken ? { rejectedToken } : {}),
    }));
    if (response.getResponseCode() !== 200) throw new Error('ezyVet token unavailable');
    const credential = JSON.parse(response.getContentText());
    if (!isUsableEzyVetCredential(credential)) throw new Error('ezyVet token response invalid');
    tokenCredential = credential;
    token = credential.token;
    const ttl = Math.min(21600,Math.floor((Date.parse(credential.expiresAt)-Date.now()-60000)/1000));
    try { cache.put(TOKEN_NAME,JSON.stringify(credential),Math.max(1,ttl)); }
    catch { /* Cache failure must not discard a valid token. */ }
    return token;
  }
}

function getBrokerSecret(props) {
  const project = props.getProperty('gcp_id');
  const name = props.getProperty('ezyvet_token_broker_secret_name');
  const version = props.getProperty('ezyvet_token_broker_secret_version') || 'latest';
  if (!project || !name || ![project, name, version].every(value => /^[A-Za-z0-9_-]+$/.test(value))) {
    throw new Error('ezyVet broker Secret Manager reference is not configured');
  }
  const url = `https://secretmanager.googleapis.com/v1/projects/${project}/secrets/${name}/versions/${version}:access`;
  const response = observeExternalCall('secret_manager', () => UrlFetchApp.fetch(url, {
    method: 'GET', muteHttpExceptions: true, followRedirects: false,
    headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
  }));
  if (response.getResponseCode() !== 200) throw new Error('ezyVet broker credential unavailable');
  const payload = JSON.parse(response.getContentText()).payload;
  if (!payload || typeof payload.data !== 'string') throw new Error('ezyVet broker credential invalid');
  const secret = Utilities.newBlob(Utilities.base64Decode(payload.data)).getDataAsString('UTF-8').trim();
  if (!secret || secret.length > 8192 || /\s/.test(secret)) throw new Error('ezyVet broker credential invalid');
  return secret;
}

function isUsableEzyVetCredential(value) {
  return value && typeof value.token === 'string' && /^Bearer \S+$/.test(value.token) &&
    value.token.length <= 8192 && typeof value.expiresAt === 'string' &&
    Date.parse(value.expiresAt) > Date.now()+60000;
}

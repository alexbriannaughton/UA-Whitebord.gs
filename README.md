I develop and maintain a Google Apps Script for [Urban Animal](https://urbananimalnw.com/) which integrates an internal tool with our veterinary EHR, [ezyVet](https://www.ezyvet.com/). I also work the front desk : ) 

The tool is a Google Sheet that we call the "White Board", and it functions as a real-time tracker for the 20-70 onsite pets actively under the care of Urban Animal. The spreadsheet is used across its three Seattle locations by over 100 employees.

The project utilizes Google Cloud Platform, webhooks from ezyVet's fab API, Github Actions and Javascript.

## Connecting to Apps Script

This repository owns the whiteboard Apps Script. `../prod-circlesheet` is the
React/Vite dashboard and has no Apps Script project. Both whiteboard projects
are owned by **urbananimal@urbananimal.com**. Use that account for clasp;
the account selected in gcloud or a browser does not establish clasp identity.

| Environment | Apps Script editor / script ID |
| --- | --- |
| Production | [1S61OMclYE-SxPjUNMzAlHizRxkJo-1H0jGmZwPk0LXtiGuIsJFRUGQyG](https://script.google.com/home/projects/1S61OMclYE-SxPjUNMzAlHizRxkJo-1H0jGmZwPk0LXtiGuIsJFRUGQyG/edit) |
| Development | [13qf5G9dGt1JuGQ5CF746B_Mr4_pTLDAq48DztmcSid52xVgKNwotZEo8](https://script.google.com/home/projects/13qf5G9dGt1JuGQ5CF746B_Mr4_pTLDAq48DztmcSid52xVgKNwotZEo8/edit) |

Read-only verification on November 10, 2026 confirmed the `refs/heads/main`
deployment at version 104 and `refs/heads/develop` at version 527. Requery
deployment metadata before using those numbers as a current baseline.

The tracked `.clasp.json` contains only `rootDir: "src"`; it deliberately does
not select a project. Do not infer the target from the current Git branch or
substitute the spreadsheet ID, deployment ID, or GCP project ID for a script ID.

### Reuse the existing login and verify access

In WSL, the existing Google clasp credentials are at `~/.clasprc.json`, under
`tokens.default`. Treat the entire file as a secret. Do not print, commit or
paste its contents. Check the existing login before starting another login.
The following read-only connection check uses those credentials directly with
Google's APIs, confirms the account and lists both projects' deployment versions.
It keeps the refreshed access token in memory and does not execute either web
app, change source, or create a deployment:

```python
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

credentials = json.loads((Path.home() / ".clasprc.json").read_text())["tokens"]["default"]
refresh_body = urlencode({
    "grant_type": "refresh_token",
    "client_id": credentials["client_id"],
    "client_secret": credentials["client_secret"],
    "refresh_token": credentials["refresh_token"],
}).encode()
with urlopen(Request("https://oauth2.googleapis.com/token", data=refresh_body), timeout=20) as response:
    access_token = json.load(response)["access_token"]

def google_get(url):
    request = Request(url, headers={"Authorization": "Bearer " + access_token})
    with urlopen(request, timeout=20) as response:
        return json.load(response)

identity = google_get("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)")
email = identity["user"]["emailAddress"]
if email != "urbananimal@urbananimal.com":
    raise SystemExit("Wrong clasp account: " + email)
print("Verified clasp account:", email)

projects = {
    "production": "1S61OMclYE-SxPjUNMzAlHizRxkJo-1H0jGmZwPk0LXtiGuIsJFRUGQyG",
    "development": "13qf5G9dGt1JuGQ5CF746B_Mr4_pTLDAq48DztmcSid52xVgKNwotZEo8",
}
for environment, script_id in projects.items():
    base = "https://script.googleapis.com/v1/projects/" + script_id
    project = google_get(base)
    print(environment, project["title"], "script ID:", project["scriptId"])
    page_token = ""
    while True:
        page = google_get(base + "/deployments?" + urlencode({"pageSize": 50, "pageToken": page_token}))
        for deployment in page.get("deployments", []):
            config = deployment["deploymentConfig"]
            print("  deployment:", deployment["deploymentId"],
                  "version:", config.get("versionNumber", "HEAD"),
                  "description:", config.get("description", ""))
        page_token = page.get("nextPageToken", "")
        if not page_token:
            break
```

Run this with `python3` from a temporary file in `/tmp`, or a quoted heredoc;
do not put credentials in shell arguments. This is the same authentication
approach used for the temporary DEV validation in November 2026. No browser
login or gcloud account switch is required while the saved login remains valid.
If refresh fails with `invalid_grant`/`invalid_rapt`, renew the clasp login as the
owner account. For 403/404, verify identity, script ID, permissions and Apps
Script API access before assuming the project is missing. The owner can check
the Apps Script API setting at https://script.google.com/home/usersettings.
A script listing
alone is not a reliable way to discover these bound projects.

### Google clasp CLI and source inspection

On this WSL machine, `/usr/bin/clasp` is the unrelated Potassco solver. Invoke
the Google npm package explicitly. Local CLI help was checked with 3.4.1; the
existing GitHub workflow remains pinned to 3.3.0.

```sh
npx --yes @google/clasp@3.4.1 --version
npx --yes @google/clasp@3.4.1 list-deployments 1S61OMclYE-SxPjUNMzAlHizRxkJo-1H0jGmZwPk0LXtiGuIsJFRUGQyG
```

Only if login renewal is needed, run
`npx --yes @google/clasp@3.4.1 login --no-localhost` and choose
`urbananimal@urbananimal.com`. Do not log out a working account to inspect it.

For source inspection, prefer the authenticated
[`projects.getContent`](https://developers.google.com/apps-script/api/reference/rest/v1/projects/getContent)
API: `GET /v1/projects/{scriptId}/content` reads HEAD, and
`?versionNumber=<number>` reads an immutable version. Compare the version from
[`projects.deployments.list`](https://developers.google.com/apps-script/api/reference/rest/v1/projects.deployments/list),
rather than assuming HEAD is serving. Save private readbacks under ignored
`.local/` or `/tmp`; `clasp pull` writes local files, so use an isolated working
directory for pulls. The runtime `/exec` URL invokes application code and is
not an authentication-only probe.

### Deployment boundary

Connecting or inspecting does not authorize a deployment. The existing
`.github/workflows/deploy-script.yml` workflow maps `main` to production and
`develop` to DEV through the `PROD_SCRIPT_ID`/`DEV_SCRIPT_ID` and corresponding
deployment-ID GitHub secrets. A push to either branch uploads and deploys
immediately. Manual workflow dispatch uploads HEAD but does not run the
push-only version deployment step. `CLASPRC_JSON` must contain the complete
clasp credential JSON; an access token alone is insufficient.

Before an authorized release, verify the target explicitly, snapshot remote
HEAD and serving deployment, check for unpublished cloud edits, and upload only
the reviewed source. A source push replaces the entire remote project content;
version promotion is a separate operation. Update the existing deployment ID
to preserve its webhook URL, then read back and compare the deployed version.
Keep temporary validation deployments and local snapshots out of the maintained
project once their recovery path is verified. See the
[Google clasp documentation](https://github.com/google/clasp/tree/v3.4.1)
for command details.

Successfully populating a previously empty room can announce the animal's
ezyVet first name and destination space on a location-specific YoLink
SpeakerHub. Adding another pet to an occupied multiple-pet room does not play a
sound. Apps Script authenticates directly with the YoLink Cloud API; credentials
and location-to-device-name mappings are kept in Script Properties, and sound
delivery is best-effort so it cannot interrupt whiteboard updates.

As of 2026-07-14, CH announcement playback is configured and validated at
volume 1. DT and WC destination mappings are implemented, but those locations
do not have SpeakerHubs configured and therefore remain silent.

The ezyVet token adapter now retrieves a shared credential from the authenticated
Supabase token broker. Configure Script Properties `ezyvet_token_broker_url` and
`ezyvet_token_broker_secret` during coordinated cutover; no service-role key is
stored here. A versioned cache stores the bearer token and expiry. Valid cache
hits call ezyVet directly without contacting Supabase. Cache misses retrieve the
shared token; 401 recovery sends the exact rejected token. Whiteboard never
issues OAuth tokens independently. See the owning backend's
`supabase/functions/ezyvet-token-broker/README.md` for cutover and recovery.
Local adapter checks: `node --test tests/token-broker.test.cjs`.

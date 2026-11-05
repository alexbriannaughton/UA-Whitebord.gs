I develop and maintain a Google Apps Script for [Urban Animal](https://urbananimalnw.com/) which integrates an internal tool with our veterinary EHR, [ezyVet](https://www.ezyvet.com/). I also work the front desk : ) 

The tool is a Google Sheet that we call the "White Board", and it functions as a real-time tracker for the 20-70 onsite pets actively under the care of Urban Animal. The spreadsheet is used across its three Seattle locations by over 100 employees.

The project utilizes Google Cloud Platform, webhooks from ezyVet's fab API, Github Actions and Javascript.

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

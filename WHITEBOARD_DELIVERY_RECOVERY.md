# Prepared Whiteboard delivery recovery

`src/Code.js` passes the original request to `attemptGet`, which calls
`publishWhiteboardDeliveryResult` with the already computed room/wait payload.
`src/Helpers/WhiteboardDelivery.js` posts that payload to the existing Supabase
five-minute function only when valid request/attempt/token parameters exist.
Ordinary requests and ezyVet webhook handling retain their existing behavior.

The destination is fixed in code. A per-attempt short-lived capability travels
from the cron to Apps Script and back as a callback header; no Supabase service
key, developer OAuth token, or long-lived callback secret is stored here.
The helper does not follow redirects, logs only safe request correlation and
response status, and swallows callback failure before returning ordinary JSON.
It does not retry extraction. UrlFetchApp is synchronous, so an unavailable
receiver can add latency; the normal Edge timeout/retry flow remains available.

No new app, trigger, schedule, property, OAuth scope, or library is required.
The production change updates the existing web-app deployment to a new version.
It is prepared but not deployed pending the backend migration approval and
coordinated rollout. The pre-change production web-app version is 100.

Run `node --test tests/whiteboard-delivery.test.cjs` from this repository.
The backend README at
`../edge-functions/supabase/functions/cron-job-every-5-mins-during-open-hours/README.md`
contains protocol details, migration, cross-repo validation, rollout, generated
Supabase type steps, and rollback. Disabling the backend recovery flag stops
sending callback parameters and thus stops callbacks from this helper.

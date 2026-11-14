# Next-day appointment builds

Automatic NDA appointment webhook updates are paused after the November 13,
2026 API burst and lock-contention incident. `handleAppointment` skips future
appointments after the separate echo/AUS forwarding step. Today's room and
waitlist routing remains active. The nightly/manual builders and NDA helpers
are intentionally retained; the pause does not disable the installed overnight
trigger. Repair placeholder handling and remove provider reads from the NDA
write lock before restoring webhook routing and validating under degraded data.

The user has also requested parking the overnight builder. Remove the owner's
time-based `runAllNdaJobs` trigger in production; trigger removal is separate from
source deployment and must be confirmed in the owning account. Normal webhook
cache initialization no longer reads or populates NDA date caches, so eviction
of those six-hour cache entries cannot start background appointment searches.
NDA helpers are intentionally retained as parked code. The retained manual
builders still perform real work if explicitly invoked; do not run them while
NDA is parked. Re-enable decisions must include restoring and validating the
date-cache contract used by the old NDA webhook helpers.

`runAllNdaJobs` builds DT, CH, and WC on the `NDAs` tab. It first fetches and
publishes every location's basic appointment list, including patient chart links,
before starting optional identity, medication, attachment, and visit-history
reads. A failed location retains its previous section. A failed enrichment leaves
the current list visible and marks unresolved details `Unavailable - see chart`.
Pending or unavailable data must never become a verified negative medication,
demeanor, record, or first-time-client result.

## Reads and failure boundaries

- NDA reads use the existing shared `fetchAndParse` helper and token broker.
  There is no independent token issuer or forced renewal.
- IDs are deduplicated, sorted, and fetched in batches of up to 50. Empty ID
  lists make no request. All response pages are read and validated before a
  clinical lookup is considered complete. Returned IDs must match the requested
  scope; repeated pages and missing pagination metadata fail that stage.
- Successful GETs are cached within one execution. New requests are spaced at
  least 750 ms apart globally and 1500 ms apart per endpoint. Only a failed
  transport GET is retried, up to three attempts; completed batches are reused.
- A four-minute read deadline stops new reads and waits, leaving time for sheet
  writes. This is a soft budget: an in-flight request or the shared helper's
  existing 401/429 recovery can run past it. It does not coordinate API traffic
  from other executions or broker consumers.
- Enrichment runs one stage across all locations before the next stage, so
  attachment/history work cannot start ahead of WC medication work. A stage
  failure does not prevent subsequent locations or stages from being attempted.
- `ENABLE_NDA_ATTACHMENT_DOWNLOADS` remains disabled. Listing attachments still
  runs; enabling downloads is a separate runtime change.

Build logs include location, stage, request count, and sanitized failure reasons.
They omit patient identities and request URLs. Partial success ends with an
exception after available results have been published, preserving Apps Script's
normal failure notification behavior.

## Sheet writes and recovery

The build never clears the whole NDA body. It prepares each location's row payload
before replacing that section. A script lock serializes section writes with NDA
webhook insertion/deletion, and spreadsheet changes flush before releasing it.
Builder API reads happen outside this lock. Existing webhook helpers can still
perform their own reads while holding it; lock contention fails visibly for retry.
Today's room and waitlist handlers do not acquire this NDA lock.

Same-date rebuilds retain matched patients' existing cells and rich text, adding
or removing rows according to the current appointment list. Enrichment fills only
pending/unavailable cells in patient name, history, records, demeanor, and medication
columns. Staff notes, deposits, inserted/deleted webhook rows, and resolved cells
are preserved. A rebuild therefore retries missing details; it does not refresh
already-resolved clinical cells. Matching uses animal chart IDs; multiple
appointments for the same animal share clinical enrichment.

Run `rebuildNdaDt`, `rebuildNdaCh`, or `rebuildNdaWc` in the intended Apps Script
project for a location-specific retry. These are real sheet writes; confirm the
project and authorize recovery before executing. Avoid concurrent manual builds.
Duplicate location headers require review rather than automatic deletion. Retained
old-date headers reject future-appointment webhook writes until the correct list is
built. Cancelling a section's last patient retains a reusable empty row.

## Verification and release

From the repository root:

```sh
node tests/nda-build.test.cjs
node tests/token-broker.test.cjs
```

The NDA suite runs the actual orchestration and webhook code with synthetic API
responses and an in-memory spreadsheet. It covers transport failures, read-budget
exhaustion, missing identities, unknown clinical values, pagination, request reuse,
location recovery, section resizing, staff/webhook changes during enrichment, and
empty-section recovery.

Before promotion, run an authorized DEV build and check the sheet, formatting,
execution duration, stage summary, and live NDA webhook add/change/cancel behavior.
Synthetic tests do not prove Apps Script service or live-sheet behavior. Reconcile
this production-v1-based fetch implementation with the separately parked animal
v1.1 migration before combining releases; do not pull that migration into a scoped
production resilience release unintentionally. No schedule, Script Property, or
schema change is required by this implementation.

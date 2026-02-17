# Subscribe Endpoint (Serverless Stub)

`api/subscribe.js` is a serverless-ready handler stub for `POST /subscribe`.

Expected fields:
- `name`
- `email`
- `consent`
- `website` (honeypot, must be empty)
- `source` (optional page identifier)

Current behavior:
- validates input
- writes to `data/submissions.json` using `lib/subscribeService.js`
- returns JSON success/error response

Production notes:
- replace local JSON persistence with a managed datastore
- add CSRF/rate limiting and audit logging
- keep consent text and privacy policy link aligned with legal requirements

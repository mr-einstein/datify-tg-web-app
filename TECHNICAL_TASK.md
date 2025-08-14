# Technical Task: Direct Registration and Email Verification Flow in Datify Telegram Mini‑App

## 1) Objective
- Move registration and verification logic into the mini‑app.
- Interact directly with Datify admin panel APIs.
- After successful verification, POST a final summary to a single n8n webhook.
- Provide robust UX with validations, retries, and clear user feedback.

## 2) Scope
- Frontend-only implementation inside the Telegram mini-app (`index.html`).
- No server/proxy; calls go directly to `apidev.tcore.team`.
- English-only UX.
- Expose `x-key` client-side (acceptable for now).

## 3) APIs and Headers

### Registration (POST)
- URL: `https://apidev.tcore.team/direct-api/register`
- Headers:
  ```json
  { "Content-Type": "application/json", "x-key": "Eudemian3-Panpsychist4" }
  ```
- Body:
  ```json
  {
    "name": "string",
    "email": "string",
    "password": "string",
    "average_monthly_volume": "1|2|3|4|5",
    "activity_type": "0|1|2|3",
    "expected_traffic_type": "string (omit when Other)",
    "expected_traffic_type_description": "string (only when Other)"
  }
  ```
- Success response:
  ```json
  [ { "publisher_id": 14339 } ]
  ```

### Get token (GET)
- URL: `https://apidev.tcore.team/direct-api/get-user-token/{publisher_id}`
- Headers:
  ```json
  { "x-key": "Eudemian3-Panpsychist4" }
  ```
- Success response:
  ```json
  [ { "token": "...", "publisher_id": 14339 } ]
  ```
- Note: Token expires; fetch on every app open.

### Check verification status (GET)
- URL: `https://apidev.tcore.team/me`
- Headers:
  ```json
  { "Content-Type": "application/json", "authorization": "Bearer {token}" }
  ```
- Consider verified if `status == 2` and `stage_status == 1`.
- Consider unverified if `status == 11` and `stage_status == 7`.

### Verify by code (PATCH)
- URL: `https://apidev.tcore.team/email/verify`
- Headers:
  ```json
  { "Content-Type": "application/json", "x-key": "Eudemian3-Panpsychist4" }
  ```
- Body:
  ```json
  { "random": "{publisher_id}_{code}" }
  ```
- Success response:
  ```json
  [ { "success": 1 } ]
  ```
- Wrong code: returns errors (non-success) — show “Invalid verification code”.

### Final callback to n8n (POST after full verification success)
- URL: `https://n8n.1backteam.com/webhook-test/registration`
- Headers: none special required
- Body: flexible; recommended structure below (Section 10.E)

## 4) Data Model and Local State
- `localStorage` under key: `datify_registration_{tgId or TEST_USER}`.
- Persist:
  - `isRegistered: boolean`
  - `isVerified: boolean`
  - `publisherId: number`
  - `email: string`
  - `registrationPayload: object` (submitted registration payload without password)
  - `registeredAt: ISO string`
  - `verifiedAt: ISO string` (once verified)
- Do NOT persist the token; fetch anew on every app open.

## 5) UX Flow

### A) App Open (Bootstrap)
1. Initialize Telegram WebApp; set `tgId` (fallback to `TEST_USER`).
2. If state has `publisherId`:
   - Fetch fresh token → `GET /me`.
   - If verified: show success and close app.
   - If unverified: show verification screen.
3. If no state: show registration form.

### B) Registration Submit
1. Client-side validations (email, password, confirm, Telegram handle, required selects).
2. Build payload per API spec (include either `expected_traffic_type` or `expected_traffic_type_description`).
3. `POST /direct-api/register` with `x-key`.
4. On success: extract `publisher_id`, save state.
5. Fetch token → `GET /me`:
   - If verified: skip code → finalize success → POST to n8n → close app.
   - If unverified: show verification screen.

### C) Verification (Code Entry)
1. User enters 6-digit code.
2. `PATCH /email/verify` with `random = "{publisher_id}_{code}"` and `x-key`.
3. On success: mark verified; POST to n8n; close app.
4. On failure: show “Invalid verification code. Please try again.”

### D) Already Verified Path
- If `GET /me` indicates verified at any point, skip code entry; mark verified, post to n8n, close app.

## 6) Retry and Resilience
- For Datify API calls (`register`, `get-token`, `me`, `verify`):
  - Up to 3 total attempts (initial + 2 retries).
  - Backoff: 300ms between retries.
  - Retry on network errors or non-2xx, except clear 4xx validation errors.
- For n8n POST: single attempt; if it fails, show a non-blocking warning but do not block success.

## 7) Validation Rules (Frontend)
- Email: standard regex.
- Password: min 8 chars, includes uppercase, lowercase, special char.
- Confirm password matches.
- Telegram username: starts with `@`, 5–32 chars (letters, numbers, underscore).
- Select fields required; “Other” reveals and requires description.

## 8) UI States and Messages
- Registration:
  - Button states: “Submitting…”.
  - Success: “Registration successful! Checking verification status…”.
  - Failure: “Registration failed. Please try again later.”
- Verification:
  - Button state: “Verifying…”.
  - Success: “Email verified successfully! Closing app…”.
  - Wrong code: “Invalid verification code. Please try again.”
  - Resend: dummy message “Verification code has been resent to your email.”
- Already verified on `/me`:
  - “You are already verified! Closing app…”.

## 9) Security Notes
- `x-key` exposed in client (acceptable for now).
- No Telegram `initData` server validation.
- Do not store token in `localStorage`.

## 10) Implementation Details

### A) Helpers
Implement `fetchWithRetry(url, options, attempts = 3, delayMs = 300)` that retries on non-2xx and network errors.

### B) Service Functions
- `register(payload)` → POST `/direct-api/register`.
- `getToken(publisherId)` → GET `/direct-api/get-user-token/{publisherId}`.
- `getMe(token)` → GET `/me`.
- `verifyEmail(publisherId, code)` → PATCH `/email/verify`.
- `postN8nFinal(result)` → POST `https://n8n.1backteam.com/webhook-test/registration`.

### C) State Transitions
- After register: save `publisherId`, `email`, `registrationPayload`, `registeredAt`.
- After verify OR already verified: set `isVerified = true`, `verifiedAt`.

### D) Closing App
- `window.Telegram?.WebApp?.close()` after verified success (with small timeout for UX).

### E) Recommended n8n Final Payload
```json
{
  "publisher_id": 14339,
  "email": "example@domain.com",
  "tgId": "123456",
  "verified": true,
  "verified_at": "2025-08-14T10:00:00.000Z",
  "registered_at": "2025-08-14T09:59:00.000Z",
  "registration_payload": {
    "name": "John Doe",
    "email": "example@domain.com",
    "average_monthly_volume": "3",
    "activity_type": "1",
    "expected_traffic_type": "2",
    "expected_traffic_type_description": null,
    "contact_info": "@username",
    "contact_type": 1,
    "tgId": "123456"
  }
}
```

## 11) Acceptance Criteria
- Registration calls only `POST /direct-api/register` with correct fields and `x-key`.
- `publisher_id` is parsed and persisted in `localStorage` state.
- Token is fetched on every app open when `publisherId` exists.
- Verified detection uses `status == 2 && stage_status == 1`; unverified uses `11/7`.
- Verification by code uses `PATCH /email/verify` with `random="{publisher_id}_{code}"` and `x-key`.
- Retries applied to all Datify API calls (2 retries, 300ms delay).
- After verified, app posts to n8n with the recommended body and then closes Telegram app.
- All error states show clear inline messages; wrong code shows specific prompt.
- No multiple webhook calls remain; previous multi-endpoint logic removed.

## 12) Test Cases
- Happy path: register → unverified → code verify success → n8n POST → close.
- Already verified after register: skip code → n8n POST → close.
- App reopen with state: token + `/me` → verified → close.
- Wrong code: PATCH returns errors → show message → retry works.
- Network flakiness: transient failures recovered by retries.
- n8n failure: verification success but n8n POST fails → show warning → still close.

## 13) Configuration Constants
- `X_KEY = "Eudemian3-Panpsychist4"`
- `N8N_WEBHOOK = "https://n8n.1backteam.com/webhook-test/registration"`
- `RETRIES = 2`
- `RETRY_DELAY_MS = 300`

## 14) Out of Scope (for now)
- Server-side key protection/proxy
- i18n
- Telegram `initData` server validation
- Real resend logic bound to backend

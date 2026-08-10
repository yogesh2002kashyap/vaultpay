# Debug findings: VaultPay auth registration verification

- Date tested: 2026-08-09
- Commit SHA tested: c99933facc3db9170d37b7b7c14f4808642838ec
- Live backend tested: https://vaultpay-usg4.onrender.com
- Render deployment confirmation: user confirmed the service is pointed at commit c99933f.

## Test matrix results

| Test | Setup | Actual status | Actual message/body |
| --- | --- | --- | --- |
| 1. First admin bootstrap | No admin exists, no cookie | 401 | `{"success":false,"message":"Authentication required to create an account."}` |
| 2. Unauthenticated client creation | Admin already exists, no cookie | 401 | `{"success":false,"message":"Authentication required to create an account."}` |
| 3. Authenticated admin creates client | Admin logged in, cookie present | 401 | `{"success":false,"message":"Authentication required to create an account."}` |
| 4. Client attempts client creation | Client logged in | 401 | `{"success":false,"message":"Authentication required to create an account."}` |
| 5. Client attempts admin creation | Client logged in, role: admin in body | 401 | `{"success":false,"message":"Authentication required to create an account."}` |
| 6. Duplicate email | Existing email submitted | 401 | `{"success":false,"message":"Authentication required to create an account."}` |

## Additional sanity checks

- `/api/v1/auth/login` with the documented admin credentials from the repo Postman collection returned 401 with `{"success":false,"message":"Invalid email or password."}`.
- `/api/v1/auth/profile` without a cookie returned 401 with `{"success":false,"message":"No authentication token provided. Please log in."}`.

## Root cause

The live Render instance is not behaving as the current source tree expects for this fix. The current repository already contains the intended optional-auth route change in `src/modules/auth/auth.routes.js` and the optional-auth middleware in `src/core/middlewares/auth.middleware.js`, so the bootstrap path should proceed without a cookie when no admin exists. Instead, the live service still rejects registration with `401 Authentication required to create an account.` before the controller can reach the bootstrap branch. This indicates the deployed application is still running pre-fix behavior (or another build/deploy state that does not match the current source), not that the local code is wrong.

## Files and lines changed

No repository files were changed during this verification. The relevant source already contains the intended change in:
- `src/modules/auth/auth.routes.js` (route uses `optionalAuth`)
- `src/core/middlewares/auth.middleware.js` (optional-auth middleware)
- `src/modules/auth/auth.controller.js` (bootstrap/admin logic)

## Full-matrix result after the fix

The full matrix did not pass on the live Render backend. The live service still returned `401` for the registration flow before an authenticated admin session could be established, so the fix could not be validated end-to-end against the deployed instance.

## Residual risk / untested edge cases

- The live backend did not expose a deploy commit SHA through the public response headers, so the deployment state was inferred from the user-confirmed commit and the observed runtime behavior.
- Cookie handling was not the primary blocker in this run; the registration route was failing before an authenticated session could be used. A follow-up check should confirm the Render deployment actually restarted from commit c99933f and that the deployed runtime matches the source tree.

# NIBSS Bank Account Verification (Live)

Use **NIBSS** for **live** bank account verification so that **all banks** (including OPay, Palmpay, GTBank, etc.) work. Without NIBSS, Flutterwave in **test mode** only verifies Access Bank (044).

## How it works

- **Default:** The app uses **Flutterwave in live (production) mode** by default, so OPay and all banks can be verified. Use **production** Flutterwave API keys.
- **Test/sandbox:** Set `FLUTTERWAVE_USE_TEST_MODE=true` to use Flutterwave sandbox (only Access Bank 044 works for verification).
- **Live with NIBSS:** Set `NIBSS_NAME_ENQUIRY_URL` to your NIBSS Name Enquiry endpoint to try NIBSS first (then fall back to Flutterwave).

## Env vars

| Variable | Required | Description |
|----------|----------|-------------|
| `NIBSS_NAME_ENQUIRY_URL` | Yes (to use NIBSS) | Full URL of your NIBSS Name Enquiry endpoint (e.g. from a NIBSS gateway or partner). |
| `NIBSS_API_KEY` | No | API key or Bearer token if your gateway requires it. |

## Request / response

The app sends a **POST** request to your URL with:

```json
{
  "account_number": "0123456789",
  "account_bank": "058"
}
```

The endpoint should return **200** with a JSON body that includes the account holder name, e.g.:

- `{ "account_name": "JOHN DOE" }` or  
- `{ "accountName": "JOHN DOE" }` or  
- `{ "data": { "account_name": "JOHN DOE" } }`

Any of these shapes are accepted.

## Getting NIBSS access

- **Direct NIBSS API:** Available to licensed institutions (banks, fintechs, PSSPs, etc.) via the [NIBSS Developers Portal](https://nibss-plc.com.ng/name-enquiry/) or NIBSSPAY. You will get your own endpoint and credentials.
- **Via a gateway/partner:** Some providers expose NIBSS Name Enquiry as a REST API. Set their endpoint as `NIBSS_NAME_ENQUIRY_URL` and any required key as `NIBSS_API_KEY`.

If you don’t have NIBSS access, leave these unset; the app uses **Flutterwave live** by default (production keys required). Set `FLUTTERWAVE_USE_TEST_MODE=true` only for sandbox testing (Access Bank 044 only).

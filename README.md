# Bills API

An Express API that parses Pakistani electricity and SNGPL bill pages. It supports two input paths while using the same parser code:

1. `GET /api/bill/:reference` fetches the provider page directly. This is useful for local testing from a Pakistani IP.
2. `POST /api/bills/parse` accepts HTML fetched by the mobile app. This is the production path when Vercel cannot reach a Pakistan-only provider endpoint.

## Setup

```bash
npm install
npm test
npm start
```

The API listens on `http://localhost:6000` unless `PORT` is set.

To test a real provider response without making another network request, save it as an HTML file and run:

```bash
npm run parse -- --type electricity --ref 01262130009696 --company PESCO --file ./bill.html
```

For SNGPL HTML, `--ref` can be omitted when the account number is present in the page.

## Parse app-fetched HTML

Send plain HTML for development:

```http
POST /api/bills/parse
Content-Type: application/json

{
  "type": "electricity",
  "reference": "01262130009696",
  "company": "PESCO",
  "html": "<html>...</html>"
}
```

For production, send the same HTML as base64-encoded zlib data in the `data` property. The old `/api/elecbill`, `/api/lescobill`, and `/api/sngplbill` routes remain as compatibility aliases.

Add `?res=bill` to a fetch or parse request to receive the prepared bill HTML instead of JSON.

Electricity responses include `bill_period`, `bill_year`, `issue_date`, `amount_paid`, `payment_date`, consumer/category metadata and meter readings. When a reference is extracted from submitted HTML, it must match the requested reference. A missing reference is flagged in `parsing.warnings`; it is not considered verified.

## Resilience to provider changes

Both input paths still use one parser per utility type. Fields are extracted independently from English labels, nearby values, table headings, known layout selectors and (for electricity) embedded charge text. CSS class renames, common wrapper changes, reordered labeled dates, and reordered history columns are covered by offline mutation tests. Unrecognized labels or a completely new bill format may still require an adapter update.

Every JSON response includes `parsing`:

```json
{
  "version": 2,
  "status": "partial",
  "sources": { "currentBill": ["label", "charge_summary"] },
  "warnings": [{ "field": "dueDate", "code": "MISSING_FIELD" }]
}
```

- `status` is `complete` or `partial`; warnings name fields without exposing customer data. Source keys use internal camelCase field names.
- Missing or conflicting optional scalar fields return `null`. The app must treat `paid: null` as unknown, and must not display missing units or taxes as zero. A recorded positive payment covering the payable supports `paid: true`; an absent badge does not establish nonpayment.
- Name, bill period and payable amount are required. Missing/invalid core values return HTTP 422 `INCOMPLETE_BILL`; conflicting valid core values or references return HTTP 422 `AMBIGUOUS_BILL`. A single extracted reference differing from the request returns HTTP 400 `REFERENCE_MISMATCH`.
- `current_bill` means payable within the due date. The current-month subtotal remains `charges.billing.current_month_bill`; these are never substituted for one another.
- Dates are calendar-validated. Unlabeled date positions are not used to guess whether a date is the reading or issue date.
- Identical history copies are deduplicated. Conflicting months retain their period with unknown values, preventing unreliable protection countdowns. Savings require reconciled slab quantities and charges.
- Gas account detection uses labeled/known account fields, never the first number anywhere on the page. Supply `reference` if the HTML does not expose an identifiable account field.

Run `npm test` to exercise normal bills, layout mutations, malformed components, conflicting values, and the plain/compressed HTTP paths. For a new provider format, save a sanitized HTML fixture (remove names, addresses and account numbers), add a regression test in `test/`, and update labels or the relevant layout adapter. Review `parsing.warnings` in the client to detect lost optional fields before relying on their insights.

## Detailed electricity insights

Both direct fetching and submitted HTML use the same extraction and analysis code. No additional provider requests are needed to calculate insights. Detail is extracted from the current PITC layout and its charge QR text; older layouts can return unavailable (`null`) insights.

| Field | Contents |
| --- | --- |
| `charges.billing` | Gross electricity charges, subsidy, net charges, current-month bill, arrears, credits, FPA and grand total as printed |
| `charges.energy` | Variable and fixed charges, rent, financing surcharge, quarterly adjustment, FPA energy and verified tariff slabs |
| `charges.taxes` | Current-bill taxes and FPA taxes separately, detailed codes, amounts, component totals and reconciliation differences |
| `bill_history` | Chronological month, units, bill amount, payment amount and provider status; missing values are `null`, zero stays zero |
| `insights.cost_per_unit` | Energy-only average, current-bill average, all-in payable average, fixed charges per unit and marginal billed energy rate |
| `insights.consumption` | Monthly/yearly comparisons, observed average, peak/lowest usage, totals and months over 200 units |
| `insights.protection` | Provider classification, consecutive-month evidence, tariff applicability and conditional qualification estimate |
| `insights.savings` | Usage/payment suggestions and 10%/20% energy-saving scenarios based on the verified bill slabs |
| `insights.reconciliation` | Calculated component totals versus the provider's rounded summary |

Amounts in these new objects are numeric PKR; existing `current_bill` and `past_data` keep their previous formats. `after_due_bill` is removed from both electricity and gas JSON. `late_payment_schedule` is also removed. The provider's original late-payment information remains on the full HTML bill.

Protection status comes from the bill's category, never from low usage alone. Planning estimates assume domestic non-TOU service below 5 kW and at most 200 kWh per month for six consecutive months. The current bill counts as the most recent completed bill; a first-protected-bill estimate is the following bill after the six-month window. Missing or conflicting months return no countdown. Unknown/lifeline/non-domestic categories are not silently treated as protected or unprotected. Actual classification is determined by the utility, and pro-rata/carry-forward readings can change eligibility.

Sources for tariff/pro-rata context: [NEPRA PESCO tariff index](https://nepra.org.pk/tariff/Distribution%20PESCO.php), [official utility tariff guide](https://www.iesco.com.pk/tariff-guide), and [consumer service manual](https://www.iesco.com.pk/storage/CSM.pdf). The current 200-unit tariff bands and pro-rata guidance were checked; the six-month eligibility definition still needs confirmation against the latest notification. This limitation is exposed in `insights.protection.rule_verification`. Protection dates are conditional planning estimates, not a utility eligibility decision. Rules should be reviewed when notifications change.

The effective payable-per-unit value includes taxes, fixed charges and adjustments; it must not be presented as the energy tariff or used directly to calculate savings. Savings scenarios hold current energy slabs/status constant and exclude changes in taxes, fixed charges, FPA and quarterly adjustments. Historical payments may settle other months, so bill-minus-payment history is not an outstanding balance.

## Detailed SNGPL insights

Gas uses the same direct-fetch and app-HTML routes. `current_bill` remains the payable within the due date; `charges.billing.current_month_bill` is the cost of this billing period before carried arrears/credit. `after_due_bill` remains absent.

| Field | Contents |
| --- | --- |
| `bill_period`, `bill_year`, `tariff`, `category`, `issue_date` | Billing period and provider tariff classification (DOMP-G protected, DOMU-G unprotected; unfamiliar tariffs stay unknown) |
| `meter` | Current/previous reading dates and readings, printed difference, MMBTU, GCV, pressure and pressure factor |
| `charges.billing` | Gas cost, provisional adjustment, meter rent, fixed charges, GST, rebate, security deposit, current-month cost, arrears/credit and payable |
| `charges.tariff_schedule` | Slab thresholds, prices per MMBTU and effective date read from this bill, not hardcoded prices |
| `bill_history` | Chronological HM3, current-month charge, amount due and payment; nested/reordered tables and duplicate copies supported |
| `insights.cost_per_unit` | Gas-only averages per HM3/MMBTU, current-cost versus payable averages, fixed/rent share |
| `insights.consumption` | Reading-period length, daily/30-day usage where the bill supplies that basis, monthly/yearly comparisons and history summary |
| `insights.protection` | Provider status, four-winter-month evidence, average and next winter planning window |
| `insights.reconciliation` | Charge totals, carried balances, payable difference, observed GST ratio, inferred base fixed charges/rent and MMBTU conversion check |
| `insights.savings` | Credit/budgeting guidance, winter targets, conservation suggestions and 10%/20% volume-reduction scenarios |

For the live August 2026 layout, the reading period was 32 days. The parser correctly distinguishes `0.513 HM3` consumption from `1046` GCV; the previous positional selector confused these fields. Printed monthly charges of Rs 3,441.33 and a carried credit of Rs 3,363.68 produce a balance of Rs 77.65 versus a printed payable of Rs 80. The Rs 2.35 difference is exposed, not silently discarded or assumed to be rounding. Prorating the billed Rs 1,600 fixed charge and Rs 42.67 rent to 30 days gives inferred bases of Rs 1,500 and Rs 40.

Gas protection uses the November–February average, not the electricity six-month rule. The published OGRA domestic definition uses at most 0.9 HM3 on average across those four winter months. The code reports the bill's tariff status independently of the historical check and never promises a reclassification month. Its next-winter window is anchored to the bill period. Missing/conflicting winter evidence returns unknown, and non-domestic/unrecognized tariff codes receive no eligibility verdict.

Rule references: [official domestic tariff effective July 2025](https://www.ssgc.com.pk/web/?page_id=103), and [SNGPL's published 2023 notification](https://www.sngpl.com.pk/download/gas_sale_price_notification_effective_november_08_2023.pdf). These sources describe the winter-average test; the bill supplies its own rate table. Review the rule when notifications change. The API deliberately leaves `estimated_first_protected_bill_period` and currency-saving estimates `null` when it cannot establish them.

The regression fixture in `test/fixtures/sngpl-aug-2026.html` retains the live table structure and amounts with customer identifiers replaced. The original fetched bill stays in ignored `tmp/`. Tests cover missing fields, wrong GCV, conflicts, duplicate history, seasonal boundaries and identical results through plain/compressed HTTP input.

## Project layout

```text
src/
  config/       provider lookup
  controllers/  HTTP request and response handling
  middleware/   API error responses
  parsers/      the shared electricity and gas scraping code
  routes/       endpoint definitions
  scrapers/     direct provider HTTP requests
  services/     fetch/parse orchestration
  utils/        compression and date helpers
test/           offline parser tests
```

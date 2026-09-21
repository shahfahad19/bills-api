const assert = require('node:assert/strict');
const test = require('node:test');
const cheerio = require('cheerio');
const { extractCharges, extractHistory } = require('../src/parsers/electricity-details');
const { buildInsights, protectionInsight } = require('../src/services/electricity-insights');
const { parseBill } = require('../src/services/bills.service');

// Charge figures and structure verified against PESCO in September 2026.
// No names, addresses, account numbers or QR consumer details are retained.
const detailHtml = `<textarea id="charges_qr_text_1">
----- ENERGY DETAILS = 2463.45 -----
UNITS: 157
VARIABLE CHRG: 1795.57
FIXED CHRG: 600
METER RENT: 0
SERVICE RENT: 0
FPA ENERGY: 261.38
F.C. SUR: 67.51
QTA: -261.01
----- TAXES = 424.02 -----
ED: 23.02
TV FEE: 0
GST: 401
ITAX: 0
----- TAXES ON FPA = 50.92 -----
IT: 0
ED: 3.92
STAX: 0
FTAX: 0
ETAX: 0
GST: 47
ASTAX :0
RSTAX :0
STAX :0
----- BILL CALC -----
10.5400 X 100
13.0100 X 57
300 X 2
</textarea>
<div class="charges-bd-row"><span class="charges-bd-en">Current Bill</span><span class="charges-bd-val">2626</span></div>
<div class="charges-bd-row"><span class="charges-bd-en">Taxes</span><span class="charges-bd-val">424</span></div>`;

const data = { billPeriod: 'SEP 26', units: '157', currentBill: '2938', category: 'Protected',
    tariffCategory: 'Domestic', sanctionedLoad: '2', tariff: 'A-1A(01)', paid: true,
    meterStatus: 'Pro-Rata Consumption Outstanding Units : 25' };
const history = [33,60,80,76,127,72].map((units,i) => ({
    month: ['Mar26','Apr26','May26','Jun26','Jul26','Aug26'][i],
    period: `2026-${String(i+3).padStart(2,'0')}`, units, bill_amount: 1000, payment_amount: 1000,
}));

test('QR breakdown separates FPA taxes, negative adjustments and fixed-charge calculations', () => {
    const result = extractCharges(cheerio.load(detailHtml));
    assert.equal(result.energy.variable_charges, 1795.57);
    assert.equal(result.energy.quarterly_adjustment, -261.01);
    assert.equal(result.energy.slabs_verified, true);
    assert.equal(result.energy.slabs.length, 2);
    assert.equal(result.energy.slabs[1].rate_per_kwh, 13.01);
    assert.equal(result.energy.calculations.length, 3);
    assert.equal(result.taxes.current.reported_total, 424.02);
    assert.equal(result.taxes.current.component_total, 424.02);
    assert.equal(result.taxes.fuel_adjustment.component_total, 50.92);
    assert.equal(result.taxes.combined_total, 474.94);
    assert.equal(result.taxes.fuel_adjustment.items.filter(row=>row.code === 'STAX').length, 1);
});

test('history keeps blank values distinct from zero and retains payments and status', () => {
    const $ = cheerio.load(`<div class="history-row"><div class="history-cell">Dec25</div><div class="history-cell"><span class="history-status-pill">EX</span></div><div class="history-cell">47</div><div class="history-cell">620</div><div class="history-cell">0</div></div>
    <div class="history-row"><div class="history-cell">Jan26</div><div class="history-cell"></div><div class="history-cell"></div><div class="history-cell">0</div><div class="history-cell"></div></div>`);
    const result = extractHistory($);
    assert.equal(result[0].status, 'EX');
    assert.equal(result[0].payment_amount, 0);
    assert.equal(result[1].units, null);
    assert.equal(result[1].payment_amount, null);
});

test('costs and savings use actual slab rates and distinguish all-in payable', () => {
    const result = buildInsights(data, extractCharges(cheerio.load(detailHtml)), history);
    assert.equal(result.cost_per_unit.average_energy_only, 11.44);
    assert.equal(result.cost_per_unit.effective_payable, 18.71);
    assert.equal(result.savings.scenarios[0].estimated_energy_charge_saving, 204.26);
    assert.equal(result.reconciliation.current_bill_from_components, 2626.09);
    assert.equal(result.reconciliation.current_bill_rounding_difference, -0.09);
    assert.equal(result.protection.status, 'protected');
    assert.equal(result.protection.additional_qualifying_bills_needed, 0);
    assert.equal(result.protection.billed_units_below_limit, 43);
    assert.equal(result.protection.pro_rata, true);
});

test('unprotected countdown requires consecutive eligible months and handles year rollover', () => {
    const rows = [{month:'Aug26',units:250}];
    const result = protectionInsight({...data,category:'Un-Protected'}, rows, 200);
    assert.equal(result.status, 'unprotected');
    assert.equal(result.observed_qualifying_months, 1);
    assert.equal(result.additional_qualifying_bills_needed, 5);
    assert.equal(result.estimated_qualification_period, '2027-02');
    assert.equal(result.estimated_first_protected_bill_period, '2027-03');
});

test('missing months, duplicate months, non-domestic tariffs and unknown categories do not produce false countdowns', () => {
    for (const rows of [[], history.filter(row=>row.month!=='Aug26'), [...history, history.at(-1)]]) {
        assert.equal(protectionInsight({...data, category:'Unprotected'},rows,157).additional_qualifying_bills_needed,null);
    }
    assert.equal(protectionInsight({...data,category:'Unprotected',tariffCategory:'Commercial',tariff:'A-2'},history,157).additional_qualifying_bills_needed,null);
    assert.equal(protectionInsight({...data,category:'Unprotected',sanctionedLoad:'5'},history,157).additional_qualifying_bills_needed,null);
    assert.equal(protectionInsight({...data,category:'Unprotected',tariff:'A-1b TOU'},history,157).additional_qualifying_bills_needed,null);
    assert.equal(protectionInsight({...data,category:''},history,157).status,'unknown');
    assert.equal(protectionInsight({...data,category:'Unprotected'},history,201).additional_qualifying_bills_needed,6);
    assert.equal(protectionInsight({...data,category:'Unprotected'},history,200).additional_qualifying_bills_needed,0);
});

test('unverified slab calculations do not produce savings estimates', () => {
    const charges = extractCharges(cheerio.load(detailHtml.replace('13.0100 X 57','13.0100 X 50')));
    assert.equal(charges.energy.slabs_verified,false);
    assert.deepEqual(buildInsights(data,charges,history).savings.scenarios,[]);
});

test('missing financial detail returns unknown costs, not fabricated zero amounts or savings', () => {
    const charges = extractCharges(cheerio.load('<html></html>'));
    const result = buildInsights({...data,units:'0'},charges,[]);
    assert.equal(charges.taxes.combined_total,null);
    assert.equal(result.cost_per_unit.effective_payable,null);
    assert.equal(result.savings.scenarios.length,0);
});

test('shared parser exposes detailed fields and removes late-payment fields', async () => {
    const html = `<html><body><div class="right-main-val">SEP 2026</div>
    <div class="label-row"><span class="en-lbl">NAME & ADDRESS</span></div><div class="val-space">Test Consumer</div>
    <div class="label-row"><span class="en-lbl">UNITS</span></div><div class="val-space">157</div>
    <div class="payable-card-amount">2938</div>${detailHtml}</body></html>`;
    const bill = await parseBill({type:'electricity',reference:'03260000000000',html});
    assert.equal(bill.bill_year,2026);
    assert.equal(bill.charges.taxes.combined_total,474.94);
    assert.equal(bill.insights.cost_per_unit.effective_payable,18.71);
    assert.equal(Object.hasOwn(bill,'after_due_bill'),false);
    assert.equal(Object.hasOwn(bill,'late_payment_schedule'),false);
});

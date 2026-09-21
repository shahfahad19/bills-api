const test = require('node:test');
const assert = require('node:assert/strict');
const cheerio = require('cheerio');
const { parseElectricityBill } = require('../src/parsers/electricity.parser');
const { parseGasBill, extractGasReference } = require('../src/parsers/gas.parser');
const { extractHistory, extractCharges } = require('../src/parsers/electricity-details');
const { parseProviderDate } = require('../src/utils/dates');
const { compressHtml } = require('../src/utils/compression');
const { createApp } = require('../src/app');
const { protectionInsight } = require('../src/services/electricity-insights');

const reference = '03260000000000';
const row = (label, value) => `<section class="field"><div class="label-row"><span class="en-lbl">${label}</span><span>بل</span></div><div class="val-space">${value}</div></section>`;
const fixture = `<html><body>
${row('NAME & ADDRESS', 'Test Consumer, Test Address')}
${row('REFERENCE NO', reference)}
${row('UNITS', '157')}
${row('CATEGORY', 'Protected')}
${row('TARIFF CATEGORY', 'Domestic')}
${row('TARIFF', 'A-1A(01)')}
${row('SAN LOAD', '2')}
<section><span>BILL MONTH</span><div class="right-main-val">September 2026</div></section>
<section><span>DUE DATE</span><div class="right-main-val right-main-val--due">23-SEP-26</div></section>
<section><span>PAYABLE WITHIN DUE DATE</span><div class="payable-card-amount">2,938</div></section>
<section><span>ISSUE DATE</span><div class="right-panel-date-val">09-09-2026</div></section>
<section><span>READING DATE (Pro-Rata)</span><div class="right-panel-date-val">05-09-2026</div></section>
<div class="charges-bd-row"><span class="charges-bd-en">Current Bill</span><span class="charges-bd-val">2626</span></div>
<div class="charges-bd-row"><span class="charges-bd-en">Grand Total</span><span class="charges-bd-val">2938</span></div>
<textarea>----- CONSUMER DETAILS -----
REF NO: ${reference}
OLD REF: 03261111111111
----- ENERGY DETAILS = 2463.45 -----
UNITS: 157
VARIABLE CHRG: 1795.57
FIXED CHRG: 600
----- TAXES = 424.02 -----
ED: 23.02
GST: 401
----- BILL CALC -----
10.54 X 100
13.01 X 57
</textarea>
<div class="history-block">
<div class="history-header-row"><div>Month</div><div>Status</div><div>Units</div><div>Bill (Rs.)</div><div>Payment (Rs.)</div></div>
<div class="history-row"><div class="history-cell">Aug26</div><div class="history-cell">EX</div><div class="history-cell">72</div><div class="history-cell">1315</div><div class="history-cell">0</div></div>
</div></body></html>`;
const parse = html => parseElectricityBill({ html, reference, company: 'PESCO' });

test('renamed/removed classes and inserted wrappers preserve bill values and insights', async () => {
    const baseline = await parse(fixture);
    const mutations = [
        fixture.replace(/class="[^"]*"/g, ''),
        fixture.replace(/class="([^"]*)"/g, (_,value) => `class="v2-${value.replace(/ /g,' v2-')}"`),
        fixture.replace(/<span class="en-lbl">([^<]+)<\/span>/g, '<span class="en-lbl"><strong>$1</strong></span>'),
        fixture.replace(/>UNITS</g, '>  units : <').replace(/>BILL MONTH</g, '> Billing Month <'),
        fixture.replace(/<textarea>/, '<pre>').replace(/<\/textarea>/, '</pre>'),
    ];
    for (const html of mutations) {
        const result = await parse(html);
        for (const key of ['bill_name','units','bill_month','bill_year','current_bill','due_date','reading_date','issue_date','category']) {
            assert.equal(result[key], baseline[key], key);
        }
        assert.deepEqual(result.bill_history, baseline.bill_history);
        assert.deepEqual(result.charges, baseline.charges);
        assert.deepEqual(result.insights, baseline.insights);
    }
    assert.equal(baseline.reading_date, '5 September 2026');
    assert.equal(baseline.issue_date, '9 September 2026');
});

test('table headings map reordered bill fields without CSS selectors', async () => {
    const bill = await parse(`<table>
    <tr><th>Due Date</th><th>Bill Month</th><th>Reference No</th><th>Units</th></tr>
    <tr><td>23/09/2026</td><td>Sep-26</td><td>${reference}</td><td>157</td></tr></table>
    <dl><dt>Name &amp; Address</dt><dd>Test Consumer</dd><dt>Amount Payable</dt><dd>2938</dd></dl>`);
    assert.equal(bill.current_bill,'2938');
    assert.equal(bill.units,'157 Units');
    assert.equal(bill.bill_year,2026);
    assert.equal(bill.due_date,'23 September 2026');
});

test('reordered history columns and identical printed copies do not double totals', () => {
    const table = `<table><tr><th>Payment (Rs.)</th><th>Units</th><th>Month</th><th>Bill (Rs.)</th></tr>
    <tr><td>0</td><td>72</td><td>Aug26</td><td>1315</td></tr>
    <tr><td></td><td>0</td><td>Jul26</td><td>0</td></tr></table>`;
    const result = extractHistory(cheerio.load(table+table));
    assert.equal(result.length,2);
    assert.deepEqual(result[1],{month:'Aug26',period:'2026-08',status:null,units:72,bill_amount:1315,payment_amount:0});
    assert.equal(result[0].units,0);
    assert.equal(result[0].payment_amount,null);
});

test('conflicting history is unavailable and disables a protection countdown', () => {
    const warnings = [];
    const html = `<table><tr><th>Month</th><th>Units</th></tr><tr><td>Aug26</td><td>72</td></tr><tr><td>Aug26</td><td>300</td></tr></table>`;
    const rows = extractHistory(cheerio.load(html),(field,code)=>warnings.push(code));
    assert.equal(rows[0].units,null);
    assert.ok(warnings.includes('CONFLICTING_HISTORY'));
    assert.equal(protectionInsight({billPeriod:'Sep26',category:'Unprotected',tariff:'A-1A',sanctionedLoad:'2'}, rows,157).additional_qualifying_bills_needed,null);
});

test('missing optional fields return null and diagnostics without inventing savings', async () => {
    const html = `<dl><dt>Name</dt><dd>Test Consumer</dd><dt>Bill Month</dt><dd>Sep26</dd><dt>Amount Payable</dt><dd>2938</dd></dl>`;
    const bill = await parse(html);
    assert.equal(bill.units,null);
    assert.equal(bill.due_date,null);
    assert.equal(bill.paid,null);
    assert.equal(bill.parsing.status,'partial');
    assert.ok(bill.parsing.warnings.some(w=>w.field === 'units' && w.code === 'MISSING_FIELD'));
    assert.equal(bill.insights.cost_per_unit.effective_payable,null);
    assert.deepEqual(bill.insights.savings.scenarios,[]);
    assert.equal(bill.insights.protection.additional_qualifying_bills_needed,null);
});

test('missing, conflicting and invalid core data fails safely', async () => {
    await assert.rejects(parse('<html><body>Access denied</body></html>'),{code:'INCOMPLETE_BILL'});
    await assert.rejects(parse(fixture.replace('>2,938<','>8,888<')),{code:'AMBIGUOUS_BILL'});
    await assert.rejects(parse(fixture.replace('</body>','<div class="payable-card-amount">8888</div></body>')),{code:'AMBIGUOUS_BILL'});
    await assert.rejects(parse(fixture.replace(`REF NO: ${reference}`,'REF NO: 03269999999999')),{code:'AMBIGUOUS_BILL'});
    await assert.rejects(parse(fixture.replace('September 2026','Not a month')),{code:'INCOMPLETE_BILL'});
    const invalidDate = await parse(fixture.replace('23-SEP-26','31-SEP-26'));
    assert.equal(invalidDate.due_date,null);
    assert.ok(invalidDate.parsing.warnings.some(w=>w.field === 'dueDate' && w.code === 'INVALID_VALUE'));
});

test('conflicting consumption suppresses dependent costs and savings', async () => {
    const bill = await parse(fixture.replace('UNITS: 157','UNITS: 200'));
    assert.equal(bill.units,null);
    assert.equal(bill.insights.cost_per_unit.effective_payable,null);
    assert.deepEqual(bill.insights.savings.scenarios,[]);
});

test('QR heading case/spacing changes preserve financial amounts', () => {
    const result = extractCharges(cheerio.load(fixture.replace('ENERGY DETAILS','energy   details').replace('VARIABLE CHRG','variable   chrg').replace('TAXES =','taxes =')));
    assert.equal(result.energy.variable_charges,1795.57);
    assert.equal(result.taxes.current.reported_total,424.02);
});

test('malformed and contradictory charge components never become valid totals or slabs', () => {
    const malformed = extractCharges(cheerio.load(fixture.replace('GST: 401','GST: 401oops')));
    assert.equal(malformed.taxes.current.component_total,null);
    const warnings = [];
    const conflicts = extractCharges(cheerio.load(fixture.replace('VARIABLE CHRG: 1795.57',
        'VARIABLE CHRG: 1795.57\nVARIABLE CHRG: 5000')),undefined,(field,code)=>warnings.push(code));
    assert.equal(conflicts.energy.variable_charges,null);
    assert.equal(conflicts.energy.slabs_verified,false);
    assert.ok(warnings.includes('CONFLICTING_ENERGY_COMPONENT'));
});

test('provider dates validate day/month/year without rolling into another month', () => {
    assert.equal(parseProviderDate('31-02-2026'),null);
    assert.equal(parseProviderDate('29-02-2025'),null);
    assert.equal(parseProviderDate('05-99-2026'),null);
    assert.equal(parseProviderDate('29-02-2024').toISOString(),'2024-02-29T00:00:00.000Z');
});

test('gas uses semantic labels and never treats an arbitrary phone number as account ID', () => {
    const html = `<dl><dt>Consumer Name</dt><dd>Test Consumer 03001234567</dd>
    <dt>Account ID</dt><dd>12345678901</dd><dt>Bill Month</dt><dd>Sep26</dd>
    <dt>Within Due Date</dt><dd>4100</dd><dt>Due Date</dt><dd>23-09-26</dd>
    <dt>Consumption (HM3)</dt><dd>.694</dd></dl>`;
    const bill = parseGasBill({html,reference:'12345678901'});
    assert.equal(bill.current_bill,'4100');
    assert.equal(bill.units,'0.694 HM3');
    assert.equal(extractGasReference(html),'12345678901');
    assert.equal(extractGasReference('<p>Helpline: 03001234567</p>'),null);
    assert.throws(()=>parseGasBill({html:html+'<p>Amount Payable: 6000</p>',reference:'12345678901'}),{code:'AMBIGUOUS_BILL'});
});

test('API returns the same diagnostics for plain/compressed HTML and controlled 422 for changed layouts', async t => {
    const server = createApp().listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    t.after(()=>server.close());
    const post = async input => {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/bills/parse`,{
            method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'electricity',reference,...input})});
        return {status:response.status,body:await response.json()};
    };
    const plain = await post({html:fixture});
    const compressed = await post({data:compressHtml(fixture)});
    assert.equal(plain.status,200);
    assert.equal(compressed.status,200);
    assert.deepEqual(plain.body.parsing,compressed.body.parsing);
    assert.equal((await post({html:'<h1>Provider changed</h1>'})).status,422);
});

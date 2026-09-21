const assert = require('node:assert/strict');
const test = require('node:test');
const { parseElectricityBill } = require('../src/parsers/electricity.parser');
const { parseGasBill } = require('../src/parsers/gas.parser');
const { compressHtml, decompressHtml } = require('../src/utils/compression');
const { validateReference } = require('../src/services/bills.service');
const { createApp } = require('../src/app');

test('compression round-trips provider HTML', () => {
    const html = '<html><body>utility bill</body></html>';
    assert.equal(decompressHtml(compressHtml(html)), html);
});

test('reference validation detects bill type', () => {
    assert.equal(validateReference('12345678901').type, 'gas');
    assert.equal(validateReference('01262130009696').type, 'electricity');
    assert.throws(() => validateReference('123'), /Reference number is invalid/);
});

test('electricity HTML is parsed by the shared parser', async () => {
    const html = `<!doctype html><html><head></head><body>
        <div class="tab-content active"><div id="maincontent-1">
            <div class="right-main-val">Sep 26</div>
            <div class="right-main-val right-main-val--due">30-09-2026</div>
            <div class="payable-card-amount">12,345</div>
            <div class="lp-surcharge-bottom-block">Till 05-OCT-26 <div class="lp-surcharge-bottom-val">12,700</div></div>
            <div class="lp-surcharge-bottom-block">After 05-OCT-26 <div class="lp-surcharge-bottom-val">13,000</div></div>
            <div class="payable-card-paid">
                <div class="payable-card-paid-row"><span class="payable-card-paid-label">Amount Paid</span><span class="payable-card-paid-val">12,345</span></div>
                <div class="payable-card-paid-row"><span class="payable-card-paid-label">Payment Date</span><span class="payable-card-paid-val">20-SEP-26</span></div>
            </div>
            <div class="label-row"><span class="en-lbl">REFERENCE NO</span></div><div class="val-space">01262130009696</div>
            <div class="label-row"><span class="en-lbl">NAME & ADDRESS</span></div>
            <div class="val-space">ALI KHAN, PESHAWAR</div>
            <div class="right-panel-date-val">01-09-2026</div>
            <div class="right-panel-date-val">05-09-2026</div>
            <textarea>UNITS: 250</textarea>
        </div></div>
    </body></html>`;

    const bill = await parseElectricityBill({
        html,
        reference: '01262130009696',
        company: 'PESCO',
    });

    assert.equal(bill.company, 'PESCO');
    assert.equal(bill.bill_name, 'ALI KHAN');
    assert.equal(bill.units, '250 Units');
    assert.equal(bill.current_bill, '12345');
    assert.equal(Object.hasOwn(bill, 'after_due_bill'), false);
    assert.equal(Object.hasOwn(bill, 'late_payment_schedule'), false);
    assert.equal(bill.bill_month, 'September');
    assert.equal(bill.bill_year, 2026);
    assert.equal(bill.paid, true);
    assert.equal(bill.amount_paid, '12345');
    assert.equal(bill.payment_date, '20 September 2026');
    assert.ok(decompressHtml(bill.bill_data).includes('ALI KHAN'));

    await assert.rejects(
        () => parseElectricityBill({ html, reference: '01262130009697', company: 'PESCO' }),
        error => error.code === 'REFERENCE_MISMATCH'
    );
});

test('gas HTML is parsed by the shared parser', () => {
    const html = `<!doctype html><html><body>
        <span data-bill-field="name">FATIMA</span>
        <span data-bill-field="units">1.25</span>
        <span data-bill-field="bill-month">Sep 2026</span>
        <span data-bill-field="reading-date">01-09-2026</span>
        <span data-bill-field="current-bill">4,100</span>
        <span data-bill-field="after-due-bill">4,500</span>
        <span data-bill-field="due-date">30-09-2026</span>
        <script>alert('untrusted')</script>
    </body></html>`;

    const bill = parseGasBill({ html, reference: '12345678901' });
    assert.equal(bill.company, 'SNGPL');
    assert.equal(Object.hasOwn(bill, 'after_due_bill'), false);
    assert.equal(bill.bill_name, 'FATIMA');
    assert.equal(bill.units, '1.25 HM3');
    assert.equal(bill.current_bill, '4100');
    assert.equal(bill.bill_month, 'September');
    assert.equal(decompressHtml(bill.bill_data).includes('<script>'), false);
});

test('parse endpoint accepts compressed app HTML', async t => {
    const app = createApp();
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => server.close());

    const html = `<!doctype html><html><body>
        <span data-bill-field="name">FATIMA 12345678901</span>
        <dl><dt>Account ID</dt><dd>12345678901</dd></dl>
        <span data-bill-field="units">1.25</span>
        <span data-bill-field="bill-month">Sep 2026</span>
        <span data-bill-field="reading-date">01-09-2026</span>
        <span data-bill-field="current-bill">4,100</span>
        <span data-bill-field="after-due-bill">4,500</span>
        <span data-bill-field="due-date">30-09-2026</span>
    </body></html>`;
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/bills/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'gas',
            data: compressHtml(html),
        }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.bill_name, 'FATIMA 12345678901');
    assert.equal(body.ref, '12345678901');
    assert.equal(body.html, undefined);
});

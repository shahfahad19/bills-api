const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
const { parseGasBill } = require('../src/parsers/gas.parser');
const { gasProtection } = require('../src/services/gas-insights');
const { createApp } = require('../src/app');
const { compressHtml } = require('../src/utils/compression');

const html = fs.readFileSync(path.join(__dirname,'fixtures/sngpl-aug-2026.html'),'utf8');
const parse = value => parseGasBill({html:value,reference:'12345678901'});
const mutate = fn => { const $ = cheerio.load(html); fn($); return $.html(); };

test('live SNGPL structure extracts HM3 instead of GCV, and all 12 months', () => {
    const bill = parse(html);
    assert.equal(bill.units,'0.513 HM3');
    assert.equal(bill.meter.gcv,1046);
    assert.equal(bill.meter.mmbtu,1.906);
    assert.equal(bill.reading_date,'3 September 2026');
    assert.equal(bill.issue_date,'11 September 2026');
    assert.equal(bill.due_date,'25 September 2026');
    assert.equal(bill.bill_period,'Aug 2026');
    assert.equal(bill.bill_history.length,12);
    assert.equal(bill.bill_history[3].payment_amount,0);
    assert.equal(bill.bill_history.at(-1).payment_amount,6720);
    assert.equal(bill.insights.consumption.month_over_month.percent_change,1.99);
    assert.equal(bill.insights.consumption.year_over_year.percent_change,-18.83);
    assert.equal(Object.hasOwn(bill,'after_due_bill'),false);
    assert.equal(bill.paid,null);
    assert.deepEqual(bill.parsing.warnings,[{field:'paid',code:'PAYMENT_STATUS_UNKNOWN'}]);
});

test('gas breakdown distinguishes current cost, credit, payable and prorated fixed costs', () => {
    const bill = parse(html);
    assert.equal(bill.current_bill,'80');
    assert.equal(bill.charges.billing.current_month_bill,3441.33);
    assert.equal(bill.charges.billing.arrears,-3363.68);
    assert.equal(bill.charges.taxes.gst,524.95);
    assert.equal(bill.insights.reconciliation.current_bill_difference,0);
    assert.equal(bill.insights.reconciliation.balance_before_rounding,77.65);
    assert.equal(bill.insights.reconciliation.payable_difference,2.35);
    assert.equal(bill.insights.reconciliation.implied_gst_percent,18);
    assert.equal(bill.insights.consumption.reading_days,32);
    assert.equal(bill.insights.reconciliation.implied_base_fixed_charge,1500);
    assert.equal(bill.insights.reconciliation.implied_base_meter_rent,40);
    assert.equal(bill.insights.cost_per_unit.gas_only_per_mmbtu,668.26);
    assert.equal(bill.insights.reconciliation.mmbtu_consistent_with_display_precision,true);
    assert.equal(bill.charges.tariff_schedule.slabs.length,8);
    assert.equal(bill.charges.tariff_schedule.effective_date,'2025-07-01');
    assert.equal(bill.insights.savings.scenarios[0].target_hm3,0.4617);
    assert.equal(bill.insights.savings.scenarios[0].estimated_bill_saving,null);
});

test('gas protection uses actual winter evidence without inventing a conversion date', () => {
    const result = parse(html).insights.protection;
    assert.equal(result.status,'unprotected');
    assert.equal(result.winter_average_hm3,0.9535);
    assert.equal(result.winter_total_hm3,3.814);
    assert.equal(result.excess_winter_total_hm3,0.214);
    assert.equal(result.meets_historical_average,false);
    assert.deepEqual(result.next_winter_window,{start:'2026-11',end:'2027-02',total_target_hm3:3.6});
    assert.equal(result.estimated_first_protected_bill_period,null);
    assert.equal(gasProtection('DOMP-G','Aug 2026',0.513,[]).status,'protected');
    for (const tariff of ['COM-G','DOMU-R','UNKNOWN',null]) {
        assert.equal(gasProtection(tariff,'Aug 2026',0.513,[]).status,'unknown');
        assert.equal(gasProtection(tariff,'Aug 2026',0.513,[]).next_winter_window,null);
    }
});

test('winter rollover, missing/duplicate evidence and zero consumption stay distinct', () => {
    const rows = ['Nov 2025','Dec 2025','Jan 2026','Feb 2026'].map(month=>({month,units:0.9}));
    assert.equal(gasProtection('DOMU-G','Aug 2026',0,rows).meets_historical_average,true);
    assert.equal(gasProtection('DOMU-G','Aug 2026',0,rows.slice(1)).winter_average_hm3,null);
    assert.equal(gasProtection('DOMU-G','Aug 2026',0,[...rows,rows[0]]).winter_average_hm3,null);
    assert.equal(gasProtection('DOMU-G','Jan 2026',0,rows).next_winter_window.end,'2026-02');
    assert.equal(gasProtection('DOMU-G','Feb 2026',0,rows.slice(0,3)).winter_average_hm3,0.675);
});

test('SNGPL data survives CSS removal, nested text wrappers and reordered history columns', () => {
    const baseline = parse(html);
    const variants = [
        mutate($=>$('*').removeAttr('class')),
        mutate($=>$('td').filter((_,el)=>!$(el).children().length).wrapInner('<span><strong></strong></span>')),
        mutate($=>{
            const header = $('tr').filter((_,el)=>$(el).children('td').first().text().trim()==='Month').first();
            const order = [3,1,0,4,2];
            header.add(header.nextAll().find('tr')).each((_,el)=>{
                const cells=$(el).children('td').toArray();
                if(cells.length===5) $(el).empty().append(order.map(i=>cells[i]));
            });
        }),
        // Flatten the history table: column labels must not become current-bill fields.
        mutate($=>{
            const header = $('tr').filter((_,el)=>$(el).children('td').first().text().trim()==='Month').first();
            const wrapper = header.next('tr');
            const rows = wrapper.find('tr').clone();
            wrapper.replaceWith(rows);
        }),
    ];
    for (const variant of variants) {
        const bill = parse(variant);
        for (const key of ['units','current_bill','due_date','reading_date','bill_period']) assert.equal(bill[key],baseline[key],key);
        assert.deepEqual(bill.charges,baseline.charges);
        assert.deepEqual(bill.bill_history,baseline.bill_history);
        assert.deepEqual(bill.insights,baseline.insights);
    }
});

test('missing gas fields stay unknown; wrong GCV or conflicting charges are flagged', () => {
    const missing = parse(mutate($=>{
        $('td').filter((_,el)=>$(el).text().trim()==='Gas Consumed HM3').next().text('');
        $('td').filter((_,el)=>$(el).text().trim()==='GST').closest('tr').remove();
    }));
    assert.equal(missing.units,null);
    assert.equal(missing.insights.cost_per_unit.current_bill_per_hm3,null);
    assert.equal(missing.charges.taxes.gst,null);
    assert.equal(missing.insights.reconciliation.current_bill_from_components,null);
    assert.deepEqual(missing.insights.savings.scenarios,[]);
    const badGcv = parse(html.replace('>1046<','>2000<'));
    assert.equal(badGcv.insights.reconciliation.mmbtu_consistent_with_display_precision,false);
    const inconsistent = parse(mutate($=>{
        $('td').filter((_,el)=>$(el).text().trim()==='Gas Charges').closest('tr').children().last().text('900');
    }));
    assert.ok(inconsistent.parsing.warnings.some(w=>w.code==='CURRENT_BILL_MISMATCH'));
    assert.throws(()=>parse(html+'<p>Total Amount Due: 900</p>'),{code:'AMBIGUOUS_BILL'});
});

test('duplicate history copies are deduplicated; conflicts invalidate winter evidence', () => {
    const cloneHistory = conflicting => mutate($=>{
        const row = $('tr').filter((_,el)=>$(el).children('td').first().text().trim()==='Nov 2025').first();
        const copy = row.clone();
        if(conflicting) copy.children().eq(1).text('5.000');
        row.after(copy);
    });
    assert.equal(parse(cloneHistory(false)).bill_history.length,12);
    const bill = parse(cloneHistory(true));
    assert.equal(bill.insights.protection.winter_average_hm3,null);
    assert.ok(bill.parsing.warnings.some(w=>w.code==='CONFLICTING_HISTORY'));
});

test('live gas fixture produces identical insights through plain/compressed API input', async t => {
    const server=createApp().listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    t.after(()=>server.close());
    const results=[];
    for(const input of [{html},{data:compressHtml(html)}]) {
        const response=await fetch(`http://127.0.0.1:${server.address().port}/api/bills/parse`,{
            method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'gas',...input})});
        assert.equal(response.status,200);
        results.push(await response.json());
    }
    assert.deepEqual(results[0].insights,results[1].insights);
    assert.equal(results[0].units,'0.513 HM3');
    assert.equal(results[0].charges.billing.current_month_bill,3441.33);
});

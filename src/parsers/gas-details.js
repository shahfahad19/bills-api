const { clean, labelKey } = require('./field-reader');
const { number, periodIndex, periodKey } = require('./electricity-details');
const { parseProviderDate } = require('../utils/dates');

const nonnegative = value => number(value) !== null && number(value) >= 0 ? number(value) : null;
const isoDate = value => parseProviderDate(value)?.toISOString().slice(0, 10) || null;
const cellsOf = ($, row) => $(row).children('td,th').toArray().map(cell => clean($(cell).text()));

function extractGasHistory($, warn) {
    const rows = new Map();
    const columns = { month:'month', billingmonth:'month', hm3:'units', consumptionhm3:'units',
        currentbill:'bill_amount', amountdue:'amount_due', payment:'payment_amount' };
    $('tr').each((_, element) => {
        const keys = cellsOf($, element).map(value => columns[labelKey(value)]);
        if (!keys.includes('month') || !keys.includes('units')) return;
        // SNGPL places its data in a nested table below the header. Also
        // accept ordinary sibling rows so the wrapper can change.
        const siblings = $(element).nextAll('tr');
        siblings.add(siblings.find('tr')).each((_, row) => {
            if ($(row).find('table').length) return;
            const cells = cellsOf($, row);
            if (cells.length !== keys.length) return;
            const values = {};
            keys.forEach((key,i) => { if (key) values[key] = cells[i]; });
            const index = periodIndex(values.month);
            if (index === null) return;
            const entry = { month:values.month, period:periodKey(index), units:nonnegative(values.units),
                bill_amount:number(values.bill_amount), amount_due:number(values.amount_due), payment_amount:number(values.payment_amount) };
            const prior = rows.get(entry.period);
            if (prior && ['units','bill_amount','amount_due','payment_amount'].some(key => prior[key] !== entry[key])) {
                warn('bill_history', 'CONFLICTING_HISTORY');
                rows.set(entry.period, {...entry, units:null, bill_amount:null, amount_due:null, payment_amount:null});
            } else rows.set(entry.period, entry);
        });
    });
    if (!rows.size) warn('bill_history','MISSING_HISTORY');
    return [...rows.values()].sort((a,b) => a.period.localeCompare(b.period));
}

function extractMeterRows($) {
    const values = {};
    const add = (key, value) => { (values[key] ||= []).push(['meter_table', value]); };
    $('tr').each((_, element) => {
        const headings = cellsOf($, element).map(labelKey);
        if (!headings.includes('current') || !headings.includes('previous') || !headings.includes('difference')) return;
        const table = $(element).closest('table');
        // The meter number is unlabelled because the label is on a background
        // image. Require the known reading-table signature and identifier form.
        const preceding = $(element).prevAll('tr').first();
        const meter = cellsOf($, preceding).filter(value => /^[A-Z]{1,5}\d{6,20}$/.test(value));
        if (meter.length === 1) add('meter_number',meter[0]);
        table.find('tr').filter((_, row) => $(row).closest('table')[0] === table[0]).each((_, row) => {
            const cells = cellsOf($, row);
            if (cells.length !== headings.length) return;
            const label = labelKey(cells[0]);
            if (!['dates','date','reading','readings'].includes(label)) return;
            const date = label.startsWith('date');
            for (const key of ['current','previous','difference']) {
                if (date && key === 'difference') continue;
                add(date ? `${key}_reading_date` : `${key}_reading`,cells[headings.indexOf(key)]);
            }
        });
    });
    return values;
}

function extractReceipt($) {
    const values = { currentBill:[], dueDate:[] };
    $('tr').each((_, element) => {
        const heading = cellsOf($, element);
        if (labelKey(heading[0]) !== 'accountid' || !/^\d{11}$/.test(heading[1] || '')) return;
        $(element).nextAll('tr').each((_, row) => {
            const cells = cellsOf($, row);
            if (cells.length !== 3 || number(cells[0]) === null || number(cells[1]) === null || !isoDate(cells[2])) return;
            values.currentBill.push(['sngpl_receipt',cells[0]]);
            values.dueDate.push(['sngpl_receipt',cells[2]]);
        });
    });
    return values;
}

function extractPrintedTariff($, warn) {
    const slabs = [];
    $('tr').each((_, element) => {
        const headings = cellsOf($,element).map(labelKey);
        const usage = headings.indexOf('usageofgasinhm3');
        const rate = headings.indexOf('rspermmbtu');
        if (usage < 0 || rate < 0 || !headings.includes('slab')) return;
        $(element).nextAll('tr').each((_, row) => {
            const cells = cellsOf($,row);
            const match = cells[usage]?.match(/^(Up to|Above)\s+(\d+(?:\.\d+)?)[.]?$/i);
            if (!match || nonnegative(cells[rate]) === null) return;
            slabs.push({ limit_hm3:number(match[2]), above:match[1].toLowerCase() === 'above', rate_per_mmbtu:number(cells[rate]) });
        });
    });
    const unique = [...new Map(slabs.map(row => [JSON.stringify(row),row])).values()];
    if (!unique.length) warn('tariff_schedule','MISSING_TARIFF');
    if (unique.some((row,i) => unique.some((other,j) => i !== j && row.limit_hm3 === other.limit_hm3 && row.above === other.above))) {
        warn('tariff_schedule','CONFLICTING_TARIFF');
        return { source:'printed_bill', slabs:[], effective_date:null };
    }
    const effectiveDates = [];
    $('td').each((_, el) => {
        if ($(el).find('table').length) return;
        const match = clean($(el).text()).match(/Gas Rates w\.e\.f\.\s*([\d/-]+)/i);
        if (match && isoDate(match[1])) effectiveDates.push(isoDate(match[1]));
    });
    return { source:'printed_bill', slabs:unique, effective_date:[...new Set(effectiveDates)].length === 1 ? effectiveDates[0] : null };
}

function extractGasDetails($, readLabel, resolve, warn) {
    const field = (key, aliases, normalize = number, extra = []) => resolve(key,
        [...readLabel(aliases).map(value => ['label',value]), ...extra],normalize);
    const chargeLabels = {
        gas_charges:['Gas Charges'], provisional_adjustment:['Prov.Bill Adjustment','Provisional Bill Adjustment'],
        meter_rent:['Meter Rent'], fixed_charges:['Fixed Charges'], gst:['GST','General Sales Tax'],
        rebate_adjustment:['Rebate / Adjustment'], security_deposit:['Security Deposit'],
        current_month_bill:['Current Bill'], total_amount_due:['Total Amount Due'],
    };
    const billing = Object.fromEntries(Object.entries(chargeLabels).map(([key,labels]) => [key,field(`charges.${key}`,labels)]));
    const arrears = field('charges.arrears',['Arrears / Aging'],value => number(clean(value).split('/')[0]));
    const aging = field('charges.aging',['Arrears / Aging'],value => number(clean(value).split('/')[1]));
    billing.arrears = arrears;
    // Used internally to reconcile the printed total; no after-due bill is exposed.
    const surcharge = field('charges.existing_surcharge',['Late Payment Surcharge (Rs.)','Late Payment Surcharge']);
    const rows = extractMeterRows($);
    const meter = {
        number:field('meter_number',['Meter No','Meter Number'],clean,rows.meter_number),
        current_reading_date:field('current_reading_date',['Reading Date','Current Reading Date'],isoDate,rows.current_reading_date),
        previous_reading_date:field('previous_reading_date',['Previous Reading Date'],isoDate,rows.previous_reading_date),
        current_reading:field('current_reading',['Current Reading'],value => /^\d+$/.test(clean(value)) ? clean(value) : null,rows.current_reading),
        previous_reading:field('previous_reading',['Previous Reading'],value => /^\d+$/.test(clean(value)) ? clean(value) : null,rows.previous_reading),
        difference_reading:field('difference_reading',['Reading Difference'],nonnegative,rows.difference_reading),
        mmbtu:field('mmbtu',['MMBTU'],nonnegative), gcv:field('gcv',['GCV'],nonnegative),
        pressure:field('pressure',['Pres./factor'],value => number(clean(value).split('/')[0])),
        pressure_factor:field('pressure_factor',['Pres./factor'],value => nonnegative(clean(value).split('/')[1])),
    };
    return { billing, aging, surcharge, meter, history:extractGasHistory($,warn), tariff_schedule:extractPrintedTariff($,warn),
        tariff:field('tariff',['Tariff'],value => clean(value).toUpperCase()),
        issue_date:field('issue_date',['Issue Date'],isoDate), receipt:extractReceipt($) };
}

module.exports = { extractGasDetails, extractGasHistory, nonnegative, isoDate };

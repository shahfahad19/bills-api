const { createLabelReader, labelKey } = require('./field-reader');

// Read amounts from provider text without turning missing values into zero.
function number(value) {
    const text = String(value ?? '').trim().replace(/,/g, '');
    return /^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text) && Number.isFinite(Number(text)) ? Number(text) : null;
}

function round(value) {
    return Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : null;
}

function periodIndex(value) {
    const match = String(value || '').trim().match(/^([a-z]{3,9})[\s/-]*(\d{2}|\d{4})$/i);
    if (!match) return null;
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const month = months.findIndex(name => name === match[1].toLowerCase() || name.slice(0,3) === match[1].toLowerCase());
    if (month < 0) return null;
    return (Number(match[2]) + (match[2].length === 2 ? 2000 : 0)) * 12 + month;
}

function periodKey(index) {
    return index === null ? null : `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`;
}

function extractHistory($, warn = () => {}) {
    const rows = [];
    const handled = new Set();
    const column = value => ({month:'month',billmonth:'month',status:'status',units:'units',
        unitsconsumed:'units',billrs:'bill_amount',bill:'bill_amount',billamount:'bill_amount',
        paymentrs:'payment_amount',payment:'payment_amount',paymentamount:'payment_amount'})[labelKey(value)];
    // Tables and div grids both use a header followed by sibling rows.
    $('tr, div').each((_, element) => {
        const header = $(element);
        const keys = header.children().toArray().map(cell => column($(cell).text()));
        if (!keys.includes('month') || !keys.includes('units') || keys.filter(Boolean).length < 2) return;
        header.nextAll().each((_, row) => {
            const cells = $(row).children();
            if (cells.length !== keys.length) return;
            const values = {};
            keys.forEach((key,i) => { if (key) values[key] = $(cells[i]).text().trim(); });
            if (periodIndex(values.month) === null) return;
            handled.add(row);
            rows.push({month:values.month, period:periodKey(periodIndex(values.month)), status:values.status || null,
                units:number(values.units), bill_amount:number(values.bill_amount), payment_amount:number(values.payment_amount)});
        });
    });
    $('.history-row').each((_, element) => {
        if (handled.has(element)) return;
        const cells = $(element).children('.history-cell').map((i, cell) => $(cell).text().trim()).get();
        if (cells.length < 5 || periodIndex(cells[0]) === null) return;
        rows.push({
            month: cells[0], period: periodKey(periodIndex(cells[0])),
            status: cells[1] || null, units: number(cells[2]),
            bill_amount: number(cells[3]), payment_amount: number(cells[4]),
        });
    });
    const unique = new Map();
    for (const row of rows) {
        const previous = unique.get(row.period);
        if (!previous) unique.set(row.period, row);
        else if (['units','bill_amount','payment_amount','status'].some(key => previous[key] !== row[key])) {
            warn('bill_history', 'CONFLICTING_HISTORY');
            unique.set(row.period, {...previous, units:null, bill_amount:null, payment_amount:null, status:null});
        }
    }
    return [...unique.values()].sort((a, b) => a.period.localeCompare(b.period));
}

function readSections(text, warn) {
    text = text.toUpperCase().replace(/\r/g, '');
    const sections = {};
    const pattern = /-{3,}\s*([A-Z][A-Z \t.]+?)(?:\s*=\s*([-\d.,]+))?\s*-{3,}([\s\S]*?)(?=-{3,}|$)/g;
    for (const match of text.matchAll(pattern)) {
        const entries = [...match[3].matchAll(/^[ \t]*([A-Z][A-Z \t.]*?)[ \t]*:[ \t]*([^\n]*)$/gm)]
            .map(item => ({ code: item[1].trim().replace(/\s+/g, ' '), amount: number(item[2]) }));
        const key = match[1].trim().replace(/\s+/g, ' ');
        const section = { total: number(match[2]), entries, text: match[3].trim() };
        if (entries.some(entry => entry.amount === null)) warn('charges','INVALID_COMPONENT');
        if (Object.hasOwn(sections,key) && JSON.stringify(sections[key]) !== JSON.stringify(section)) {
            warn('charges','CONFLICTING_SECTION');
            sections[key] = null;
        } else sections[key] = section;
    }
    return sections;
}

const TAX_NAMES = { ED: 'Electricity duty', GST: 'General sales tax', ITAX: 'Income tax',
    IT: 'Income tax', 'TV FEE': 'TV fee', STAX: 'Sales tax (provider STAX)',
    FTAX: 'Further tax', ETAX: 'Extra tax', ASTAX: 'Additional sales tax', RSTAX: 'Retail sales tax' };

function taxGroup(section, warn) {
    if (!section) return { reported_total: null, component_total: null, items: [] };
    // Some bills repeat a tax code (e.g. STAX). Keep one identical entry;
    // preserve conflicting values and report a reconciliation difference.
    const entries = section.entries.filter((entry, i, all) =>
        all.findIndex(other => other.code === entry.code && other.amount === entry.amount) === i);
    const conflict = entries.some((entry, i) => entries.some((other,j) => i !== j && other.code === entry.code));
    if (conflict) warn('charges','CONFLICTING_TAX_COMPONENT');
    const total = !conflict && entries.length && entries.every(entry => entry.amount !== null)
        ? round(entries.reduce((sum, entry) => sum + entry.amount, 0)) : null;
    if (total !== null && section.total !== null && Math.abs(section.total - total) > 0.02) warn('charges','TAX_TOTAL_MISMATCH');
    return { reported_total: section.total, component_total: total,
        difference: section.total === null || total === null ? null : round(section.total - total),
        items: entries.map(entry => ({ ...entry, label: TAX_NAMES[entry.code] || entry.code })) };
}

function extractCharges($, readLabel = createLabelReader($), warn = () => {}) {
    const summary = {};
    $('.charges-bd-row').each((_, element) => {
        const label = $(element).find('.charges-bd-en').first().text().trim();
        if (label) summary[label] = number($(element).find('.charges-bd-val').first().text());
    });
    const texts = [...new Set($('textarea, pre, input[type="hidden"]').map((_, el) => $(el).val() || $(el).text()).get()
        .filter(value => /ENERGY\s+DETAILS/i.test(value)).map(value => value.trim()))];
    if (texts.length > 1) warn('charges', 'CONFLICTING_CHARGE_TEXT');
    const text = texts.length === 1 ? texts[0] : '';
    const sections = readSections(text, warn);
    const energy = sections['ENERGY DETAILS'];
    const values = {};
    for (const entry of energy?.entries || []) {
        if (Object.hasOwn(values,entry.code) && values[entry.code] !== entry.amount) {
            warn('charges','CONFLICTING_ENERGY_COMPONENT');
            values[entry.code] = null;
        } else values[entry.code] = entry.amount;
    }
    const calculations = [...(sections['BILL CALC']?.text || '').matchAll(/([\d.]+)\s*[X×]\s*([\d.]+)/gi)]
        .map(match => ({ rate: number(match[1]), quantity: number(match[2]), amount: round(Number(match[1]) * Number(match[2])) }));
    const units = values.UNITS ?? null;
    // Only expose energy slabs when both units and money reconcile. The
    // remaining rows may describe fixed charges (e.g. Rs/kW x load).
    const slabs = [];
    let used = 0;
    for (const row of calculations) {
        if (units === null || row.rate === null || row.quantity === null || row.quantity <= 0 || used >= units || used + row.quantity > units) break;
        slabs.push({ rate_per_kwh: row.rate, units: row.quantity, amount: row.amount });
        used += row.quantity;
    }
    const verified = slabs.length > 0 && used === units && values['VARIABLE CHRG'] != null &&
        Math.abs(slabs.reduce((sum, row) => sum + row.amount, 0) - values['VARIABLE CHRG']) < 0.02;
    const currentTaxes = taxGroup(sections.TAXES, warn);
    const fpaTaxes = taxGroup(sections['TAXES ON FPA'], warn);
    const summaryKeys = {
        'Total Electricity Charges': 'gross_electricity_charges', Subsidies: 'subsidy',
        'Net Electricity Charges': 'net_electricity_charges', Taxes: 'taxes',
        'Current Bill': 'current_month_bill', Arrears: 'arrears', Installment: 'installment',
        Adjustments: 'adjustments', 'W.E Credit': 'we_credit', 'Lock Open Credit': 'lock_open_credit',
        'Total FPA': 'fuel_adjustment_total', 'Grand Total': 'grand_total',
    };
    for (const label of Object.keys(summaryKeys)) {
        const values = [...new Set([summary[label], ...readLabel([label]).map(number)].filter(value => value !== null && value !== undefined))];
        summary[label] = values.length === 1 ? values[0] : null;
        if (values.length > 1) warn('charges', 'CONFLICTING_SUMMARY');
    }
    return {
        source: text ? 'provider_charge_qr_text_and_summary' : 'provider_summary_only',
        currency: 'PKR', summary,
        billing: Object.fromEntries(Object.entries(summaryKeys).map(([label, key]) => [key, summary[label] ?? null])),
        energy: { reported_total_including_fpa: energy?.total ?? null, units,
            variable_charges: values['VARIABLE CHRG'] ?? null, fixed_charges: values['FIXED CHRG'] ?? null,
            meter_rent: values['METER RENT'] ?? null, service_rent: values['SERVICE RENT'] ?? null,
            fuel_adjustment_energy: values['FPA ENERGY'] ?? null,
            financing_cost_surcharge: values['F.C. SUR'] ?? null, quarterly_adjustment: values.QTA ?? null,
            slabs: verified ? slabs : [], calculations, slabs_verified: verified },
        taxes: { current: currentTaxes, fuel_adjustment: fpaTaxes,
            combined_total: currentTaxes.reported_total !== null && fpaTaxes.reported_total !== null
                ? round(currentTaxes.reported_total + fpaTaxes.reported_total) : null },
    };
}

module.exports = { extractCharges, extractHistory, number, round, periodIndex, periodKey };

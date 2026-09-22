const axios = require('axios');
const cheerio = require('cheerio');
const QRCode = require('qrcode');
const JsBarcode = require('jsbarcode');
const { DOMImplementation, XMLSerializer } = require('xmldom');
const { AppError } = require('../errors/app-error');
const { compressHtml } = require('../utils/compression');
const { daysUntil, formatProviderDate, fullMonth, parseProviderDate } = require('../utils/dates');
const { sanitizeHtml } = require('../utils/html');
const { extractCharges, extractHistory, periodIndex, number } = require('./electricity-details');
const { createLabelReader, createFieldResolver, clean } = require('./field-reader');
const { buildInsights } = require('../services/electricity-insights');

const PITC_ORIGIN = 'https://bill.pitc.com.pk';

function normalizeHtml(html) {
    return html
        .replace(/<div[^>]+class="noprint">.*?<\/div>/is, '')
        .replace(/<noscript>.*?<\/noscript>/is, '')
        .replace(/src="\//g, `src="${PITC_ORIGIN}/`)
        .replace(/href="\//g, `href="${PITC_ORIGIN}/`)
        .replace(/action="\.\//g, `action="${PITC_ORIGIN}/pescobill/`)
        .replaceAll('padding: 20px;', '')
        .replace('http://snap', 'https://snap')
        .replace(`url('/images/`, `url('${PITC_ORIGIN}/images/`);
}

function labeledValue($, label) {
    let value = '';
    $('.label-row .en-lbl').each((_, element) => {
        if ($(element).text().replace(/\s+/g, ' ').trim().toUpperCase() === label.toUpperCase()) {
            value = $(element).closest('.label-row').next('.val-space').text().replace(/\s+/g, ' ').trim();
        }
    });
    return value;
}

function extractPayment($) {
    const values = {};
    $('.payable-card-paid-row').each((_, row) => {
        const label = $(row).find('.payable-card-paid-label').text().replace(/\s+/g, ' ').trim();
        const value = $(row).find('.payable-card-paid-val').text().replace(/\s+/g, ' ').trim();
        if (label) values[label.toLowerCase()] = value;
    });
    return {
        amountPaid: values['amount paid'] || '',
        paymentDate: values['payment date'] || '',
    };
}

function extractNewLayout($) {
    let name = '';

    $('.en-lbl').each((_, element) => {
        if ($(element).text().includes('NAME & ADDRESS')) {
            name = $(element).closest('.label-row').next('.val-space').text().trim();
        }
    });

    const billPeriod = $('div.right-main-val:not(.right-main-val--due)').first().text().trim();
    const payment = extractPayment($);

    return {
        name: labeledValue($, 'NAME & ADDRESS') || name,
        units: labeledValue($, 'UNITS'),
        reference: labeledValue($, 'REFERENCE NO'),
        consumerId: labeledValue($, 'CONSUMER ID'),
        category: labeledValue($, 'CATEGORY'),
        tariffCategory: labeledValue($, 'TARIFF CATEGORY'),
        tariff: labeledValue($, 'TARIFF'),
        sanctionedLoad: labeledValue($, 'SAN LOAD'),
        meterStatus: labeledValue($, 'STATUS'),
        meterNumber: labeledValue($, 'METER NO'),
        previousReading: labeledValue($, 'PREVIOUS READING'),
        presentReading: labeledValue($, 'PRESENT READING'),
        billPeriod,
        currentBill: $('.payable-card-amount').first().text().trim(),
        dueDate: $('.right-main-val--due').first().text().trim(),
        ...payment,
    };
}

function extractLegacyLayout($) {
    const selectors = {
        billMonth: 'body > div.tab-content.active > div.maincontent.fontsize > table:nth-child(2) > tbody > tr.content > td:nth-child(4)',
        currentBill: 'body > div.tab-content.active > div.maincontent.fontsize > div.headertable.fontsize > div:nth-child(3) > table > tbody > tr:nth-child(1) > td.border-b.border-t.border-r.content',
        dueDate: 'body > div.tab-content.active > div.maincontent.fontsize > div.headertable.fontsize > div:nth-child(3) > table > tbody > tr:nth-child(2) > td:nth-child(2)',
        name: 'body > div.tab-content.active > div > table:nth-child(5) > tbody > tr > td.border-r > table > tbody > tr:nth-child(2) > td:nth-child(1) > p > span:nth-child(3)',
        units: 'body > div.tab-content.active > div > table:nth-child(5) > tbody > tr > td.border-r > table > tbody > tr.content > td:nth-child(5)',
        readingDate: 'body > div.tab-content.active > div > table:nth-child(2) > tbody > tr.content > td:nth-child(5)',
    };
    const history = [];

    $('.nested6 .content').each((_, row) => {
        history.push({
            month: $(row).find('td:first-child').text().trim(),
            units: $(row).find('td:nth-child(2)').text().trim(),
        });
    });

    return {
        name: $(selectors.name).text().trim(),
        units: $(selectors.units).text().trim(),
        billMonth: fullMonth($(selectors.billMonth).text()),
        billPeriod: $(selectors.billMonth).text().trim(),
        currentBill: $(selectors.currentBill).text().trim(),
        dueDate: $(selectors.dueDate).text().trim(),
        readingDate: $(selectors.readingDate).text().trim(),
        paid: $('body').text().includes('Amount Paid'),
        amountPaid: '',
        paymentDate: '',
        history,
    };
}

async function injectQrCodes($) {
    const definitions = [
        ['.header-qr-host', 'header_bill_qrcode_', 'header_qr_text_', 80, 'M'],
        ['.qr-charges-host', 'charges_qrcode_', 'charges_qr_text_', 150, 'L'],
        ['.subsidy-qr-host', 'subsidy_qr_', 'subsidy_qr_text_', 80, 'L'],
    ];
    const jobs = [];

    for (const [selector, hostPrefix, textPrefix, size, level] of definitions) {
        $(selector).each((_, element) => {
            const host = $(element);
            const index = (host.attr('id') || '').replace(hostPrefix, '');
            const textElement = $(`#${textPrefix}${index}`);
            const value = textElement.val() || textElement.attr('value') || textElement.text();
            if (!value || !value.trim()) return;

            jobs.push(QRCode.toDataURL(value.trim(), {
                errorCorrectionLevel: level,
                width: size,
                margin: 2,
            }).then(source => {
                host.html(`<img src="${source}" alt="QR code" style="width:${size}px;height:${size}px;display:block" />`);
            }));
        });
    }

    await Promise.allSettled(jobs);
}

function injectBarcodes($) {
    const scripts = $('script').map((_, element) => $(element).html()).get();
    const serializer = new XMLSerializer();

    for (const script of scripts) {
        if (!script || !script.includes('JsBarcode')) continue;
        const matches = script.matchAll(/JsBarcode\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/g);

        for (const [, selector, value] of matches) {
            try {
                const document = new DOMImplementation().createDocument('http://www.w3.org/1999/xhtml', 'html');
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                JsBarcode(svg, value, { xmlDocument: document, width: 1, height: 50, margin: 5, displayValue: false });
                const encoded = Buffer.from(serializer.serializeToString(svg)).toString('base64');
                $(selector).replaceWith(`<img src="data:image/svg+xml;base64,${encoded}" alt="Barcode" />`);
            } catch (_) {
                // A malformed provider barcode must not prevent the bill from parsing.
            }
        }
    }
}

async function injectMeterSnaps($) {
    const jobs = [];
    $('[data-meter-snaps]').each((_, element) => {
        const grid = $(element);
        const count = Number(grid.attr('data-meter-count')) || 0;
        const reference = grid.attr('data-ref-no');
        const month = grid.attr('data-bill-month');
        if (!count || !reference || !month) return;

        jobs.push(axios.post('https://usersnap.pitc.com.pk/api/SnapsForDuplicateBill/ToDuplicate', {
            REF_NO: reference,
            BILL_MONTH: month,
        }, { timeout: 10000 }).then(response => {
            const data = response.data?.DATA?.[0];
            if (String(response.data?.STATUS) !== '1' || !data) return;
            const offset = data.SNAP_5 && data.SNAP_5 !== 'null' ? 5 : 1;
            const images = [];
            for (let index = 0; index < count; index += 1) {
                const value = data[`SNAP_${index + offset}`];
                if (value && value !== 'null') images.push(`<img src="data:image/png;base64,${value}" alt="Meter snap ${index + 1}" />`);
            }
            if (images.length) grid.html(images.join(''));
        }).catch(() => {}));
    });
    await Promise.all(jobs);
}

async function prepareBillHtml($, includeRemoteAssets) {
    if ($('#maincontent-1').length) $('body').html($('#maincontent-1'));
    $('.tabs.noprint, .tabcontent:nth-child(2)').remove();

    if (includeRemoteAssets) await injectMeterSnaps($);
    await injectQrCodes($);
    injectBarcodes($);

    $('script').remove();
    $('style, link[rel="stylesheet"]').remove();
    $('head').append(`
        <link href="${PITC_ORIGIN}/styles/bill-fonts/fonts.css" rel="stylesheet">
        <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&family=Roboto:wght@400;500;700;900&display=swap" rel="stylesheet">
        <link href="${PITC_ORIGIN}/styles/gbill-design.css?v=20260811e" rel="stylesheet">
        <link href="${PITC_ORIGIN}/styles/gbill-design-app.css?v=20260811e" rel="stylesheet">
    `);
    return sanitizeHtml($.html());
}

async function parseElectricityBill({ html, reference, company, includeRemoteAssets = false }) {
    if (typeof html !== 'string' || !html.trim()) {
        throw new AppError('Bill HTML is required', 400, 'INVALID_PAYLOAD');
    }

    const normalizedHtml = normalizeHtml(html);
    const $ = cheerio.load(normalizedHtml);
    const readLabel = createLabelReader($);
    const { resolve, report, warn } = createFieldResolver();
    const modern = extractNewLayout($);
    const legacy = extractLegacyLayout($);
    const charges = extractCharges($, readLabel, warn);
    const numeric = value => number(value) === null ? null : String(number(value));
    const nonnegative = value => number(value) !== null && number(value) >= 0 ? String(number(value)) : null;
    const date = value => parseProviderDate(value)?.toISOString().slice(0,10) || null;
    const period = value => {
        const index = periodIndex(value);
        return index === null ? null : `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][index % 12]} ${Math.floor(index / 12)}`;
    };
    const fields = {
        name: [['NAME & ADDRESS', 'CONSUMER NAME', 'NAME'], clean, true],
        reference: [['REFERENCE NO', 'REFERENCE NUMBER', 'REF NO'], value => /^\d{14}$/.test(clean(value).replace(/\s/g,'')) ? clean(value).replace(/\s/g,'') : null],
        units: [['UNITS', 'UNITS CONSUMED', 'BILLED UNITS'], nonnegative],
        billPeriod: [['BILL MONTH', 'BILLING MONTH'], period, true],
        // Current Bill is the month subtotal, not necessarily the payable.
        currentBill: [['PAYABLE WITHIN DUE DATE', 'WITHIN DUE DATE', 'AMOUNT PAYABLE', 'GRAND TOTAL'], numeric, true],
        dueDate: [['DUE DATE'], date], readingDate: [['READING DATE', 'READING DATE (PRO-RATA)'], date],
        issueDate: [['ISSUE DATE'], date], amountPaid: [['AMOUNT PAID'], nonnegative],
        paymentDate: [['PAYMENT DATE'], date], consumerId: [['CONSUMER ID']],
        category: [['CATEGORY', 'CONSUMER CATEGORY']], tariffCategory: [['TARIFF CATEGORY']],
        tariff: [['TARIFF']], sanctionedLoad: [['SAN LOAD', 'SANCTIONED LOAD'], nonnegative],
        meterStatus: [['STATUS', 'METER STATUS']], meterNumber: [['METER NO', 'METER NUMBER']],
        previousReading: [['PREVIOUS READING'], nonnegative], presentReading: [['PRESENT READING', 'CURRENT READING'], nonnegative],
    };
    // Reading and issue dates have identical CSS classes. Their order is not
    // evidence of their meaning, so only use explicit labels for those fields.
    const embedded = $('textarea, pre, input[type="hidden"]').map((_, el) => $(el).val() || $(el).text()).get();
    const data = {};
    for (const [field, [aliases, normalize = clean, required = false]] of Object.entries(fields)) {
        const candidates = readLabel(aliases).map(value => ['label', value]);
        candidates.push(['pitc_layout', modern[field]], ['legacy_layout', legacy[field]]);
        // Inspect every repeated payable card, not just the first printed copy.
        if (field === 'currentBill') $('.payable-card-amount').each((_, el) => candidates.push(['pitc_layout', $(el).text()]));
        if (field === 'currentBill') candidates.push(['charge_summary', charges.billing.grand_total]);
        if (field === 'units') {
            candidates.push(['charge_text', charges.energy.units]);
            for (const text of embedded) for (const match of text.matchAll(/^\s*UNITS\s*:\s*([^\r\n]+)/gim)) candidates.push(['embedded_text', match[1]]);
        }
        if (field === 'reference') {
            for (const text of embedded) for (const match of text.matchAll(/^\s*(?:REF(?:ERENCE)?\s*NO)\s*:\s*([\d ]+)/gim)) candidates.push(['embedded_text', match[1]]);
        }
        data[field] = resolve(field, candidates, normalize, required);
    }
    data.billMonth = fullMonth(data.billPeriod);
    data.billYear = Math.floor(periodIndex(data.billPeriod) / 12);
    data.paid = data.amountPaid !== null && Number(data.amountPaid) > 0 && Number(data.amountPaid) >= Number(data.currentBill) ? true : null;
    if (data.paid === null) warn('paid', 'PAYMENT_STATUS_UNKNOWN');
    if (data.reference && data.reference !== reference) {
        throw new AppError('Submitted HTML does not match the reference number', 400, 'REFERENCE_MISMATCH');
    }

    const billHistory = extractHistory($, warn);
    if (!billHistory.length) warn('bill_history', 'MISSING_HISTORY');
    if (charges.energy.units === null) warn('charges', 'MISSING_ENERGY_DETAIL');
    if (charges.taxes.current.reported_total === null) warn('charges', 'MISSING_TAX_DETAIL');
    if (data.units === null || (charges.energy.units !== null && number(data.units) !== charges.energy.units)) {
        charges.energy.slabs = [];
        charges.energy.slabs_verified = false;
    }
    data.history = billHistory.length ? billHistory : legacy.history;
    const insights = buildInsights(data, charges, billHistory);
    const renderedHtml = await prepareBillHtml($, includeRemoteAssets);
    return {
        type: 'electricity',
        company,
        ref: reference,
        bill_name: data.name.split(',')[0].trim(),
        units: data.units === null ? null : `${data.units} Units`,
        consumption_units: data.units === null ? null : number(data.units),
        bill_month: data.billMonth,
        bill_period: data.billPeriod || null,
        bill_year: data.billYear || null,
        reading_date: data.readingDate ? formatProviderDate(data.readingDate) : null,
        issue_date: data.issueDate ? formatProviderDate(data.issueDate) : null,
        current_bill: data.currentBill.replaceAll(',', ''),
        paid: data.paid,
        amount_paid: data.amountPaid,
        payment_date: data.paymentDate ? formatProviderDate(data.paymentDate) : null,
        due_date: data.dueDate ? formatProviderDate(data.dueDate) : null,
        remaining_days: daysUntil(data.dueDate),
        consumer_id: data.consumerId || null,
        category: data.category || null,
        tariff_category: data.tariffCategory || null,
        tariff: data.tariff || null,
        meter_number: data.meterNumber || null,
        previous_reading: data.previousReading || null,
        present_reading: data.presentReading || null,
        past_data: data.history.map(row => ({ month: row.month, units: row.units === null ? '' : String(row.units) })),
        bill_history: billHistory,
        charges,
        insights,
        parsing: report,
        bill_data: compressHtml(renderedHtml.replace(/\s+/g, ' ')),
        html: renderedHtml,
    };
}

module.exports = { parseElectricityBill };

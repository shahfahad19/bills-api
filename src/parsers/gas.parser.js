const cheerio = require('cheerio');
const { AppError } = require('../errors/app-error');
const { compressHtml } = require('../utils/compression');
const { daysUntil, formatProviderDate, fullMonth, parseProviderDate } = require('../utils/dates');
const { sanitizeHtml } = require('../utils/html');
const { createLabelReader, createFieldResolver, clean } = require('./field-reader');
const { number, periodIndex } = require('./electricity-details');
const { extractGasDetails } = require('./gas-details');
const { buildGasInsights } = require('../services/gas-insights');

const SNGPL_ORIGIN = 'https://www.sngpl.com.pk';
const PAPER_STYLES = '<style>.sheet,body{margin:0}@page{margin:0}.sheet{position:relative;box-sizing:border-box;page-break-after:always}.sheet.padding-10mm{padding:10mm}@media screen{.sheet{background:#fff;box-shadow:0 .5mm 2mm rgba(0,0,0,.3)}}</style>';

function normalizeHtml(html, publicBaseUrl) {
    let result = html
        .replace(/href='print/g, `href='${SNGPL_ORIGIN}/print`)
        .replace(/src='..\//g, `src='${SNGPL_ORIGIN}/`)
        .replace(`style='p`, `style='margin:0 auto; p`)
        .replace(`<link rel='stylesheet' href='https://www.sngpl.com.pk/print-css/paper.css'>`, PAPER_STYLES)
        .replace(`<meta http-equiv='Content-Type' content='text/html; charset=utf-8' />`, '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">')
        .replace(/<!DOCTYPE html PUBLIC[^>]+>/i, '<!DOCTYPE html>')
        .replaceAll(`'class`, `' class`);

    if (publicBaseUrl) {
        result = result.replace(
            /https:\/\/www\.sngpl\.com\.pk\/imageservlet\?consumer=(\d+)&billmon=(\d+)/g,
            `${publicBaseUrl}/api/img/sngpl-$1-$2.jpg`
        );
    }
    return result;
}

function extractGasReference(html) {
    const $ = cheerio.load(html || '');
    const legacySelector = 'tr.txt-tp > td:nth-child(1) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(1)';
    const selected = $(legacySelector).first().text().match(/\b\d{11}\b/)?.[0];
    const labels = createLabelReader($)(['CONSUMER NO', 'CONSUMER NUMBER', 'CONSUMER ID', 'ACCOUNT ID', 'ACCOUNT NO']);
    return createFieldResolver().resolve('reference', [...labels.map(value => ['label', value]), ['legacy_layout', selected]],
        value => /^\d{11}$/.test(clean(value)) ? clean(value) : null);
}

function parseGasBill({ html, reference, publicBaseUrl }) {
    if (typeof html !== 'string' || !html.trim()) {
        throw new AppError('Bill HTML is required', 400, 'INVALID_PAYLOAD');
    }

    const renderedHtml = sanitizeHtml(normalizeHtml(html, publicBaseUrl));
    const $ = cheerio.load(html);
    const readLabel = createLabelReader($);
    const { resolve, report, warn } = createFieldResolver();
    const details = extractGasDetails($,readLabel,resolve,warn);
    const numeric = value => number(value) === null ? null : String(number(value));
    const date = value => parseProviderDate(value)?.toISOString().slice(0,10) || null;
    const field = (key, attr, aliases, normalize = clean, required = false, extra = []) => resolve(key,
        [...readLabel(aliases).map(value => ['label', value]),
            ...$(`[data-bill-field="${attr}"]`).toArray().map(el => ['data_attribute',$(el).text()]), ...extra], normalize, required);
    const name = field('name','name',['NAME', 'NAME & ADDRESS', 'CONSUMER NAME'], clean, true);
    const currentBill = field('currentBill','current-bill',['PAYABLE WITHIN DUE DATE','WITHIN DUE DATE','AMOUNT PAYABLE','TOTAL AMOUNT DUE'],numeric,true,details.receipt.currentBill);
    const billMonth = field('billMonth','bill-month',['BILL MONTH','BILLING MONTH'], value => {
        const index = periodIndex(value);
        return index === null ? null : `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][index%12]} ${Math.floor(index/12)}`;
    },true);
    const units = field('units','units',['CONSUMPTION (HM3)','UNITS','GAS CONSUMED','GAS CONSUMED HM3'],value => number(value) >= 0 && number(value) !== null ? numeric(value) : null);
    const dueDate = field('dueDate','due-date',['DUE DATE'],date,false,details.receipt.dueDate);
    const readingDate = field('readingDate','reading-date',['READING DATE'],date,false,[['meter_table',details.meter.current_reading_date]]);
    const htmlReference = extractGasReference(html);
    if (!htmlReference) warn('reference','MISSING_FIELD');
    else report.sources.reference = ['provider_reference'];
    warn('paid','PAYMENT_STATUS_UNKNOWN');
    const history = details.history.map(row => ({month:row.month, units:row.units === null ? '' : String(row.units)}));

    if (!name) throw new AppError('Bill not found or provider layout changed', 422, 'BILL_NOT_FOUND');
    if (reference && htmlReference && reference !== htmlReference) {
        throw new AppError('Submitted HTML does not match the reference number', 400, 'REFERENCE_MISMATCH');
    }

    const normalizationDays = /Usage of Gas based on 30 Days/i.test(clean($('body').text())) ? 30 : null;
    const insights = buildGasInsights({units:number(units), billPeriod:billMonth, payable:number(currentBill),details,normalizationDays},warn);

    return {
        type: 'gas',
        company: 'SNGPL',
        ref: reference,
        bill_name: name,
        units: units === null ? null : `${units} HM3`,
        bill_month: fullMonth(billMonth),
        bill_period: billMonth,
        bill_year: Math.floor(periodIndex(billMonth) / 12),
        tariff: details.tariff,
        category: insights.protection.status === 'unknown' ? null : insights.protection.status,
        issue_date: details.issue_date ? formatProviderDate(details.issue_date) : null,
        reading_date: readingDate ? formatProviderDate(readingDate) : null,
        current_bill: currentBill,
        paid: null,
        due_date: dueDate ? formatProviderDate(dueDate) : null,
        remaining_days: daysUntil(dueDate),
        past_data: history,
        bill_history: details.history,
        meter: details.meter,
        charges: {currency:'PKR',billing:details.billing,arrears_aging:details.aging,
            taxes:{gst:details.billing.gst},tariff_schedule:details.tariff_schedule},
        insights,
        parsing: report,
        bill_data: compressHtml(renderedHtml.replace(/\s+/g, ' ')),
        html: renderedHtml,
    };
}

module.exports = { extractGasReference, parseGasBill };

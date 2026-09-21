const axios = require('axios');
const cheerio = require('cheerio');
const { AppError } = require('../errors/app-error');
const { getElectricityProvider } = require('../config/providers');

const SNGPL_URL = 'https://www.sngpl.com.pk';
const REQUEST_TIMEOUT_MS = 20000;

function requiredValue(value, name) {
    if (!value) throw new AppError(`Provider response did not contain ${name}`, 502, 'PROVIDER_CHANGED');
    return value;
}

async function fetchElectricityHtml(reference, company) {
    const provider = getElectricityProvider(reference, company);
    const client = axios.create({ timeout: REQUEST_TIMEOUT_MS });
    const initialResponse = await client.get(provider.url);
    const $ = cheerio.load(initialResponse.data);
    const cookies = initialResponse.headers['set-cookie'] || [];

    const cookieHeader = cookies.map(cookie => cookie.split(';')[0]).join('; ');
    const form = new URLSearchParams({
        __VIEWSTATE: requiredValue($('#__VIEWSTATE').val(), '__VIEWSTATE'),
        __VIEWSTATEGENERATOR: requiredValue($('#__VIEWSTATEGENERATOR').val(), '__VIEWSTATEGENERATOR'),
        __EVENTVALIDATION: requiredValue($('#__EVENTVALIDATION').val(), '__EVENTVALIDATION'),
        rbSearchByList: 'refno',
        searchTextBox: reference,
        ruCodeTextBox: '',
        __RequestVerificationToken: requiredValue(
            $('input[name="__RequestVerificationToken"]').val(),
            '__RequestVerificationToken'
        ),
        btnSearch: 'Search',
    });

    const response = await client.post(provider.url, form.toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: provider.url,
            Cookie: cookieHeader,
        },
    });

    return { html: response.data, company: provider.company };
}

async function fetchGasHtml(reference) {
    const url = `${SNGPL_URL}/viewbill?proc=viewbill&client=ANDROID&contype=NewCon&consumer=${reference}`;
    const response = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS });

    if (typeof response.data !== 'string' || response.data.length < 5000) {
        throw new AppError('Bill not found', 404, 'BILL_NOT_FOUND');
    }

    return { html: response.data, company: 'SNGPL' };
}

module.exports = { fetchElectricityHtml, fetchGasHtml };

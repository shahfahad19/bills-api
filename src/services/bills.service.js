const { AppError } = require('../errors/app-error');
const { getBillType, getElectricityProvider } = require('../config/providers');
const { fetchElectricityHtml, fetchGasHtml } = require('../scrapers/bill-fetcher');
const { parseElectricityBill } = require('../parsers/electricity.parser');
const { extractGasReference, parseGasBill } = require('../parsers/gas.parser');

function validateReference(reference, expectedType) {
    const normalized = String(reference || '').trim();
    const actualType = getBillType(normalized);
    if (!actualType || (expectedType && actualType !== expectedType)) {
        throw new AppError('Reference number is invalid', 400, 'INVALID_REFERENCE');
    }
    return { reference: normalized, type: actualType };
}

async function parseBill({ type, reference, company, html, publicBaseUrl, includeRemoteAssets }) {
    const resolvedReference = reference || (type === 'gas' ? extractGasReference(html) : null);
    const validated = validateReference(resolvedReference, type);
    if (validated.type === 'gas') {
        return parseGasBill({ html, reference: validated.reference, publicBaseUrl });
    }

    const provider = getElectricityProvider(validated.reference, company);
    return parseElectricityBill({
        html,
        reference: validated.reference,
        company: provider.company,
        includeRemoteAssets,
    });
}

async function fetchAndParseBill({ reference, publicBaseUrl, includeRemoteAssets = true }) {
    const validated = validateReference(reference);
    const fetched = validated.type === 'gas'
        ? await fetchGasHtml(validated.reference)
        : await fetchElectricityHtml(validated.reference);

    return parseBill({
        type: validated.type,
        reference: validated.reference,
        company: fetched.company,
        html: fetched.html,
        publicBaseUrl,
        includeRemoteAssets,
    });
}

module.exports = { fetchAndParseBill, parseBill, validateReference };

const axios = require('axios');
const { AppError } = require('../errors/app-error');
const { decompressHtml } = require('../utils/compression');
const { fetchAndParseBill, parseBill } = require('../services/bills.service');

function publicBaseUrl(req) {
    const protocol = req.get('x-forwarded-proto')?.split(',')[0] || req.protocol;
    return process.env.HOST || `${protocol}://${req.get('host')}`;
}

function sendBill(req, res, bill) {
    if (req.query.res === 'bill') {
        return res.type('html').send(bill.html);
    }
    if (req.query.res === 'download') {
        throw new AppError('Server-side bill downloads are not configured', 501, 'DOWNLOAD_UNAVAILABLE');
    }

    const { html, ...response } = bill;
    return res.json(response);
}

async function getBill(req, res, next) {
    try {
        const bill = await fetchAndParseBill({
            reference: req.params.reference,
            publicBaseUrl: publicBaseUrl(req),
        });
        return sendBill(req, res, bill);
    } catch (error) {
        return next(error);
    }
}

function resolveSubmittedHtml(body) {
    if (typeof body.html === 'string') return body.html;
    return decompressHtml(body.data);
}

function parseSubmittedBill(expectedType) {
    return async (req, res, next) => {
        try {
            const type = expectedType || req.body.type;
            const reference = req.body.reference || req.body.ref || req.body.refno;
            const bill = await parseBill({
                type,
                reference,
                company: req.body.company,
                html: resolveSubmittedHtml(req.body),
                publicBaseUrl: publicBaseUrl(req),
                includeRemoteAssets: false,
            });
            return sendBill(req, res, bill);
        } catch (error) {
            return next(error);
        }
    };
}

async function getSngplImage(req, res, next) {
    try {
        const { reference, month } = req.params;
        const response = await axios.get(
            `https://www.sngpl.com.pk/imageservlet?consumer=${reference}&billmon=${month}`,
            { responseType: 'arraybuffer', timeout: 15000 }
        );
        res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=15552000, immutable');
        return res.send(response.data);
    } catch (error) {
        return next(error);
    }
}

module.exports = { getBill, getSngplImage, parseSubmittedBill };

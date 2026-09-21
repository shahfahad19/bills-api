const zlib = require('zlib');
const { AppError } = require('../errors/app-error');

const MAX_DECOMPRESSED_BYTES = 8 * 1024 * 1024;

function compressHtml(html) {
    return zlib.deflateSync(Buffer.from(html, 'utf8')).toString('base64');
}

function decompressHtml(data) {
    if (typeof data !== 'string' || data.length === 0) {
        throw new AppError('A compressed HTML payload is required', 400, 'INVALID_PAYLOAD');
    }

    try {
        return zlib.inflateSync(Buffer.from(data, 'base64'), {
            maxOutputLength: MAX_DECOMPRESSED_BYTES,
        }).toString('utf8');
    } catch (error) {
        throw new AppError('The compressed HTML payload is invalid or too large', 400, 'INVALID_PAYLOAD');
    }
}

module.exports = { compressHtml, decompressHtml, MAX_DECOMPRESSED_BYTES };

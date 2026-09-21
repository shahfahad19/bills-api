const { AppError } = require('../errors/app-error');

function notFound(req, res) {
    res.status(404).json({
        error: 'NOT_FOUND',
        message: `Route ${req.method} ${req.originalUrl} was not found`,
    });
}

function errorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);

    if (error.type === 'entity.too.large') {
        return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' });
    }

    if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.code, message: error.message });
    }

    if (error.isAxiosError) {
        const status = error.response?.status === 404 ? 404 : 502;
        return res.status(status).json({
            error: status === 404 ? 'BILL_NOT_FOUND' : 'PROVIDER_UNAVAILABLE',
            message: status === 404 ? 'Bill not found' : 'The utility provider could not be reached',
        });
    }

    console.error(error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
}

module.exports = { errorHandler, notFound };

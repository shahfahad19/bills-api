const express = require('express');
const cors = require('cors');
const billsRouter = require('./routes/bills.routes');
const { errorHandler, notFound } = require('./middleware/error-handler');
const { version } = require('../package.json');

function createApp() {
    const app = express();
    app.disable('x-powered-by');
    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '4mb' }));
    app.use(express.urlencoded({ extended: false, limit: '4mb' }));

    app.get('/', (req, res) => res.json({ name: 'Bills API', status: 'ok' }));
    app.get('/api', (req, res) => res.json({ name: 'Bills API', status: 'ok' }));
    app.get('/api/version', (req, res) => res.json({ version }));
    app.use('/api', billsRouter);

    app.use(notFound);
    app.use(errorHandler);
    return app;
}

module.exports = { createApp };

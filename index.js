// create an express app
const express = require('express');
const dotenv = require('dotenv');
const app = express();
const cors = require('cors');
const path = require('path');

dotenv.config({ path: './config.env' });
app.use(cors({ origin: '*' }));

const PORT = process.env.PORT || 6000;

const { getElectricityBill } = require('./controllers/electricity');
const { getGasBill } = require('./controllers/gas');

app.get('/api', (req, res) => {
    res.send('Api Running');
});

app.get('/api/bill/:ref', getElectricityBill, getGasBill);

app.get('/api/pesco/:ref', (req, res) => {
    res.json({
        ref: '',
        bill_name: 'Update Required',
        units: '',
        bill_month: '',
        reading_date: '',
        current_bill: '',
        after_due_bill: '',
        due_date: '',
        remaining_days: 0
    });
});

app.get('/api/sngpl/:ref', (req, res) => {
    res.json({
        ref: '',
        bill_name: 'Update Required',
        units: '',
        bill_month: '',
        reading_date: '',
        current_bill: '',
        after_due_bill: '',
        due_date: '',
        remaining_days: 0
    });
});

app.get('/api/version', (req, res) => {
    res.json({
        versionCode: 2,
        versionName: '1.1',
        message: 'A new update is available',
        appLink: 'https://google.com',
        skipable: true
    })
});

app.use(express.static(path.join(__dirname, 'frontend/build')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
});

app.listen(PORT, () => {
    console.clear();
    console.log(`Api running on http://localhost:${PORT}`);
});

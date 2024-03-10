// routes.js
const express = require('express');
const router = express.Router();

const { getElectricityBill } = require('./controllers/electricity');
const { getGasBill } = require('./controllers/gas');
const { testFun } = require('./controllers/test');
const { getImage } = require('./controllers/sngpl-img');

router.get('/img/sngpl-:ref-:month.jpg', getImage);
router.get('/test', testFun);

router.get('/', (req, res) => {
    res.send('Api Running');
});

router.get('/bill/:ref', (req, res) => {
    const ref = req.params.ref;
    if (ref.length === 14) {
        return res.json({
            type: 'electricity',
            company: 'PESCO',
            ref: '12345678912345',
            bill_name: 'Ahmad',
            units: '31 Units',
            bill_month: 'March',
            reading_date: '3 March 2024',
            current_bill: '982',
            after_due_bill: '1100',
            due_date: '25 March 2024',
            remaining_days: 10,
            past_data: [],
            bill_data: ''
        });

    } else if (ref.length === 11) {
        return res.json({
            type: 'gas',
            company: 'SNGPL',
            ref: '12345678912',
            bill_name: 'Zain',
            units: '0.81 HM3',
            bill_month: 'March',
            reading_date: '2 March 2024',
            current_bill: '1600',
            after_due_bill: '1700',
            due_date: '24 March 2024',
            remaining_days: 10,
            past_data: [],
            bill_data: ''
        });
    }

    if (ref.length === 14) {
        getElectricityBill(req, res);
    } else if (ref.length === 11) {
        getGasBill(req, res);
    }
    else {
        res.status(400).send({
            error: 'Error occured',
            message: 'Reference no. is incorrect',
        });
    }
});

router.get('/pesco/:ref', (req, res) => {
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

router.get('/sngpl/:ref', (req, res) => {
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

router.get('/version', (req, res) => {
    res.json({
        versionCode: 3,
        versionName: '1.2',
        message: 'A new update is available!',
        appLink: 'https://www.upload-apk.com/vjcW9hqIfwJwuH9',
        skipable: false
    });
});

module.exports = router;

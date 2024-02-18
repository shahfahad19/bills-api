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
        versionCode: 2,
        versionName: '1.2',
        message: 'A new update is available!',
        appLink: 'https://github.com/shahfahad19/mybills/releases/download/app/MyBills.v1.2.apk',
        skipable: true
    });
});

module.exports = router;

// routes.js
const express = require('express');
const router = express.Router();


const { getElectricityBill } = require('./controllers/electricity');
const { getGasBill } = require('./controllers/gas');
const { testFun } = require('./controllers/test');
const { getImage } = require('./controllers/sngpl-img');
const { handleLescoBill } = require('./controllers/lescobill');
const { handleSNGPLBill } = require('./controllers/gas');

router.get('/img/sngpl-:ref-:month.jpg', getImage);
router.get('/test', testFun);

router.get('/', (req, res) => {
    res.send('Api Running');
});

router.post('/lescobill', handleLescoBill);

router.post('/sngplbill', handleSNGPLBill);

router.get('/bill/:ref', (req, res) => {
    const ref = req.params.ref;
    if (ref.length === 14) {
        const [company, url] = getCompany(ref);
        if (company === 'LESCO') {
            getLescoBill(req, res);
        }
        else {
            getElectricityBill(req, res);
        }
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

router.get('/version', (req, res) => {
    res.json({
        versionCode: 5,
        versionName: '1.3.2',
        message: 'A new update is available!\n\n⚠NOTE: Before installing the new app, copy/screenshot your existing bills and uninstall this app',
        appLink: 'https://mybillsapp.vercel.app',
        skipable: false
    });
});


const getCompany = ref => {
    var disco_code = parseInt(ref.substr(2, 2) + '000');
    var batch = parseInt(ref.substr(0, 2));

    if (disco_code === 11000) {
        return [
            'LESCO',
            'http://ccms.pitc.com.pk/ccms/duplicate_bill_lesco.php?ref=' + ref
        ]

    } else if (disco_code === 12000) {
        if (batch < 24) {
            return [
                'GEPCO',
                "https://bill.pitc.com.pk/gepcobill/general/" + ref
            ]
        } else {
            return [
                'GEPCO',
                "https://bill.pitc.com.pk/gepcobill/industrial/" + ref
            ]

        }

    } else if (disco_code === 13000) {
        if (batch < 24) {
            return [
                'FESCO',
                "https://bill.pitc.com.pk/fescobill/general/" + ref
            ]
        } else {
            return [
                'FESCO',
                "https://bill.pitc.com.pk/fescobill/industrial/" + ref
            ]
        }

    } else if (disco_code === 14000) {
        if (batch < 24) {
            return [
                'IESCO',
                "https://bill.pitc.com.pk/iescobill/general/" + ref
            ]
        } else {
            return [
                'IESCO',
                "https://bill.pitc.com.pk/iescobill/industrial/" + ref
            ]
        }

    } else if (disco_code === 15000) {
        if (batch < 24) {
            return [
                'MEPCO',
                "https://bill.pitc.com.pk/mepcobill/general/" + ref
            ]
        } else {
            return [
                'MEPCO',
                "https://bill.pitc.com.pk/mepcobill/industrial/" + ref
            ]
        }


    } else if (disco_code === 26000) {

        if (batch < 24) {
            return [
                'PESCO',
                "https://bill.pitc.com.pk/pescobill/general/" + ref
            ]
        } else {
            return [
                'PESCO',
                "https://bill.pitc.com.pk/pescobill/industrial/" + ref
            ]
        }

    } else if (disco_code === 37000) {
        if (batch < 24) {
            return [
                'HESCO',
                "https://bill.pitc.com.pk/hescobill/general/" + ref
            ]
        } else {
            return [
                'HESCO',
                "https://bill.pitc.com.pk/hescobill/industrial/" + ref
            ]
        }

    } else if (disco_code === 38000) {
        if (batch < 24) {
            return [
                'SEPCO',
                "https://bill.pitc.com.pk/sepcobill/general/" + ref
            ]
        } else {
            return [
                'SEPCO',
                "https://bill.pitc.com.pk/sepcobill/industrial/" + ref
            ]
        }
    } else {
        if (batch < 24) {
            return [
                'QESCO',
                "https://bill.pitc.com.pk/qescobill/general/" + ref
            ]
        } else {
            return [
                'QESCO',
                "https://bill.pitc.com.pk/qescobill/industrial/" + ref
            ]
        }
    }
}

module.exports = router;

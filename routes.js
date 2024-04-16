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




router.get('/lescobill', (req, res) => {
    req.body.data = `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`;
    handleSNGPLBill(req, res);
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
        versionCode: 3,
        versionName: '1.2',
        message: 'A new update is available!',
        appLink: 'https://www.upload-apk.com/vjcW9hqIfwJwuH9',
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

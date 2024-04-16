// routes.js
const express = require('express');
const router = express.Router();


const { getElectricityBill } = require('./controllers/electricity');
const { getGasBill } = require('./controllers/gas');
const { getImage } = require('./controllers/sngpl-img');
const { handleLescoBill } = require('./controllers/lescobill');
const { handleSNGPLBill } = require('./controllers/gas');

router.get('/img/sngpl-:ref-:month.jpg', getImage);

router.get('/', (req, res) => {
    res.send('Api Running');
});




router.get('/lescobill', (req, res) => {
    if (req.query.admin === '1') {
        req.body.data = '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';
        handleLescoBill(req, res);
    }
    else {
        res.send("Request denied")
    }
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

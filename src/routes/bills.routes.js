const express = require('express');
const { getBill, getSngplImage, parseSubmittedBill } = require('../controllers/bills.controller');

const router = express.Router();

router.get('/bill/:reference', getBill);
router.post('/bills/parse', parseSubmittedBill());
router.get('/img/sngpl-:reference(\\d{11})-:month(\\d{6}).jpg', getSngplImage);

// Backward-compatible app endpoints. New clients should use /bills/parse.
router.post('/elecbill', parseSubmittedBill('electricity'));
router.post('/lescobill', parseSubmittedBill('electricity'));
router.post('/sngplbill', parseSubmittedBill('gas'));

module.exports = router;

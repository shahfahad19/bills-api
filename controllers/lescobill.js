const http = require('http');
const cheerio = require('cheerio');
const zlib = require('zlib');

exports.getLescoBill = async (req, res, next) => {
    const refno = req.params.ref;
    const reference = convertStringToObject(refno);

    const mainURL = 'http://www.lesco.gov.pk:36269/Modules/CustomerBill/CustomerMenu.asp';
    const captchaURL = 'http://www.lesco.gov.pk:36269/Modules/CustomerBill/codeimage.asp';
    const billURL = "http://www.lesco.gov.pk:36247/Bill.aspx";
    let headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'http://www.lesco.gov.pk:36269',
        'Referer': 'http://www.lesco.gov.pk:36269/Modules/CustomerBill/CheckBill.asp',
        'Connection': 'keep-alive'
    };

    const formData = new URLSearchParams();
    formData.append('txtBatchNo', reference.batch);
    formData.append('txtSubDiv', reference.subDiv);
    formData.append('txtRefNo', reference.refNo);
    formData.append('cmbRU', reference.ru);
    formData.append('btnViewMenu', 'Customer Menu');

    const billFormData = new URLSearchParams();
    billFormData.append('BatchNo', reference.batch);
    billFormData.append('SubDiv', reference.subDiv);
    billFormData.append('RefNo', reference.refNo);
    billFormData.append('RU', reference.ru);

    try {
        // Main Request
        const mainOptions = {
            method: 'POST',
            headers: headers
        };

        const mainReq = http.request(mainURL, mainOptions, async (mainRes) => {
            let data = '';

            mainRes.on('data', (chunk) => {
                data += chunk;
            });

            mainRes.on('end', async () => {
                const cookies = mainRes.headers['set-cookie'];
                const cookieValue = cookies[0].split(';')[0];
                headers.Cookie = cookieValue;

                const captchaHeaders = {
                    Cookie: cookieValue
                };

                res.send(cookieValue);

            });
        });

        mainReq.on('error', (error) => {
            // Handle main request error
        });

        mainReq.write(formData.toString());
        mainReq.end();

    } catch (error) {
        return res.status(500).send({
            error: 'Error occurred',
            message: error.message,
            err: error,
        });
    }
};

const compressText = (text) => {
    const compressedData = zlib.deflateSync(Buffer.from(text, 'utf8'));
    return compressedData.toString('base64');
}

const convertDate = date => {
    return new Date(date + " UTC").toLocaleDateString('en-PK', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function convertStringToObject(str) {
    let batch, subDiv, refNo, ru;

    if (str.length >= 15) {
        batch = str.substring(0, 2);
        subDiv = str.substring(2, 7);
        refNo = str.substring(7, 14);
        ru = str.substring(14);
    } else {
        batch = str.substring(0, 2);
        subDiv = str.substring(2, 7);
        refNo = str.substring(7);
        ru = "U";
    }

    return {
        batch: batch,
        subDiv: subDiv,
        refNo: refNo,
        ru: ru
    };
}

function abbrvToName(dateStr) {
    const monthMap = {
        'JAN': 'January',
        'FEB': 'February',
        'MAR': 'March',
        'APR': 'April',
        'MAY': 'May',
        'JUN': 'June',
        'JUL': 'July',
        'AUG': 'August',
        'SEP': 'September',
        'OCT': 'October',
        'NOV': 'November',
        'DEC': 'December'
    };

    const regex = /^([a-zA-Z]{3})/;
    const match = dateStr.match(regex);
    if (match) {
        const monthAbbreviation = match[1].toUpperCase();
        return monthMap[monthAbbreviation];
    } else {
        return "Invalid date format";
    }
}

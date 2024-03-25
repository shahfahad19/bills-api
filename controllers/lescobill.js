const axios = require('axios');
const cheerio = require('cheerio');
const zlib = require('zlib');
const puppeteer = require('puppeteer');

exports.getLescoBill = async (req, res, next) => {
    if (!req.query.admin) {
        return res.status(400).send({
            error: 'Error occured',
            message: 'LESCO bills are not supported yet!'
        });
    }
    const refno = req.params.ref;
    const reference = convertStringToObject(refno);

    const mainURL = 'http://www.lesco.gov.pk:36269/Modules/CustomerBill/CustomerMenu.asp';
    const captchaURL = 'http://www.lesco.gov.pk:36269/Modules/CustomerBill/codeimage.asp';
    const billURL = "http://www.lesco.gov.pk:36247/Bill.aspx";
    let headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    };

    /* Form data for first request */
    const formData = new URLSearchParams();
    formData.append('txtBatchNo', reference.batch);
    formData.append('txtSubDiv', reference.subDiv);
    formData.append('txtRefNo', reference.refNo);
    formData.append('cmbRU', reference.ru);
    formData.append('btnViewMenu', 'Customer Menu');

    /* Form data for bill */
    const billFormData = new URLSearchParams();
    billFormData.append('BatchNo', reference.batch);
    billFormData.append('SubDiv', reference.subDiv);
    billFormData.append('RefNo', reference.refNo);
    billFormData.append('RU', reference.ru);

    try {

        // // Main Request
        // const response = await axios.post(mainURL, formData, headers, { maxRedirects: 0 });
        // const cookies = response.headers['set-cookie'];
        // const cookieValue = cookies[0].split(';')[0];
        // headers.Cookie = cookieValue;

        // const captchaHeaders = {
        //     Cookie: cookieValue
        // };

        // let codeValue = "";

        // try {
        //     await axios.get(captchaURL, { headers: captchaHeaders, maxRedirects: 0 });
        // } catch (error) {
        //     const urlString = error.response.headers.location;
        //     const startIdx = urlString.indexOf("code=") + 5;
        //     const endIdx = urlString.indexOf("&", startIdx);

        //     codeValue = urlString.substring(startIdx, endIdx);
        // }



        // delete headers.Cookie;
        billFormData.append('CapCode', 'LTCK');
        const billResponse = await axios.post(billURL, billFormData, headers);

        let bill = billResponse.data;

        // bill = bill.replaceAll('href="./', 'href="http://www.lesco.gov.pk:36247/');
        // bill = bill.replaceAll('src="./', 'src="http://www.lesco.gov.pk:36247/');
        bill = bill.replaceAll('src="Ima', 'src="http://www.lesco.gov.pk:36247/Ima');
        bill = bill.replaceAll('src="js', 'src="http://www.lesco.gov.pk:36247/js');
        const $ = cheerio.load(bill);
        let billHtml = $('#page1-div').html();
        billHtml = `<div id="page1 - div" style="position: relative; width: 885px; height: 1248px; margin: 0 auto; ">${billHtml}</div>`;
        bill = bill.replace(/<form[^>]*>[\s\S]*?<\/form>/gi, billHtml);
        bill = bill.replace(/<link[^>]*>[\s\S]*?\/>/gi, '');

        const billName = $('#page1-div > table:nth-child(29) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(1)').text().trim();
        const units = $("p.ft13:nth-child(34)").text().trim();
        const billMonth = $("p.ft14:nth-child(13) > b:nth-child(1)").text();
        const currentBill = $('p.ft14:nth-child(158) > b:nth-child(1)').text();
        const afterDueDateBill = $('p.ft14:nth-child(159) > b:nth-child(1)').text();
        const dueDate = $('p.ft14:nth-child(155)').text();


        const billDetails = {
            type: 'electricity',
            company: 'LESCO',
            ref: refno.replaceAll(' ', ''),
            bill_name: billName,
            units: units + ' Units',
            bill_month: abbrvToName(billMonth),
            reading_date: 'N/A',
            current_bill: currentBill,
            after_due_bill: afterDueDateBill,
            due_date: convertDate(dueDate),
            remaining_days: 0,
            past_data: [],
            bill_data: compressText(bill.replace(/\s+/g, ' '))
        };

        if (billName === '') {
            return res.status(400).send({
                error: 'Error occured',
                message: 'Bill not found'
            });
        }
        res.send(billDetails);


    } catch (error) {
        return res.status(500).send({
            error: 'Error occured',
            message: error.message,
            err: error,
        });
    }
};


exports.handleLescoBill = async (req, res) => {
    // let bill = req.body.data;
    const res_query = req.query.res;

    if (req.body && req.body.data) {


        let bill_data = req.body.data;
        let bill = decompressText(bill_data);
        let host = process.env.HOST;

        bill = bill.replaceAll('src="Images/BLANK_NEW BILL.png"', `src="${host}/file/lesco.png"`);
        const $ = cheerio.load(bill);
        let billHtml = $('#page1-div').html();
        billHtml = `<div id="page1 - div" style="position: relative; width: 885px; height: 1248px; ">${billHtml}</div>`;
        bill = bill.replace(/<form[^>]*>[\s\S]*?<\/form>/gi, billHtml);
        bill = bill.replace(/<link[^>]*>[\s\S]*?\/>/gi, '');
        bill = bill.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
        // bill = bill.replace(`<meta content="width=device-width, initial-scale=1" name="viewport" />`, '');
        bill = bill.replace("</body>", `
        <script src="${host}/file/lesco.js"></script>
    </body>`);
        bill = bill.replace(`<body bgcolor="#FFFFFF" vlink="blue" link="blue" style="width: 880px;">`, `<body>`);
        bill = bill.replace(`<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />`, `<meta charset="utf-16" />`);
        bill = bill.replace(`<meta content="width=device-width, initial-scale=1" name="viewport" />`, `<meta name="viewport" content="width=device-width, initial-scale=1">`);
        bill = bill.replace(`<div id="page1 - div" style="position: relative; width: 885px; height: 1248px; ">`, `<div style="position: relative; width: 885px; margin: 0 auto; ">`);

        const refNo = $("p.ft14:nth-child(16) > b:nth-child(1)").text().trim().replaceAll(" ", "").substring(0, 14);
        const billName = $('#page1-div > table:nth-child(29) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(1)').text().trim();
        const units = $("p.ft13:nth-child(34)").text().trim();
        const billMonth = $("p.ft14:nth-child(13) > b:nth-child(1)").text().trim();
        const currentBill = $('p.ft14:nth-child(158) > b:nth-child(1)').text().trim();
        const afterDueDateBill = $('p.ft14:nth-child(159) > b:nth-child(1)').text().trim();
        const dueDate = $('p.ft14:nth-child(155)').text().trim();


        if (res_query === 'bill') {
            res.send(bill);
        }
        else {
            bill_data = compressText(bill);

            const billDetails = {
                type: 'electricity',
                company: 'LESCO',
                ref: refNo,
                bill_name: billName,
                units: units + ' Units',
                bill_month: "March",
                reading_date: 'N/A',
                current_bill: "2832",
                after_due_bill: afterDueDateBill,
                due_date: convertDate(dueDate),
                remaining_days: 0,
                past_data: [],
                bill_data
            };

            if (billName === '') {
                return res.status(400).send({
                    error: 'Error occured',
                    message: 'Bill not found'
                });
            }
            res.send(billDetails);
        }


    }
    else {
        return res.status(400).send({
            error: 'Error occured',
            message: 'Something went wrong with this request'
        });
    }
};

const decompressText = (compressedData) => {
    const buffer = Buffer.from(compressedData, 'base64');
    const decompressedData = zlib.inflateSync(buffer).toString('utf8');
    return decompressedData;
}

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

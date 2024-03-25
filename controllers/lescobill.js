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


exports.handleLescoBill = async (req, res, next) => {
    // let bill = req.body.data;
    const res_query = req.query.res;

    if (req.body && req.body.data) {


        let bill_data = req.body.data;
        // bill_data = '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';
        let bill = decompressText(bill_data);
        let host = process.env.HOST;

        // bill = bill.replaceAll('href="./', 'href="http://www.lesco.gov.pk:36247/');
        bill = bill.replaceAll('src="Images/BLANK_NEW BILL.png"', `src="${host}/file/lesco.png"`);
        bill = bill.replace('js/dist/index.js', `${host}/file/lesco.js`)
        const $ = cheerio.load(bill);
        let billHtml = $('#page1-div').html();
        billHtml = `<div id="page1 - div" style="position: relative; width: 885px; height: 1248px; margin: 0 auto; ">${billHtml}</div>`;
        bill = bill.replace(/<form[^>]*>[\s\S]*?<\/form>/gi, billHtml);
        bill = bill.replace(/<link[^>]*>[\s\S]*?\/>/gi, '');

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
                bill_month: abbrvToName(billMonth),
                reading_date: 'N/A',
                current_bill: currentBill,
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

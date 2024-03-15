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

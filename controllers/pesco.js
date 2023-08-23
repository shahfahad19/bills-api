const axios = require('axios');
const querystring = require('querystring');
const cheerio = require('cheerio');

const homeurl = 'https://bill.pitc.com.pk';

exports.getPescoBill = async (req, res) => {
    const refno = req.params.ref;
    const res_query = req.query.res;

    if (refno.length !== 14) return res.status(400).send('Ref no is not correct');

    const url = `https://bill.pitc.com.pk/pescobill/general?refno=${refno}`;

    const postData = {
        __VIEWSTATE:
            'QSEiEVfpqZii7qYaEhVbokrMp1Z9qaCQPE6o38WSc3S4RddRwyXMRFoCXdaHsXj0hsdRNfLnO2k7MqCsXjxMfWpwydafhMFDacOhNngKZ50=',
        __VIEWSTATEGENERATOR: '34C80342',
        __EVENTVALIDATION:
            'ofpfBWT6cIlNaEzH1sD05E2LwL+QsjCQ0ngZy6Yg3LWjC6GPS9EWKdUZMSEmSXdk/H72IVLd5HgduGx0dmU57BrC4EQe5ClfR2YWup0Av0dQr5Ni2kWXGXuTIvKZyPZd',
        id_btn_print: 'Print Bill',
    };

    try {
        const response = await axios.post(url, querystring.stringify(postData), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        let updatedResponse = response.data.replace(/<div[^>]+class="noprint">.*?<\/div>/is, '');
        updatedResponse = updatedResponse.replace(/<noscript>.*?<\/noscript>/is, '');
        updatedResponse = updatedResponse.replace(/src="\//g, `src="${homeurl}/`);
        updatedResponse = updatedResponse.replace(/href="\//g, `href="${homeurl}/`);
        updatedResponse = updatedResponse.replace(/action="\.\//g, `action="${homeurl}/pescobill/`);

        const $ = cheerio.load(updatedResponse);

        const currentBill = $(
            'body > div > div.headertable.fontsize > div:nth-child(4) > table > tbody > tr:nth-child(1) > td.border-b.border-t.border-r.content'
        )
            .text()
            .trim();

        const afterDueDateBill = $(
            'body > div > div.headertable.fontsize > div:nth-child(4) > table > tbody > tr:nth-child(2) > td.font-size.border-rb.border-r.content'
        )
            .text()
            .trim();

        const dueDate = $(
            'body > div > div.headertable.fontsize > div:nth-child(4) > table > tbody > tr:nth-child(2) > td:nth-child(2)'
        )
            .text()
            .trim();

        const billName = $(
            'body > div > table:nth-child(5) > tbody > tr > td.border-r > table > tbody > tr:nth-child(2) > td:nth-child(1) > p > span:nth-child(3)'
        )
            .text()
            .trim();

        const units = $(
            'body > div > table:nth-child(5) > tbody > tr > td.border-r > table > tbody > tr.content > td:nth-child(5)'
        )
            .text()
            .trim();

        const billMonth = $(
            'body > div > div.headertable.fontsize > div:nth-child(4) > table > tbody > tr:nth-child(2) > td:nth-child(1)'
        )
            .text()
            .trim();

        const readingDate = $('body > div > table:nth-child(2) > tbody > tr.content > td:nth-child(5)').text().trim();

        const billDetails = {
            bill_name: billName,
            units: units,
            bill_month: billMonth,
            reading_date: readingDate,
            current_bill: currentBill,
            after_due_bill: afterDueDateBill,
            due_date: dueDate,
        };

        if (res_query === 'bill') {
            res.status(200).send(updatedResponse);
        } else res.status(200).json(billDetails);
    } catch (error) {
        console.error('Axios Error:', error.message);
        res.status(500).send('An error occurred.');
    }
};

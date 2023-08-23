const axios = require('axios');
const querystring = require('querystring');
const cheerio = require('cheerio');

const homeurl = 'https://www.sngpl.com.pk';

exports.getSngplBill = async (req, res) => {
    const refno = req.params.ref;
    const res_query = req.query.res;

    if (refno.length !== 11) return res.status(400).send('Ref no is not correct');

    const url = `${homeurl}/viewbill?proc=viewbill&client=ANDROID&contype=NewCon&consumer=${refno}`;

    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const currentBill = $(
            'body > div > div > table > tbody > tr:nth-child(8) > td > table > tbody > tr > td:nth-child(2) > table > tbody > tr.txt-bld > td:nth-child(1)'
        )
            .text()
            .trim();

        const afterDueDateBill = $(
            'body > div > div > table > tbody > tr:nth-child(8) > td > table > tbody > tr > td:nth-child(2) > table > tbody > tr.txt-bld > td:nth-child(2)'
        )
            .text()
            .trim();

        const billName = $(
            'body > div > div > table > tbody > tr:nth-child(2) > td > table > tbody > tr > td:nth-child(1) > table:nth-child(1) > tbody > tr:nth-child(1) > td.data-td-en.bdr-bt'
        )
            .text()
            .trim();
        const billMonth = $(
            'body > div > div > table > tbody > tr:nth-child(2) > td > table > tbody > tr > td:nth-child(2) > table > tbody > tr:nth-child(2) > td.txt-ct'
        )
            .text()
            .trim();

        const dueDate = $(
            'body > div > div > table > tbody > tr:nth-child(8) > td > table > tbody > tr > td:nth-child(2) > table > tbody > tr.txt-bld > td:nth-child(3)'
        )
            .text()
            .trim();

        const readingDate = $(
            'body > div > div > table > tbody > tr:nth-child(3) > td > table > tbody > tr > td:nth-child(1) > table:nth-child(2) > tbody > tr:nth-child(5) > td.txt-ct'
        )
            .text()
            .trim();
        // const currentBill = $().text().trim();

        // const currentBill = $().text().trim();

        const billDetails = {
            bill_name: billName,
            bill_month: billMonth,
            reading_date: readingDate,
            current_bill: currentBill,
            after_due_bill: afterDueDateBill,
            due_date: dueDate,
        };

        if (currentBill === '')
            res.status(404).json({
                message: 'Bill not found',
            });

        if (res_query === 'bill') {
            res.status(200).send(billIframe(url));
        } else res.status(200).json(billDetails);
    } catch (error) {
        console.error('Axios Error:', error.message);
        res.status(500).send('An error occurred.');
    }
};

const billIframe = (url) => {
    return `
    <html>
        <head>
            <title>SNGPL BILL</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body {
                    margin: 0px;
                }

                iframe {
                    width: 100vw;
                    height: 100vh;
                }

                ::-webkit-scrollbar {
                    width: 0px;
                    height: 0px;
                }

                ::-webkit-scrollbar-track {
                    background-color: transparent;
                    width: 0px;
                    height: 0px;
                }

                ::-webkit-scrollbar-thumb {
                    background-color: rgba(0, 0, 0, 0);
                    border-radius: 0px;
                    width: 0px;
                    height: 0px;
                }
            </style>
        </head>
        <body>
            <iframe src="${url}"></iframe>
        </body>
    </html>
    `;
};

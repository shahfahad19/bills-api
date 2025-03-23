const axios = require('axios');
const cheerio = require('cheerio');
const zlib = require('zlib');

const homeurl = 'https://www.sngpl.com.pk';

exports.getGasBill = async (req, res) => {
    const refno = req.params.ref;
    const res_query = req.query.res;
    const file_type = req.query.file;

    if (refno.length !== 11) return res.status(400).json({
        message: 'Ref no is not correct'
    });

    const url = `${homeurl}/viewbill?proc=viewbill&client=ANDROID&contype=NewCon&consumer=${refno}`;

    try {
        const response = await axios.get(url);
        if (response.data.length < 5000) {
            res.status(400).send({
                error: 'Error occured',
                message: 'Bill not found'
            });
        }

        let updatedResponse = response.data;
        updatedResponse = updatedResponse.replace(/href='print/g, `href='${homeurl}/print`);
        updatedResponse = updatedResponse.replace(/src='..\//g, `src='${homeurl}/`);
        updatedResponse = updatedResponse.replace(`style='p`, `style='margin:0 auto; p`);
        updatedResponse = updatedResponse.replace(
            /https:\/\/www\.sngpl\.com\.pk\/imageservlet\?consumer=(\d+)&billmon=(\d+)/g,
            process.env.HOST + '/api/img/sngpl-$1-$2.jpg'
        );
        // updatedResponse = updatedResponse.replace(`body{font-family: sans-serif;}`, `body{font-family: sans-serif;margin:0;}table {border-collapse:collapse;border-spacing:0;}td,th{padding: 0;}`);
        // updatedResponse = updatedResponse.replace(/<link.*.css'>/g, ``);
        updatedResponse = updatedResponse.replace(`<link rel='stylesheet' href='https://www.sngpl.com.pk/print-css/paper.css'>`, `<style>.sheet,body{margin:0}@page{margin:0}.sheet{position:relative;box-sizing:border-box;page-break-after:always}body.A3 .sheet{width:297mm;height:419mm}body.A3.landscape .sheet{width:420mm;height:296mm}body.A4 .sheet{width:210mm;height:296mm}body.A4.landscape .sheet{width:297mm;height:209mm}body.A5 .sheet{width:148mm;height:209mm}body.A5.landscape .sheet{width:210mm;height:147mm}.sheet.padding-10mm{padding:10mm}.sheet.padding-15mm{padding:15mm}.sheet.padding-20mm{padding:20mm}.sheet.padding-25mm{padding:25mm}@media screen{.sheet{background:#fff;box-shadow:0 .5mm 2mm rgba(0,0,0,.3)}}</style>`);
        updatedResponse = updatedResponse.replace(`<meta http-equiv='Content-Type' content='text/html; charset=utf-8' />`, `<meta charset="utf-16" /><meta name="viewport" content="width=device-width, initial-scale=1">`);
        updatedResponse = updatedResponse.replace(`<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">`, `<!DOCTYPE html>`);
        updatedResponse = updatedResponse.replaceAll(`'class`, `' class`);

        const $ = cheerio.load(response.data);

        const rows = $('.sheet > div:nth-child(2) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(4) > td:nth-child(2) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(3) > td:nth-child(1) > table:nth-child(1) > tbody:nth-child(1)').find('tr');

        const pastData = [];

        rows.each(function () {
            const month = $(this).find('td:first-child').text().trim();
            const unit = $(this).find('td:nth-child(2)').text().trim();
            if (month !== '') {
                pastData.push({
                    month,
                    units: unit
                })
            }

        });

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
        let billMonth = $(
            'body > div > div > table > tbody > tr:nth-child(2) > td > table > tbody > tr > td:nth-child(2) > table > tbody > tr:nth-child(2) > td.txt-ct'
        )
            .text()
            .trim();

        const [monthAbbreviation, year] = billMonth.split(' ');

        // Convert the month abbreviation to the full month name
        const monthFullName = new Date(`${monthAbbreviation} 1, ${year}`).toLocaleString('en-US', { month: 'long' });

        const months = [
            'January', 'February', 'March', 'April',
            'May', 'June', 'July', 'August',
            'September', 'October', 'November', 'December'
        ];

        const index = months.indexOf(monthFullName);
        billMonth = months[(index + 1) % 12];

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


        const units = $(
            '.sheet > div:nth-child(2) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(3) > td:nth-child(1) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(1) > table:nth-child(2) > tbody:nth-child(1) > tr:nth-child(4) > td:nth-child(5)'
        )
            .text()
            .trim();

        if (res_query === 'bill') {
            return res.status(200).send(updatedResponse);
        }
        else if (res_query === 'download') {
            //const browser = await puppeteer.connect({
            //     browserWSEndpoint: `wss://chrome.browserless.io?token=e39874c2-d422-4520-a91a-12d596b382e3`,
            // });

            const browser = await puppeteer.launch({
                args: ['--no-sandbox']
            });
            const page = await browser.newPage();
            await page.setContent(updatedResponse);


            if (file_type === 'pdf') {
                const pdfBuffer = await page.pdf({ format: 'A3' });
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=${company}_bill_${billMonth}_${refno}.pdf`);
                res.send(pdfBuffer);
            } else {
                await page.setViewport({ width: 400, height: 600 });
                const screenshotBuffer = await page.screenshot({
                    fullPage: true,
                });
                res.setHeader('Content-Type', 'image/png');
                res.setHeader('Content-Disposition', `attachment; filename=${company}_bill_${billMonth}_${refno}.png`);
                res.send(screenshotBuffer);
            }

            await browser.close();

        }


        else {
            const givenDateParts = dueDate.split('-');
            const givenDate = new Date(`${givenDateParts[2]}-${givenDateParts[1]}-${givenDateParts[0]} UTC`);
            const currentDate = new Date();
            const timeDifference = givenDate.getTime() - currentDate.getTime();
            const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));
            const billDetails = {
                type: 'gas',
                company: 'SNGPL',
                ref: refno,
                bill_name: billName,
                units: units + ' HM3',
                bill_month: billMonth,
                reading_date: convertDate(readingDate),
                current_bill: currentBill.replaceAll(',', ''),
                after_due_bill: afterDueDateBill.replaceAll(',', ''),
                due_date: convertDate(dueDate),
                remaining_days: daysDifference,
                past_data: pastData,
                bill_data: compressText(updatedResponse.replace(/\s+/g, ' ')),
            };


            res.status(200).json(billDetails);
        }
    } catch (error) {
        res.status(500).send({
            error: 'Error occured',
            message: error.message,
            err: error,
        });
    }
};




exports.handleSNGPLBill = async (req, res) => {
    const res_query = req.query.res;

    if (req.body && req.body.data) {
        if (req.body && req.body.data) {


            let bill_data = req.body.data;
            let updatedResponse = decompressText(bill_data);


            updatedResponse = updatedResponse.replace(/href='print/g, `href='${homeurl}/print`);
            updatedResponse = updatedResponse.replace(/src='..\//g, `src='${homeurl}/`);
            updatedResponse = updatedResponse.replace(`style='p`, `style='margin:0 auto; p`);
            // updatedResponse = updatedResponse.replace(
            //     /https:\/\/www\.sngpl\.com\.pk\/imageservlet\?consumer=(\d+)&billmon=(\d+)/g,
            //     process.env.HOST + '/api/img/sngpl-$1-$2.jpg'
            // );
            // updatedResponse = updatedResponse.replace(`body{font-family: sans-serif;}`, `body{font-family: sans-serif;margin:0;}table {border-collapse:collapse;border-spacing:0;}td,th{padding: 0;}`);
            // updatedResponse = updatedResponse.replace(/<link.*.css'>/g, ``);
            updatedResponse = updatedResponse.replace(`<link rel='stylesheet' href='https://www.sngpl.com.pk/print-css/paper.css'>`, `<style>.sheet,body{margin:0}@page{margin:0}.sheet{position:relative;box-sizing:border-box;page-break-after:always}body.A3 .sheet{width:297mm;height:419mm}body.A3.landscape .sheet{width:420mm;height:296mm}body.A4 .sheet{width:210mm;height:296mm}body.A4.landscape .sheet{width:297mm;height:209mm}body.A5 .sheet{width:148mm;height:209mm}body.A5.landscape .sheet{width:210mm;height:147mm}.sheet.padding-10mm{padding:10mm}.sheet.padding-15mm{padding:15mm}.sheet.padding-20mm{padding:20mm}.sheet.padding-25mm{padding:25mm}@media screen{.sheet{background:#fff;box-shadow:0 .5mm 2mm rgba(0,0,0,.3)}}</style>`);
            updatedResponse = updatedResponse.replace(`<meta http-equiv='Content-Type' content='text/html; charset=utf-8' />`, `<meta charset="utf-16" /><meta name="viewport" content="width=device-width, initial-scale=1">`);
            updatedResponse = updatedResponse.replace(`<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">`, `<!DOCTYPE html>`);
            updatedResponse = updatedResponse.replaceAll(`'class`, `' class`);

            const $ = cheerio.load(updatedResponse);

            const rows = $('.sheet > div:nth-child(2) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(4) > td:nth-child(2) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(3) > td:nth-child(1) > table:nth-child(1) > tbody:nth-child(1)').find('tr');

            const pastData = [];

            rows.each(function () {
                const month = $(this).find('td:first-child').text().trim();
                const unit = $(this).find('td:nth-child(2)').text().trim();
                if (month !== '') {
                    pastData.push({
                        month,
                        units: unit
                    })
                }

            });

            const refno = $("tr.bdr-bt:nth-child(1) > td:nth-child(2)").text().trim();

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
            let billMonth = $(
                'body > div > div > table > tbody > tr:nth-child(2) > td > table > tbody > tr > td:nth-child(2) > table > tbody > tr:nth-child(2) > td.txt-ct'
            )
                .text()
                .trim();

            const [monthAbbreviation, year] = billMonth.split(' ');

            // Convert the month abbreviation to the full month name
            const monthFullName = new Date(`${monthAbbreviation} 1, ${year}`).toLocaleString('en-US', { month: 'long' });

            const months = [
                'January', 'February', 'March', 'April',
                'May', 'June', 'July', 'August',
                'September', 'October', 'November', 'December'
            ];

            const index = months.indexOf(monthFullName);
            billMonth = months[(index + 1) % 12];

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


            const units = $(
                '.sheet > div:nth-child(2) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(3) > td:nth-child(1) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(1) > table:nth-child(2) > tbody:nth-child(1) > tr:nth-child(4) > td:nth-child(5)'
            )
                .text()
                .trim();

            if (res_query === 'bill') {
                return res.status(200).send(updatedResponse);
            }

            else {
                const givenDateParts = dueDate.split('-');
                const givenDate = new Date(`${givenDateParts[2]}-${givenDateParts[1]}-${givenDateParts[0]} UTC`);
                const currentDate = new Date();
                const timeDifference = givenDate.getTime() - currentDate.getTime();
                const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));
                const billDetails = {
                    type: 'gas',
                    company: 'SNGPL',
                    ref: refno,
                    bill_name: billName,
                    units: units + ' HM3',
                    bill_month: billMonth,
                    reading_date: convertDate(readingDate),
                    current_bill: currentBill.replaceAll(',', ''),
                    after_due_bill: afterDueDateBill.replaceAll(',', ''),
                    paid: false,
                    due_date: convertDate(dueDate),
                    remaining_days: daysDifference,
                    past_data: pastData,
                    bill_data: compressText(updatedResponse.replace(/\s+/g, ' '))
                };
                res.status(200).json(billDetails);
            }
        }
        else {
            return res.status(400).send({
                error: 'Error occured',
                message: 'Something went wrong with this request'
            });
        }

    }


};

const billIframe = (url) => {
    return `
    <html>
        <head>
            <title>SNGPL BILL</title>
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


const convertDate = date => {
    const dateParts = date.split('-');
    const convertedDate = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]} UTC`);

    // Format the due_date to "dd month, yyyy"
    return convertedDate.toLocaleDateString('en-PK', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}


const compressText = (text) => {
    const compressedData = zlib.deflateSync(Buffer.from(text, 'utf8'));
    return compressedData.toString('base64');
}

const decompressText = (compressedData) => {
    const buffer = Buffer.from(compressedData, 'base64');
    const decompressedData = zlib.inflateSync(buffer).toString('utf8');
    return decompressedData;
}

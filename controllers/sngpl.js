const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-core');

const homeurl = 'https://www.sngpl.com.pk';

exports.getSngplBill = async (req, res) => {
    const refno = req.params.ref;
    const res_query = req.query.res;
    const file_type = req.query.file;

    if (refno.length !== 11) return res.status(400).json({
        message: 'Ref no is not correct'
    });

    const url = `${homeurl}/viewbill?proc=viewbill&client=ANDROID&contype=NewCon&consumer=${refno}`;

    try {
        const response = await axios.get(url);

        let updatedResponse = response.data;
        updatedResponse = updatedResponse.replace(/href='print/g, `href='${homeurl}/print`);
        updatedResponse = updatedResponse.replace(/src='..\//g, `src='${homeurl}/`);

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

        if (res_query === 'download') {
            const browser = await puppeteer.connect({
                browserWSEndpoint: `wss://chrome.browserless.io?token=e39874c2-d422-4520-a91a-12d596b382e3`,
            });
            const page = await browser.newPage();
            await page.setContent(updatedResponse);

            if (file_type === 'pdf') {
                // Set the HTML content to the updatedResponse
                // Generate the PDF
                const pdfBuffer = await page.pdf({ format: 'A4' });
                // Close the browser
                await browser.close();
                // Send the PDF as a download attachment
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=Bill_${billMonth}_${refno}.pdf`);
                return res.send(pdfBuffer);
            } else {
                // Set the HTML content to the updatedResponse
                // Adjust viewport size to capture full content
                await page.setViewport({ width: 400, height: 600 }); // Adjust dimensions as needed

                // Capture a screenshot of the full page
                const screenshotBuffer = await page.screenshot({
                    fullPage: true, // Capture the entire page, including scrolling
                });
                // Close the browser
                await browser.close();

                // Send the image as a download attachment
                res.setHeader('Content-Type', 'image/png');
                res.setHeader('Content-Disposition', `attachment; filename=Bill_${billMonth}_${refno}.png`);
                res.send(screenshotBuffer);
            }
        }


        const givenDateParts = dueDate.split('-');
        const givenDate = new Date(`${givenDateParts[2]}-${givenDateParts[1]}-${givenDateParts[0]} UTC`);

        // Get the current date
        const currentDate = new Date();

        // Calculate the difference in milliseconds
        const timeDifference = givenDate.getTime() - currentDate.getTime();

        // Convert the difference to days
        const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));


        const billDetails = {
            bill_name: billName,
            units: "0",
            bill_month: billMonth,
            reading_date: convertDate(readingDate),
            current_bill: currentBill,
            after_due_bill: afterDueDateBill,
            due_date: convertDate(dueDate),
            remaining_days: daysDifference
        };

        if (currentBill === '')
            res.status(404).json({
                message: 'Bill not found',
            });

        if (res_query === 'bill') {
            res.status(200).send(billIframe(url));
        } else res.status(200).json(billDetails);
    } catch (error) {
        res.status(500).send({
            error: 'Error occured',
            message: error.message,
            err: error,
        });
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
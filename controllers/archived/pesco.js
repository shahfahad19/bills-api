const axios = require('axios');
const querystring = require('querystring');
const cheerio = require('cheerio');

const homeurl = 'https://bill.pitc.com.pk';

exports.getPescoBill = async (req, res) => {
    const refno = req.params.ref;
    const res_query = req.query.res;
    const file_type = req.query.file;

    if (refno.length !== 14) return res.status(400).json({
        message: 'Ref no is not correct'
    });

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
		updatedResponse = updatedResponse.replace('http://snap','https://snap');
        const $ = cheerio.load(updatedResponse);


        let billMonth = $(
            'body > div > div.headertable.fontsize > div:nth-child(4) > table > tbody > tr:nth-child(2) > td:nth-child(1)'
        )
            .text()
            .trim();

        const [monthAbbreviation, year] = billMonth.split(' ');

        // Convert the month abbreviation to the full month name
        const monthFullName = new Date(`${monthAbbreviation} 1, ${year}`).toLocaleString('en-US', { month: 'long' });

        billMonth = monthFullName;


        if (res_query === 'download') {
            if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
                const chromium = require('chrome-aws-lambda');
                const puppeteer = require('puppeteer-core');

                const options = {
                    args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
                    defaultViewport: chromium.defaultViewport,
                    executablePath: await chromium.executablePath,
                    headless: true,
                    ignoreHTTPSErrors: true,
                };

                // Pass the options to puppeteer.connect
                const browser = await puppeteer.connect(options);

                const page = await browser.newPage();
                if (file_type === 'pdf') {
                    // Set the HTML content to the updatedResponse
                    await page.setContent(updatedResponse);
                    // Generate the PDF
                    const pdfBuffer = await page.pdf({ format: 'A3' });
                    // Close the browser
                    await browser.close();
                    // Send the PDF as a download attachment
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `attachment; filename=Bill_${billMonth}_${refno}.pdf`);
                    return res.send(pdfBuffer);
                } else {
                    // Set the HTML content to the updatedResponse
                    await page.setContent(updatedResponse);
                    // Adjust viewport size to capture full content
                    await page.setViewport({ width: 600, height: 1200 }); // Adjust dimensions as needed

                    // Capture a screenshot of the full page
                    const screenshotBuffer = await page.screenshot({
                        fullPage: true, // Capture the entire page, including scrolling
                    });
                    // Close the browser
                    await browser.close();

                    // Send the image as a download attachment
                    res.setHeader('Content-Type', 'image/png');
                    res.setHeader('Content-Disposition', `attachment; filename=Bill_${billMonth}_${refno}.png`);
                    return res.send(screenshotBuffer);
                }

                // Now you can use the 'browser' instance for further operations.
            } else {
                const puppeteer = require('puppeteer');

                // Create a browser instance for non-Lambda environments
                const browser = await puppeteer.launch();

                // Now you can use the 'browser' instance for further operations.
                if (file_type === 'pdf') {
                    // Set the HTML content to the updatedResponse
                    await page.setContent(updatedResponse);
                    // Generate the PDF
                    const pdfBuffer = await page.pdf({ format: 'A3' });
                    // Close the browser
                    await browser.close();
                    // Send the PDF as a download attachment
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `attachment; filename=Bill_${billMonth}_${refno}.pdf`);
                    return res.send(pdfBuffer);
                } else {
                    // Set the HTML content to the updatedResponse
                    await page.setContent(updatedResponse);
                    // Adjust viewport size to capture full content
                    await page.setViewport({ width: 600, height: 1200 }); // Adjust dimensions as needed

                    // Capture a screenshot of the full page
                    const screenshotBuffer = await page.screenshot({
                        fullPage: true, // Capture the entire page, including scrolling
                    });
                    // Close the browser
                    await browser.close();

                    // Send the image as a download attachment
                    res.setHeader('Content-Type', 'image/png');
                    res.setHeader('Content-Disposition', `attachment; filename=Bill_${billMonth}_${refno}.png`);
                    return res.send(screenshotBuffer);
                }
            }

            const page = await browser.newPage();
        }

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

        const readingDate = $('body > div > table:nth-child(2) > tbody > tr.content > td:nth-child(5)').text().trim();


        // Convert the difference to days
        const daysRemaining = Math.ceil((new Date(dueDate + " UTC").getTime() - new Date().getTime()) / (1000 * 3600 * 24));

        const billDetails = {
            ref: refno,
            bill_name: billName,
            units: units,
            bill_month: billMonth,
            reading_date: convertDate(readingDate),
            current_bill: currentBill,
            after_due_bill: afterDueDateBill,
            due_date: convertDate(dueDate),
            remaining_days: daysRemaining
        };

        if (currentBill === '')
            res.status(404).json({
                message: 'Bill not found',
            });

        if (res_query === 'bill') {
            res.status(200).send(updatedResponse);
        } else res.status(200).json(billDetails);
    } catch (error) {
        res.status(500).send({
            error: 'Error occured',
            message: error.message,
            err: error,
        });
    }
};

const convertDate = date => {
    return new Date(date + " UTC").toLocaleDateString('en-PK', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}
const axios = require('axios');
const cheerio = require('cheerio');
const zlib = require('zlib');

exports.getElectricityBill = async (req, res, next) => {
    const refno = req.params.ref;
    const res_query = req.query.res;
    const file_type = req.query.file;
    const [company, url] = getCompany(refno);

    try {
        const response = await axios.get(url);
        if (response.data.length < 5000) {
            res.status(400).send({
                error: 'Error occured',
                message: 'Bill not found'
            });
        }

        let homeurl = url;
        homeurl = url.replace('http://', '');
        homeurl = url.replace('https://', '');
        homeurl = homeurl.split('/');
        homeurl = 'https://' + homeurl[0];

        const selectors = {
            billMonth: 'body > div.tab-content.active > div.maincontent.fontsize > table:nth-child(2) > tbody > tr.content > td:nth-child(4)',
            currentBill: 'body > div.tab-content.active > div.maincontent.fontsize > div.headertable.fontsize > div:nth-child(3) > table > tbody > tr:nth-child(1) > td.border-b.border-t.border-r.content',
            // afterDueDateBill: 'body > div.tab-content.active > div.maincontent.fontsize > div.headertable.fontsize > div:nth-child(3) > table > tbody > tr:nth-child(2) > td.font-size.border-rb.border-r.content',
            dueDate: 'body > div.tab-content.active > div.maincontent.fontsize > div.headertable.fontsize > div:nth-child(3) > table > tbody > tr:nth-child(2) > td:nth-child(2)',
            dueDate2: 'td.font-size:nth-child(5) > div:nth-child(1) > div:nth-child(1)',
            dueDate3: 'td.font-size:nth-child(5) > div:nth-child(1) > div:nth-child(3)',
            billName: 'body > div.tab-content.active > div > table:nth-child(5) > tbody > tr > td.border-r > table > tbody > tr:nth-child(2) > td:nth-child(1) > p > span:nth-child(3)',
            units: 'body > div.tab-content.active > div > table:nth-child(5) > tbody > tr > td.border-r > table > tbody > tr.content > td:nth-child(5)',
            readingDate: 'body > div.tab-content.active > div > table:nth-child(2) > tbody > tr.content > td:nth-child(5)',
        };


        let updatedResponse = response.data.replace(/<div[^>]+class="noprint">.*?<\/div>/is, '');
        updatedResponse = updatedResponse.replace(/<noscript>.*?<\/noscript>/is, '');
        updatedResponse = updatedResponse.replace(/src="\//g, `src="${homeurl}/`);
        updatedResponse = updatedResponse.replace(/href="\//g, `href="${homeurl}/`);
        updatedResponse = updatedResponse.replace(/action="\.\//g, `action="${homeurl}/pescobill/`);
        updatedResponse = updatedResponse.replace(/<script t.*script>/g, ``);
        updatedResponse = updatedResponse.replaceAll('padding: 20px;', ``);
        updatedResponse = updatedResponse.replace('http://snap', 'https://snap');
        updatedResponse = updatedResponse.replace('<meta charset="utf-16" />', `<meta charset="utf-16" />
        <meta name="viewport" content="width=device-width, initial-scale=1">`);
        const $ = cheerio.load(updatedResponse);

        const rows = $('.nested6 .content');

        const pastData = [];

        rows.each(function () {
            const month = $(this).find('td:first-child').text().trim();
            const unit = $(this).find('td:nth-child(2)').text().trim();
            pastData.push({
                month,
                units: unit
            })
        });

        let billMonth = $(selectors.billMonth).text().trim();

        const [monthAbbreviation, year] = billMonth.split(' ');

        const monthFullName = new Date(`${monthAbbreviation} 1, ${year}`).toLocaleString('en-US', { month: 'long' });

        billMonth = monthFullName;

        const currentBill = $(selectors.currentBill).text().trim();
        // const afterDueDateBill = $(selectors.afterDueDateBill).text().trim().replaceAll('  ', "").replaceAll('\n', '').replaceAll('-24', '-24 ').replaceAll('After', ", After");
        const dueDate = $(selectors.dueDate).text().trim();
        let dueDate2 = $(selectors.dueDate2).text().trim();
        let dueDate3 = $(selectors.dueDate3).text().trim();
        const billName = $(selectors.billName).text().trim();
        const units = $(selectors.units).text().trim();
        const readingDate = $(selectors.readingDate).text().trim();



        dueDate2 = dueDate2.split(' ');
        dueDate3 = dueDate3.split(' ');
        let afterDueBill = dueDate2[dueDate2.length-1];
        let afterDueBill2 = dueDate3[dueDate3.length-1];
        dueDate2 = dueDate2[1].trim();
        dueDate3 = dueDate3[1].trim();

        const daysRemaining = Math.ceil((new Date(dueDate + " UTC").getTime() - new Date().getTime()) / (1000 * 3600 * 24));
        const daysRemaining2 = Math.ceil((new Date(dueDate2 + " UTC").getTime() - new Date().getTime()) / (1000 * 3600 * 24));

        let payable = afterDueBill2; 
        if (daysRemaining2 > -1) {
            payable = afterDueBill;
        }
        if (daysRemaining > -1) {
            payable = currentBill;
        }

        if (!billName) {
            throw new Error("Bill not found");
        }


        $('.tabs.noprint').remove();
        $('.tabcontent:nth-child(2)').remove();
        updatedResponse = $.html();

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
            const billDetails = {
                type: 'electricity',
                company,
                ref: refno,
                bill_name: billName,
                units: units + ' Units',
                bill_month: billMonth,
                reading_date: convertDate(readingDate),
                payable,
                current_bill: currentBill+1,
                after_due_bill: afterDueBill,
                after_due_bill2: afterDueBill2,
                due_date: convertDate(dueDate),
                due_date2: convertDate(dueDate2),
                remaining_days: daysRemaining,
                remaining_days2: daysRemaining2,
                past_data: pastData,
                bill_data: compressText(updatedResponse.replace(/\s+/g, ' '))
            };
            res.status(200).json(billDetails);
        }

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

const getCompany = ref => {
    var disco_code = parseInt(ref.substr(2, 2) + '000');
    var batch = parseInt(ref.substr(0, 2));

    if (disco_code === 11000) {
        return [
            'LESCO',
            'http://ccms.pitc.com.pk/ccms/duplicate_bill_lesco.php?ref=' + ref
        ]

    } else if (disco_code === 12000) {
        if (batch < 24) {
            return [
                'GEPCO',
                "https://bill.pitc.com.pk/gepcobill/general/" + ref
            ]
        } else {
            return [
                'GEPCO',
                "https://bill.pitc.com.pk/gepcobill/industrial/" + ref
            ]

        }

    } else if (disco_code === 13000) {
        if (batch < 24) {
            return [
                'FESCO',
                "https://bill.pitc.com.pk/fescobill/general/" + ref
            ]
        } else {
            return [
                'FESCO',
                "https://bill.pitc.com.pk/fescobill/industrial/" + ref
            ]
        }

    } else if (disco_code === 14000) {
        if (batch < 24) {
            return [
                'IESCO',
                "https://bill.pitc.com.pk/iescobill/general/" + ref
            ]
        } else {
            return [
                'IESCO',
                "https://bill.pitc.com.pk/iescobill/industrial/" + ref
            ]
        }

    } else if (disco_code === 15000) {
        if (batch < 24) {
            return [
                'MEPCO',
                "https://bill.pitc.com.pk/mepcobill/general/" + ref
            ]
        } else {
            return [
                'MEPCO',
                "https://bill.pitc.com.pk/mepcobill/industrial/" + ref
            ]
        }


    } else if (disco_code === 26000) {

        if (batch < 24) {
            return [
                'PESCO',
                "https://bill.pitc.com.pk/pescobill/general/" + ref
            ]
        } else {
            return [
                'PESCO',
                "https://bill.pitc.com.pk/pescobill/industrial/" + ref
            ]
        }

    } else if (disco_code === 37000) {
        if (batch < 24) {
            return [
                'HESCO',
                "https://bill.pitc.com.pk/hescobill/general/" + ref
            ]
        } else {
            return [
                'HESCO',
                "https://bill.pitc.com.pk/hescobill/industrial/" + ref
            ]
        }

    } else if (disco_code === 38000) {
        if (batch < 24) {
            return [
                'SEPCO',
                "https://bill.pitc.com.pk/sepcobill/general/" + ref
            ]
        } else {
            return [
                'SEPCO',
                "https://bill.pitc.com.pk/sepcobill/industrial/" + ref
            ]
        }
    } else {
        if (batch < 24) {
            return [
                'QESCO',
                "https://bill.pitc.com.pk/qescobill/general/" + ref
            ]
        } else {
            return [
                'QESCO',
                "https://bill.pitc.com.pk/qescobill/industrial/" + ref
            ]
        }
    }
}

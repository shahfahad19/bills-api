const axios = require('axios');
const cheerio = require('cheerio');
const zlib = require('zlib');
const tough = require('tough-cookie');

exports.getElectricityBill = async (req, res, next) => {
    const refno = req.params.ref;
    const res_query = req.query.res;
    const file_type = req.query.file;
    const [company, url] = getCompany(refno);

    try {
        
        const cookieJar = new tough.CookieJar();
        const axiosInstance = axios.create({
          jar: cookieJar
        });
      
          const getResponse = await axiosInstance.get(url);
          
          const $init = cheerio.load(getResponse.data);
      
          const cookies = getResponse.headers['set-cookie'];
          const cookieToken = cookies.find(c => c.includes('__RequestVerificationToken')).split(';')[0];
          const sessionCookie = cookies.find(c => c.includes('ASP.NET_SessionId')).split(';')[0];
      
          const formToken = $init('input[name="__RequestVerificationToken"]').val();
          const viewState = $init('#__VIEWSTATE').val();
          const eventValidation = $init('#__EVENTVALIDATION').val();
          const viewStateGenerator = $init('#__VIEWSTATEGENERATOR').val();
      
          const formData = new URLSearchParams({
            __VIEWSTATE: viewState,
            __VIEWSTATEGENERATOR: viewStateGenerator,
            __EVENTVALIDATION: eventValidation,
            rbSearchByList: 'refno',
            searchTextBox: refno,
            ruCodeTextBox: '',
            __RequestVerificationToken: formToken,
            btnSearch: 'Search'
          });
      
          const postResponse = await axiosInstance.post(
            url,
            formData.toString(),
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': url,
                'Cookie': `${cookieToken}; ${sessionCookie}`
              }
            }
          );
       

        // Process response
        let updatedResponse = postResponse.data.replace(/<div[^>]+class="noprint">.*?<\/div>/is, '');
        let homeurl = url;
        homeurl = url.replace('http://', '');
        homeurl = url.replace('https://', '');
        homeurl = homeurl.split('/');
        homeurl = 'https://' + homeurl[0];

        const selectors = {
            billMonth: 'body > div.tab-content.active > div.maincontent.fontsize > table:nth-child(2) > tbody > tr.content > td:nth-child(4)',
            currentBill: 'body > div.tab-content.active > div.maincontent.fontsize > div.headertable.fontsize > div:nth-child(3) > table > tbody > tr:nth-child(1) > td.border-b.border-t.border-r.content',
            dueDate: 'body > div.tab-content.active > div.maincontent.fontsize > div.headertable.fontsize > div:nth-child(3) > table > tbody > tr:nth-child(2) > td:nth-child(2)',
            dueDate2: 'td.font-size:nth-child(5) > div:nth-child(1) > div:nth-child(1)',
            dueDate3: 'td.font-size:nth-child(5) > div:nth-child(1) > div:nth-child(3)',
            billName: 'body > div.tab-content.active > div > table:nth-child(5) > tbody > tr > td.border-r > table > tbody > tr:nth-child(2) > td:nth-child(1) > p > span:nth-child(3)',
            units: 'body > div.tab-content.active > div > table:nth-child(5) > tbody > tr > td.border-r > table > tbody > tr.content > td:nth-child(5)',
            readingDate: 'body > div.tab-content.active > div > table:nth-child(2) > tbody > tr.content > td:nth-child(5)',
        };



        updatedResponse = updatedResponse.replace(/<noscript>.*?<\/noscript>/is, '');
        updatedResponse = updatedResponse.replace(/src="\//g, `src="${homeurl}/`);
        updatedResponse = updatedResponse.replace(/href="\//g, `href="${homeurl}/`);
        updatedResponse = updatedResponse.replace(/action="\.\//g, `action="${homeurl}/pescobill/`);
        updatedResponse = updatedResponse.replace(/<script t.*script>/g, ``);
        updatedResponse = updatedResponse.replaceAll('padding: 20px;', ``);
        updatedResponse = updatedResponse.replace('http://snap', 'https://snap');
        updatedResponse = updatedResponse.replace('<meta charset="utf-16" />', `<meta charset="utf-16" />
        <meta name="viewport" content="width=device-width, initial-scale=1">`);
        updatedResponse = updatedResponse.replace(`url('/images/`, ` url('https://bill.pitc.com.pk/images/`);


        const paid = updatedResponse.includes('Amount Paid');

        let $ = cheerio.load(updatedResponse);


        const tabcontent = $('.tab-content.active');
        $('body').html(tabcontent);

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
                current_bill: currentBill,
                payable: 999,
                paid,
                after_due_bill: afterDueBill2,
                due_date: convertDate(dueDate),
                remaining_days: daysRemaining,
                past_data: pastData,
                bill_data: compressText(updatedResponse.replace(/\s+/g, ' '))
            };
            res.status(200).json(billDetails);
        }
           

    } catch (error) {
        return res.status(500).send({
            error: 'Error occurred',
            message: error.message,
            stack: error.stack,
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
            'https://bill.pitc.com.pk/lescobill'
        ]

    } else if (disco_code === 12000) {
            return [
                'GEPCO',
                "https://bill.pitc.com.pk/gepcobill"
            ]

    } else if (disco_code === 13000) {
        
            return [
                'FESCO',
                "https://bill.pitc.com.pk/fescobill"
            ]
        

    } else if (disco_code === 14000) {
        
            return [
                'IESCO',
                "https://bill.pitc.com.pk/iescobill"
            ]
        

    } else if (disco_code === 15000) {
        
            return [
                'MEPCO',
                "https://bill.pitc.com.pk/mepcobill"
            ]
        


    } else if (disco_code === 26000) {    
            return [
                'PESCO',
                "https://bill.pitc.com.pk/pescobill"
            ]
        

    } else if (disco_code === 37000) {
        
            return [
                'HESCO',
                "https://bill.pitc.com.pk/hescobill"
            ]
        

    } else if (disco_code === 38000) {
        
            return [
                'SEPCO',
                "https://bill.pitc.com.pk/sepcobill"
            ]
        
    } else {
        
            return [
                'QESCO',
                "https://bill.pitc.com.pk/qescobill"
            ] 
    }
}


const decompressText = (compressedData) => {
    const buffer = Buffer.from(compressedData, 'base64');
    const decompressedData = zlib.inflateSync(buffer).toString('utf8');
    return decompressedData;
}


exports.handleBill = async (req, res) => {
   
    if (req.body && req.body.data) {


        let bill_data = req.body.data;
        let updatedResponse = decompressText(bill_data);
        

      
        // Process response
        updatedResponse = updatedResponse.replace(/<div[^>]+class="noprint">.*?<\/div>/is, '');
        let homeurl = "https://bill.pitc.com.pk/";

        updatedResponse = updatedResponse.replace(/<noscript>.*?<\/noscript>/is, '');
        updatedResponse = updatedResponse.replace(/src="\//g, `src="${homeurl}/`);
        updatedResponse = updatedResponse.replace(/href="\//g, `href="${homeurl}/`);
        updatedResponse = updatedResponse.replace(/action="\.\//g, `action="${homeurl}/pescobill/`);
        updatedResponse = updatedResponse.replace(/<script t.*script>/g, ``);
        updatedResponse = updatedResponse.replaceAll('padding: 20px;', ``);
        updatedResponse = updatedResponse.replace('http://snap', 'https://snap');
        updatedResponse = updatedResponse.replace('<meta charset="utf-16" />', `<meta charset="utf-16" />
        <meta name="viewport" content="width=device-width, initial-scale=1">`);
        updatedResponse = updatedResponse.replace(`url('/images/`, ` url('https://bill.pitc.com.pk/images/`);

        const paid = updatedResponse.includes('Amount Paid');

        let $ = cheerio.load(updatedResponse);
        const tabcontent = $('.tab-content.active');
        $('body').html(tabcontent);

        const selectors = {
            billMonth: 'body > div.tab-content.active > div.maincontent.fontsize > table:nth-child(2) > tbody > tr.content > td:nth-child(4)',
            currentBill: 'body > div.tab-content.active > div.maincontent.fontsize > div.headertable.fontsize > div:nth-child(3) > table > tbody > tr:nth-child(1) > td.border-b.border-t.border-r.content',
            dueDate: 'body > div.tab-content.active > div.maincontent.fontsize > div.headertable.fontsize > div:nth-child(3) > table > tbody > tr:nth-child(2) > td:nth-child(2)',
            dueDate2: 'td.font-size:nth-child(5) > div:nth-child(1) > div:nth-child(1)',
            dueDate3: 'td.font-size:nth-child(5) > div:nth-child(1) > div:nth-child(3)',
            billName: 'body > div.tab-content.active > div > table:nth-child(5) > tbody > tr > td.border-r > table > tbody > tr:nth-child(2) > td:nth-child(1) > p > span:nth-child(3)',
            units: 'body > div.tab-content.active > div > table:nth-child(5) > tbody > tr > td.border-r > table > tbody > tr.content > td:nth-child(5)',
            readingDate: 'body > div.tab-content.active > div > table:nth-child(2) > tbody > tr.content > td:nth-child(5)',
        };

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

        if (!billName) {
            throw new Error("Bill not found");
        }


        $('.tabs.noprint').remove();
        $('.tabcontent:nth-child(2)').remove();
        updatedResponse = $.html();

            const billDetails = {
                type: 'electricity',
                company: req.body.company,
                ref: req.body.refno,
                bill_name: billName,
                units: units + ' Units',
                bill_month: billMonth,
                reading_date: convertDate(readingDate),
                current_bill: currentBill,
                payable: 999,
                paid,
                after_due_bill: afterDueBill2,
                due_date: convertDate(dueDate),
                remaining_days: daysRemaining,
                past_data: pastData,
                bill_data: compressText(updatedResponse.replace(/\s+/g, ' '))
            };
            res.status(200).json(billDetails);
}
}
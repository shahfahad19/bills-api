// const puppeteer = require('puppeteer');

// exports.testFun = async (req, res) => {
//     const browser = await puppeteer.launch({
//         args: ['--no-sandbox']
//     });
//     try {

//         const page = await browser.newPage();
//         const html = '<html><body><h1>Hello, PDF!</h1></body></html>';

//         await page.setContent(html);

//         const pdfBuffer = await page.pdf({ format: 'A4' });

//         res.setHeader('Content-Type', 'application/pdf');
//         res.setHeader('Content-Disposition', 'attachment; filename=output.pdf');
//         res.send(pdfBuffer);

//     } catch (error) {
//         console.error('Error generating PDF:', error);
//         res.status(500).send('Internal Server Error');
//     }
//     finally {
//         await browser.close();

//     }
// };


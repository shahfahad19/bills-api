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
        let updatedResponse = response.data.replace(/href='print/g, `href='${homeurl}/print`);
        updatedResponse = updatedResponse.replace(/src='..\//g, `href='${homeurl}/`);

        res.send(updatedResponse);
    } catch (error) {
        console.error('Axios Error:', error.message);
        res.status(500).send('An error occurred.');
    }
};

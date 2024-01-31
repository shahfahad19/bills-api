const axios = require('axios');

exports.getImage = async (req, res) => {
    try {
        const { ref, month } = req.params;
        const imageUrl = `https://www.sngpl.com.pk/imageservlet?consumer=${ref}&billmon=${month}`;

        const response = await axios.get(imageUrl, { responseType: 'stream' });

        const cacheDurationInSeconds = 30 * 24 * 60 * 60; // 1 month
        const expirationDate = new Date(Date.now() + cacheDurationInSeconds * 1000).toUTCString();

        res.setHeader('Cache-Control', `public, max-age=${cacheDurationInSeconds}`);
        res.setHeader('Expires', expirationDate);

        response.data.pipe(res);
    } catch (error) {
        console.error('Error fetching or serving image:', error);
        res.status(500).send('Internal Server Error');
    }
};

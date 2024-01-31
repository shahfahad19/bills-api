const axios = require('axios');
const { Readable } = require('stream');

exports.getImage = async (req, res) => {
    try {
        const { ref, month } = req.params;
        const imageUrl = `https://www.sngpl.com.pk/imageservlet?consumer=${ref}&billmon=${month}`;

        // Fetch the image from the external URL and directly pipe the stream to the response
        const response = await axios.get(imageUrl, { responseType: 'stream' });
        response.data.pipe(res);
    } catch (error) {
        console.error('Error fetching or serving image:', error);
        res.status(500).send('Internal Server Error');
    }
}
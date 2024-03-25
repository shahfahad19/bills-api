// app.js or index.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');

const bodyParser = require('body-parser');


dotenv.config({ path: './config.env' });
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({ origin: '*' }));
app.use(express.static(path.join(__dirname, 'frontend/build')));

const PORT = process.env.PORT || 6000;


app.use('/api', routes);


app.get('/file/:fileName', (req, res) => {
    let fileName = req.params.fileName;
    let cacheDurationInSeconds = 6 * 30 * 24 * 60 * 60;
    const expirationDate = new Date(Date.now() + cacheDurationInSeconds * 1000).toUTCString();
    res.setHeader('Cache-Control', `public, max-age=${cacheDurationInSeconds}`);
    res.setHeader('Expires', expirationDate);
    const imagePath = path.join(__dirname, 'files', fileName);
    res.sendFile(imagePath);
});


app.get('*', (req, res) => {
    res.send('Route not found')
});

app.listen(PORT, () => {
    console.clear();
    console.log(`Api running on http://localhost:${PORT}`);
});

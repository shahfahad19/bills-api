// create an express app
const express = require('express');
const dotenv = require('dotenv');
const app = express();
const cors = require('cors');

dotenv.config({ path: './config.env' });
app.use(cors());

const PORT = process.env.PORT || 6000;

const { getPescoBill } = require('./controllers/pesco');
const { getSngplBill } = require('./controllers/sngpl');

app.get('/', (req, res) => {
    res.send('Api Running');
});

app.get('/pesco/:ref', getPescoBill);
app.get('/sngpl/:ref', getSngplBill);

// define the first route

// start the server listening for requests
app.listen(PORT, () => {
    console.clear();
    console.log(`Api running on http://localhost:${PORT}`);
});

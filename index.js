// create an express app
const express = require('express');
const dotenv = require('dotenv');
const app = express();
const cors = require('cors');
const path = require('path');

dotenv.config({ path: './config.env' });
app.use(cors({ origin: '*' }));

const PORT = process.env.PORT || 6000;

const { getPescoBill } = require('./controllers/pesco');
const { getSngplBill } = require('./controllers/sngpl');

app.get('/api', (req, res) => {
    res.send('Api Running');
});

app.get('/api/pesco/:ref', getPescoBill);
app.get('/api/sngpl/:ref', getSngplBill);

// Serve static files from the "build" directory
app.use(express.static(path.join(__dirname, 'frontend/build')));

// For any other route, send the index.html file
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
});

// start the server listening for requests
app.listen(PORT, () => {
    console.clear();
    console.log(`Api running on http://localhost:${PORT}`);
});

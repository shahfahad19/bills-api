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
app.use(cors({ origin: '*' }));
app.use(express.static(path.join(__dirname, 'frontend/build')));

const PORT = process.env.PORT || 6000;

app.use('/api', routes);

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
});

app.listen(PORT, () => {
    console.clear();
    console.log(`Api running on http://localhost:${PORT}`);
});

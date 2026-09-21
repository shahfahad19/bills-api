const dotenv = require('dotenv');
dotenv.config();
dotenv.config({ path: './config.env' });
const { createApp } = require('./src/app');

const app = createApp();

if (require.main === module) {
    const port = process.env.PORT || 6000;
    app.listen(port, () => console.log(`Bills API listening on http://localhost:${port}`));
}

module.exports = app;

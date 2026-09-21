const fs = require('node:fs/promises');
const path = require('node:path');
const { parseBill } = require('../src/services/bills.service');

function readArguments(argv) {
    const options = {};
    for (let index = 0; index < argv.length; index += 2) {
        const key = argv[index]?.replace(/^--/, '');
        const value = argv[index + 1];
        if (key && value) options[key] = value;
    }
    return options;
}

async function main() {
    const options = readArguments(process.argv.slice(2));
    if (!options.type || !options.file) {
        throw new Error('Usage: npm run parse -- --type <electricity|gas> --file <bill.html> [--ref <reference>] [--company <company>]');
    }

    const file = path.resolve(options.file);
    const html = await fs.readFile(file, 'utf8');
    const bill = await parseBill({
        type: options.type,
        reference: options.ref,
        company: options.company,
        html,
        includeRemoteAssets: false,
    });
    const { html: renderedHtml, bill_data: billData, ...summary } = bill;
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
});

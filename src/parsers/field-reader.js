const { AppError } = require('../errors/app-error');

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const labelKey = value => clean(value).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
const HEADER_KEYS = /^(billmonth|billingmonth|duedate|readingdate|issuedate|referenceno|referencenumber|consumerid|accountid|units|unitsconsumed|meterreading|previousreading|presentreading|tariff|category|sanload|payablewithinduedate|withinduedate|currentbill|nameandaddress|month|hm3|amountdue|payment)$/;

function isHeaderRow($, row) {
    const cells = row.children('th,td');
    return cells.length >= 2 && cells.toArray().every(cell => $(cell).is('th') || HEADER_KEYS.test(labelKey($(cell).text())));
}

function isHistoryHeader($, row) {
    const keys = row.children('td,th').toArray().map(cell => labelKey($(cell).text()));
    return keys.some(key => ['month','billmonth','billingmonth'].includes(key)) &&
        keys.some(key => ['hm3','payment','paymentrs','paymentamount','billrs','billamount','status'].includes(key));
}

// Index local label/value relationships once. Never search the whole page for
// an arbitrary number: printed copies, old references and arrears coexist.
function createLabelReader($) {
    const index = new Map();
    const add = (label, value) => {
        const key = labelKey(label);
        value = clean(value);
        if (!key || !value || value.length > 500) return;
        if (!index.has(key)) index.set(key, new Set());
        index.get(key).add(value);
    };
    $('body *').each((_, element) => {
        const node = $(element);
        if (node.closest('script, style, textarea, pre, noscript').length) return;
        // Only the smallest English label node; ancestor text joins labels
        // and values and is not reliable evidence.
        if (node.children().length || !/[a-z]/i.test(node.text())) return;
        const label = clean(node.text());
        if (label.length > 70) return;
        const inline = label.match(/^([^:]+):\s*(.+)$/);
        if (inline) { add(inline[1], inline[2]); return; }
        if (isHeaderRow($, node.closest('tr')) || isHistoryHeader($, node.closest('tr'))) return;
        let wrapper = node;
        for (let depth = 0; depth < 4 && wrapper.length; depth += 1) {
            if (wrapper.is('body, html, tr, table, tbody')) break;
            // Bilingual tables often put an Urdu-only or blank cell between
            // the English label and its value.
            const next = wrapper.is('td,th')
                ? wrapper.nextAll('td,th').filter((_, el) => /[a-z0-9]/i.test($(el).text())).first()
                : wrapper.next();
            if (next.length && !next.find('table, tr').length) {
                // Ignore bilingual text in the label's own wrapper.
                const value = clean(next.text());
                if (/[a-z0-9]/i.test(value)) { add(label, value); break; }
            }
            const parent = wrapper.parent();
            const english = clean(parent.text())
                .replace(/[^a-z0-9]/gi, '').toLowerCase();
            if (english !== label.replace(/[^a-z0-9]/gi, '').toLowerCase()) break;
            wrapper = parent;
        }
    });
    // Column headers followed by values (including reordered columns).
    $('tr').each((_, row) => {
        const cells = $(row).children('th,td');
        const values = $(row).next('tr').children('th,td');
        if (cells.length < 2 || cells.length !== values.length) return;
        if (!isHeaderRow($, $(row))) return;
        if (isHistoryHeader($, $(row))) return;
        cells.each((i, cell) => {
            if (!$(cell).find('table').length && /[a-z]/i.test($(cell).text()) &&
                !$(values[i]).find('table').length) add($(cell).text(), $(values[i]).text());
        });
    });
    return aliases => [...new Set(aliases.flatMap(label => [...(index.get(labelKey(label)) || [])]))];
}

function createFieldResolver() {
    const report = { version: 2, status: 'complete', sources: {}, warnings: [] };
    const warn = (field, code) => {
        report.status = 'partial';
        if (!report.warnings.some(item => item.field === field && item.code === code)) report.warnings.push({ field, code });
    };
    function resolve(field, candidates, normalize = clean, required = false) {
        const valid = [];
        for (const [source, raw] of candidates) {
            if (raw === null || raw === undefined || clean(raw) === '') continue;
            const value = normalize(raw);
            if (value === null || value === '') { warn(field, 'INVALID_VALUE'); continue; }
            valid.push({ source, value });
        }
        const unique = [...new Set(valid.map(item => item.value))];
        if (unique.length > 1) {
            if (required || field === 'reference') throw new AppError(`Conflicting provider values for ${field}`, 422, 'AMBIGUOUS_BILL');
            warn(field, 'CONFLICTING_VALUES');
            return null;
        }
        if (!unique.length) {
            if (required) throw new AppError(`Cannot reliably extract ${field} from this bill`, 422, 'INCOMPLETE_BILL');
            warn(field, 'MISSING_FIELD');
            return null;
        }
        report.sources[field] = [...new Set(valid.map(item => item.source))];
        return unique[0];
    }
    return { report, resolve, warn };
}

module.exports = { clean, labelKey, createLabelReader, createFieldResolver };

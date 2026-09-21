function parseProviderDate(value) {
    const text = String(value || '').trim();
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const dayFirst = text.match(/^(\d{1,2})[-/\s]+([A-Za-z]{3,9}|\d{1,2})[-/\s]+(\d{2}|\d{4})$/);

    if (dayFirst || iso) {
        let [day, month, year] = iso ? [iso[3], iso[2], iso[1]] : dayFirst.slice(1);
        if (year.length === 2) year = `20${year}`;
        const monthValue = /^\d+$/.test(month)
            ? Number(month) - 1
            : ['january','february','march','april','may','june','july','august','september','october','november','december']
                .findIndex(name => month.toLowerCase() === name || month.toLowerCase() === name.slice(0,3));
        const date = new Date(Date.UTC(Number(year), monthValue, Number(day)));
        return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === monthValue &&
            date.getUTCDate() === Number(day) ? date : null;
    }

    return null;
}

function formatProviderDate(value) {
    const date = parseProviderDate(value);
    if (!date) return String(value || '').trim();

    return date.toLocaleDateString('en-PK', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    });
}

function daysUntil(value, now = new Date()) {
    const date = parseProviderDate(value);
    if (!date) return null;
    return Math.ceil((date.getTime() - now.getTime()) / 86400000);
}

function fullMonth(value) {
    const match = String(value || '').trim().match(/^([A-Za-z]{3,9})(?:\s+(\d{2,4}))?/);
    if (!match) return String(value || '').trim();
    const year = match[2] ? (match[2].length === 2 ? `20${match[2]}` : match[2]) : '2000';
    const date = new Date(`${match[1]} 1, ${year} UTC`);
    return Number.isNaN(date.getTime())
        ? String(value || '').trim()
        : date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
}

module.exports = { daysUntil, formatProviderDate, fullMonth, parseProviderDate };

const cheerio = require('cheerio');

function sanitizeHtml(html) {
    const $ = cheerio.load(html);
    $('script, iframe, object, embed, meta[http-equiv="refresh"]').remove();

    $('*').each((_, element) => {
        for (const attribute of Object.keys(element.attribs || {})) {
            const value = element.attribs[attribute] || '';
            if (/^on/i.test(attribute) || (/^(href|src|action)$/i.test(attribute) && /^\s*javascript:/i.test(value))) {
                $(element).removeAttr(attribute);
            }
        }
    });

    return $.html();
}

module.exports = { sanitizeHtml };

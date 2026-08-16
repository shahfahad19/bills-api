const ax = require('axios');
const ch = require('cheerio');
ax.post('https://bill.pitc.com.pk/pescobill/general', 'refno=01262130009696', {headers:{'Content-Type':'application/x-www-form-urlencoded'}})
.then(r => {
    const $ = ch.load(r.data);
    console.log("Scripts:");
    console.log($('script').map((i,el)=>$(el).html()).get().join('\n---\n'));
    console.log("Images:");
    console.log($('img').map((i,el)=>$(el).attr('src')).get().join('\n'));
    console.log("Canvases:");
    console.log($('canvas').map((i,el)=>$(el).attr('id')).get().join('\n'));
    console.log("SVGs:");
    console.log($('svg').map((i,el)=>$(el).attr('id')).get().join('\n'));
})
.catch(console.error);

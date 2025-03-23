const axios = require('axios');
const cheerio = require('cheerio');
const tough = require('tough-cookie');

async function fetchPescoBill() {
  const cookieJar = new tough.CookieJar();
  const axiosInstance = axios.create({
    jar: cookieJar,
    withCredentials: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Sec-Fetch-Dest': 'document'
    }
  });

  try {
    // --- Initial Request ---
    console.log('[1/4] Fetching initial page...');
    const getResponse = await axiosInstance.get('https://bill.pitc.com.pk/pescobill');
    
    // Debug: Save initial response
    // require('fs').writeFileSync('initial.html', getResponse.data);

    const $init = cheerio.load(getResponse.data);
    console.log('[2/4] Extracting tokens...');

    // --- Extract Verification Tokens ---
    const cookies = getResponse.headers['set-cookie'];
    const cookieToken = cookies.find(c => c.includes('__RequestVerificationToken')).split(';')[0];
    const sessionCookie = cookies.find(c => c.includes('ASP.NET_SessionId')).split(';')[0];

    const formToken = $init('input[name="__RequestVerificationToken"]').val();
    const viewState = $init('#__VIEWSTATE').val();
    const eventValidation = $init('#__EVENTVALIDATION').val();
    const viewStateGenerator = $init('#__VIEWSTATEGENERATOR').val();

    console.log('Tokens:', {
      cookieToken: cookieToken?.substring(0, 15) + '...',
      formToken: formToken?.substring(0, 15) + '...',
      viewState: viewState?.substring(0, 15) + '...',
      sessionCookie: sessionCookie?.substring(0, 15) + '...'
    });

    // --- Form Submission ---
    console.log('[3/4] Submitting form...');
    const formData = new URLSearchParams({
      __EVENTTARGET: '',
      __EVENTARGUMENT: '',
      __LASTFOCUS: '',
      __VIEWSTATE: viewState,
      __VIEWSTATEGENERATOR: viewStateGenerator,
      __EVENTVALIDATION: eventValidation,
      rbSearchByList: 'refno',
      searchTextBox: '03268110184802',
      ruCodeTextBox: '',
      __RequestVerificationToken: formToken,
      btnSearch: 'Search'
    });

    const postResponse = await axiosInstance.post(
      'https://bill.pitc.com.pk/pescobill',
      formData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://bill.pitc.com.pk/pescobill',
          'Cookie': `${cookieToken}; ${sessionCookie}`
        }
      }
    );

    // Debug: Save response
    require('fs').writeFileSync('response.html', postResponse.data);
    console.log('[4/4] Response saved to response.html');

    // --- Parse Response ---
    const $ = cheerio.load(postResponse.data);
    
    // Check for successful response
    if ($('#normal_bill_barcode').length === 0) {
      throw new Error('Bill data not found - check response.html');
    }

    // --- Data Extraction ---
    const extractWithFallback = (selector, fallback = 'N/A') => {
      const elem = $(selector);
      return elem.length ? elem.text().trim() : fallback;
    };

    return {
      consumerName: extractWithFallback('td:contains("NAME & ADDRESS") + td span:nth-of-type(2)'),
      amountDue: extractWithFallback('td:contains("PAYABLE WITHIN DUE DATE") + td'),
      dueDate: extractWithFallback('td:contains("DUE DATE")').split('\n')[0].trim(),
      referenceNumber: extractWithFallback('td:contains("Reference Number") + td'),
      billingMonth: extractWithFallback('td:contains("BILL MONTH") + td')
    };

  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
    
    return {
      error: true,
      message: error.message,
      stack: error.stack?.split('\n')[0]
    };
  }
}

// Run with debugging
fetchPescoBill()
  .then(result => {
    if (result.error) {
      console.log('Scraping failed');
    } else {
      console.log('Scraping successful:');
      console.log(result);
    }
  })
  .catch(err => console.error('Fatal error:', err));
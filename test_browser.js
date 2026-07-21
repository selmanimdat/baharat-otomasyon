const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQ FAIL:', request.url(), request.failure().errorText));

  await page.goto('http://127.0.0.1:5000', { waitUntil: 'networkidle0' });
  
  try {
      await page.click('#btn-select-admin');
      console.log('Clicked admin button');
  } catch (e) {
      console.log('Click failed', e.message);
  }
  
  await browser.close();
})();

import puppeteer from 'puppeteer-core';
import chromium from 'chrome-aws-lambda';
import { authenticator } from 'otplib';

export class M365LoginUtil {
  private static readonly M365_LOGIN_URL = 'https://www.microsoft.com/cascadeauth/store/account/signin';

  public static async login(email: string, password: string, totpKey: string): Promise<boolean> {
    let browser;
    
    try {
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });

      const page = await browser.newPage();

      // Step 1: Navigate to login page
      await page.goto(this.M365_LOGIN_URL, { waitUntil: 'networkidle2' });
      console.log('➡️ Opened the login page.');

      // Step 2: Enter email
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      await page.type('input[type="email"]', email, { delay: 100 });
      await page.keyboard.press('Enter');
      console.log('➡️ Entered email address.');
      await page.waitForTimeout(2000);

      // Step 3: Enter password
      await page.waitForSelector('input[type="password"]', { timeout: 10000 });
      await page.type('input[type="password"]', password, { delay: 100 });
      await page.keyboard.press('Enter');
      console.log('➡️ Entered password.');
      await page.waitForTimeout(2000);

      // Step 4: Generate and enter TOTP
      const otp = authenticator.generate(totpKey);
      await page.waitForSelector('input[name="otc"]', { timeout: 10000 });
      await page.type('input[name="otc"]', otp, { delay: 50 });
      await page.keyboard.press('Enter');
      console.log('➡️ Entered OTP.');
      await page.waitForTimeout(3000);

      // Step 5: Handle TOU if present
      const currentUrl = page.url();
      if (currentUrl.startsWith('https://account.live.com/tou/accrue')) {
        const acceptTouSelector = '[data-testid="primaryButton"]';
        const touButton = await page.$(acceptTouSelector);
        if (touButton) {
          await page.click(acceptTouSelector);
          console.log('➡️ Accepted terms of use.');
          await page.waitForTimeout(3000);
        }
      }

      // Step 6: Handle "Stay signed in?" prompt
      const staySignedInSelector = '[data-testid="secondaryButton"]';
      const staySignedInButton = await page.$(staySignedInSelector);
      if (staySignedInButton) {
        await page.click(staySignedInSelector);
        console.log('➡️ Selected "No" to "Stay signed in?"');
      }

      await page.waitForTimeout(5000);

      // Step 7: Verify login success
      const finalUrl = page.url();
      console.log('➡️ Final URL:', finalUrl);
      
      const loginSuccess = finalUrl.includes('https://www.microsoft.com/');
      const loginError = await page.$('div.error, div[role="alert"]');

      const success = loginSuccess && !loginError;
      console.log(success ? '✅ Sign-in was successful' : '❌ Sign-in failed');
      
      return success;
    } catch (error) {
      console.error('Login process failed:', error);
      return false;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

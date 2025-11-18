import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { authenticator } from 'otplib';

export class M365LoginUtil {
  private static readonly M365_LOGIN_URL = 'https://www.microsoft.com/cascadeauth/store/account/signin';

  public static async login(email: string, password: string, totpKey: string): Promise<boolean> {
    let browser;
    
    try {
      browser = await puppeteer.launch({
        args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: await chromium.executablePath(),
        headless: true,
      });

      const page = await browser.newPage();
      await page.setDefaultTimeout(8000);

      // Step 1: Navigate to login page
      await page.goto(this.M365_LOGIN_URL, { waitUntil: 'domcontentloaded' });
      console.log('➡️ Opened the login page.');

      // Step 2: Enter email
      await page.waitForSelector('input[type="email"]');
      await page.type('input[type="email"]', email);
      await page.keyboard.press('Enter');
      console.log('➡️ Entered email address.');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Enter password
      await page.waitForSelector('input[type="password"]');
      await page.type('input[type="password"]', password);
      await page.keyboard.press('Enter');
      console.log('➡️ Entered password.');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 4: Generate and enter TOTP
      const otp = authenticator.generate(totpKey.replace(/\s/g, ''));
      await page.waitForSelector('input[name="otc"]');
      await page.type('input[name="otc"]', otp);
      await page.keyboard.press('Enter');
      console.log('➡️ Entered OTP.');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 5: Handle TOU if present
      try {
        const acceptTouSelector = '[data-testid="primaryButton"]';
        await page.waitForSelector(acceptTouSelector, { timeout: 3000 });
        await page.click(acceptTouSelector);
        console.log('➡️ Accepted terms of use.');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        // TOU not present, continue
      }

      // Step 6: Handle "Stay signed in?" prompt
      try {
        const staySignedInSelector = '[data-testid="secondaryButton"]';
        await page.waitForSelector(staySignedInSelector, { timeout: 3000 });
        await page.click(staySignedInSelector);
        console.log('➡️ Selected "No" to "Stay signed in?"');
      } catch (e) {
        // Prompt not present, continue
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 7: Verify login success
      const finalUrl = page.url();
      console.log('➡️ Final URL:', finalUrl);
      
      const success = finalUrl.includes('https://www.microsoft.com/') && !finalUrl.includes('signin');
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

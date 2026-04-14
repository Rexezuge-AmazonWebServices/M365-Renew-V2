import puppeteer from 'puppeteer-core';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const chromium = require('@sparticuz/chromium');
import { TOTP } from 'otplib';
import { createGuardrails } from '@otplib/core';
import { crypto } from '@otplib/plugin-crypto-noble';
import { ScureBase32Plugin } from '@otplib/plugin-base32-scure';

export interface LoginResult {
  success: boolean;
  errorMessage?: string;
}

export class M365LoginUtil {
  private static readonly M365_LOGIN_URL = 'https://www.microsoft.com/cascadeauth/store/account/signin';

  public static async login(email: string, password: string, totpKey: string): Promise<LoginResult> {
    let browser;

    try {
      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
        ignoreDefaultArgs: ['--disable-extensions'],
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
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 3: Enter password
      await page.waitForSelector('input[type="password"]', { timeout: 10000 });
      await page.type('input[type="password"]', password, { delay: 100 });
      await page.keyboard.press('Enter');
      console.log('➡️ Entered password.');
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 4: Generate and enter TOTP
      const guardrails = createGuardrails({
        MIN_SECRET_BYTES: 1,
      });
      const base32 = new ScureBase32Plugin();
      const totp = new TOTP({ crypto, base32, guardrails });
      const otp = await totp.generate({ secret: totpKey.replace(/\s/g, '') });
      await page.waitForSelector('input[name="otc"]', { timeout: 10000 });
      await page.type('input[name="otc"]', otp, { delay: 50 });
      await page.keyboard.press('Enter');
      console.log('➡️ Entered OTP.');
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Step 5: Handle TOU if present
      const currentUrl = page.url();
      if (currentUrl.startsWith('https://account.live.com/tou/accrue')) {
        const acceptTouSelector = '[data-testid="primaryButton"]';
        const touButton = await page.$(acceptTouSelector);
        if (touButton) {
          await page.click(acceptTouSelector);
          console.log('➡️ Accepted terms of use.');
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }

      // Step 6: Handle "Stay signed in?" prompt
      const staySignedInSelector = '[data-testid="secondaryButton"]';
      const staySignedInButton = await page.$(staySignedInSelector);
      if (staySignedInButton) {
        await page.click(staySignedInSelector);
        console.log('➡️ Selected "No" to "Stay signed in?"');
      }

      // Wait for OAuth redirect chain to finish by polling the URL
      try {
        await page.waitForFunction(
          `(() => {
            const h = document.location.hostname;
            return h.endsWith('microsoft.com') && !h.includes('login') && !h.includes('live.com');
          })()`,
          { timeout: 30000 },
        );
      } catch {
        // Timeout — proceed with whatever URL we landed on
      }

      // Step 7: Verify login success
      const finalUrl = page.url();
      console.log('➡️ Final URL:', finalUrl);

      let loginSuccess = false;
      try {
        const parsedUrl = new URL(finalUrl);
        loginSuccess =
          parsedUrl.protocol === 'https:' && parsedUrl.hostname.endsWith('microsoft.com') && !parsedUrl.hostname.includes('login');
      } catch {
        loginSuccess = false;
      }

      // Check for specific login error elements (not broad role="alert" which matches non-error UI)
      let loginError = null;
      try {
        loginError = await page.$('#usernameError, #passwordError, #idTD_Error, #idA_IL_ForgotPassword0');
      } catch {
        // Execution context can be destroyed by a page navigation (e.g., Microsoft SPA redirect).
        // If the URL already confirms we landed on microsoft.com, this is a false negative.
      }

      const success = loginSuccess && !loginError;
      console.log(success ? '✅ Sign-in was successful' : `❌ Sign-in failed (urlOk=${loginSuccess}, errorElement=${!!loginError})`);

      return {
        success,
        errorMessage: success ? undefined : 'Login failed - invalid credentials or authentication error',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during login process';
      console.error('Login process failed:', error);
      return { success: false, errorMessage };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

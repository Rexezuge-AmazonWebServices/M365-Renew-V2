import puppeteer from 'puppeteer-core';
import type { Page } from 'puppeteer-core';

export interface LoginResult {
  success: boolean;
  errorMessage?: string;
  screenshotBase64?: string;
}

export class M365LoginUtil {
  private static readonly M365_LOGIN_URL = 'https://www.microsoft.com/cascadeauth/store/account/signin';
  private static readonly LOGIN_ERROR_SELECTOR = '#usernameError, #passwordError, #idTD_Error, #idA_IL_ForgotPassword0';
  private static readonly DEFAULT_LOGIN_ERROR_MESSAGE = 'Login failed - invalid credentials or authentication error';

  public static async login(email: string, password: string, totpKey: string): Promise<LoginResult> {
    let browser;
    let page: Page | null = null;

    try {
      const { default: chromium } = await import('@sparticuz/chromium');
      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath()),
        headless: true,
        ignoreDefaultArgs: ['--disable-extensions'],
      });

      page = await browser.newPage();

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
      const otp = await this.generateTotp(totpKey.replace(/\s/g, ''));
      await page.waitForSelector('input[name="otc"]', { timeout: 10000 });
      await page.type('input[name="otc"]', otp, { delay: 50 });
      await page.keyboard.press('Enter');
      console.log('➡️ Entered OTP.');
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Step 5: Handle post-auth prompts that can appear in sequence.
      await this.handlePostAuthPrompts(page);

      // Wait for OAuth redirect chain to finish by polling the URL
      try {
        await page.waitForFunction(
          `(() => {
            const h = document.location.hostname;
            return h.endsWith('microsoft.com') && !h.includes('login') && !h.includes('live.com');
          })()`,
          { timeout: 50000 },
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
        const hostname = parsedUrl.hostname.toLowerCase();
        const isMicrosoftHost = hostname === 'microsoft.com' || hostname.endsWith('.microsoft.com');
        loginSuccess = parsedUrl.protocol === 'https:' && isMicrosoftHost && !hostname.includes('login');
      } catch {
        loginSuccess = false;
      }

      // Check for specific login error elements (not broad role="alert" which matches non-error UI)
      let loginErrorMessage: string | undefined;
      try {
        loginErrorMessage = await this.getLoginErrorMessage(page);
      } catch {
        // Execution context can be destroyed by a page navigation (e.g., Microsoft SPA redirect).
        // If the URL already confirms we landed on microsoft.com, this is a false negative.
      }

      const success = loginSuccess && !loginErrorMessage;
      console.log(success ? '✅ Sign-in was successful' : `❌ Sign-in failed (urlOk=${loginSuccess}, errorElement=${!!loginErrorMessage})`);

      let screenshotBase64: string | undefined;
      if (!success && page) {
        try {
          screenshotBase64 = await page.screenshot({ encoding: 'base64', type: 'png' });
        } catch {
          // Screenshot failed, continue without it
        }
      }

      return {
        success,
        errorMessage: success ? undefined : loginErrorMessage || this.DEFAULT_LOGIN_ERROR_MESSAGE,
        screenshotBase64,
      };
    } catch (error) {
      const browserErrorMessage = error instanceof Error ? error.message : 'Unknown error during login process';
      console.error('Login process failed:', error);

      const loginErrorMessage = page ? await this.getLoginErrorMessage(page) : undefined;
      const errorMessage = loginErrorMessage || browserErrorMessage;

      let screenshotBase64: string | undefined;
      if (page) {
        try {
          screenshotBase64 = await page.screenshot({ encoding: 'base64', type: 'png' });
        } catch {
          // Screenshot failed, continue without it
        }
      }

      return { success: false, errorMessage, screenshotBase64 };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private static async handlePostAuthPrompts(page: Page): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const currentUrl = page.url();

      if (currentUrl.startsWith('https://account.live.com/tou/accrue')) {
        const acceptedTou = await this.clickIfPresent(page, '[data-testid="primaryButton"]', '➡️ Accepted terms of use.');
        if (acceptedTou) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          continue;
        }
      }

      const confirmedSecurityInfo = await this.clickIfPresent(page, '#iLooksGood', '➡️ Confirmed security info is still accurate.');
      if (confirmedSecurityInfo) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }

      const declinedStaySignedIn = await this.clickIfPresent(
        page,
        '[data-testid="secondaryButton"]',
        '➡️ Selected "No" to "Stay signed in?"',
      );
      if (declinedStaySignedIn) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }

      break;
    }
  }

  private static async generateTotp(key: string): Promise<string> {
    const baseUrl = process.env.TOTP_SERVER_BASE_URL;
    if (!baseUrl) {
      throw new Error('TOTP_SERVER_BASE_URL environment variable is not set');
    }
    const url = `${baseUrl.replace(/\/$/, '')}/generate-totp?key=${encodeURIComponent(key)}&timeOffset=30`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`TOTP server returned ${response.status}: ${response.statusText}`);
    }
    const data = (await response.json()) as { otp: string };
    return data.otp;
  }

  private static async getLoginErrorMessage(page: Page): Promise<string | undefined> {
    try {
      const loginError = await page.$(this.LOGIN_ERROR_SELECTOR);
      if (!loginError) {
        return undefined;
      }

      const errorText = await loginError.evaluate((element) => element.textContent || '');
      const normalizedErrorText = errorText.replace(/\s+/g, ' ').trim();
      return normalizedErrorText || this.DEFAULT_LOGIN_ERROR_MESSAGE;
    } catch {
      return undefined;
    }
  }

  private static async clickIfPresent(page: Page, selector: string, logMessage: string): Promise<boolean> {
    const button = await page.$(selector);
    if (!button) {
      return false;
    }

    await page.click(selector);
    console.log(logMessage);
    return true;
  }
}

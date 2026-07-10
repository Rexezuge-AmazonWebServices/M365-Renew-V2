import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loginErrorSelector = '#usernameError, #passwordError, #idTD_Error, #idA_IL_ForgotPassword0';

const mocks = vi.hoisted(() => ({
  launch: vi.fn(),
  browserClose: vi.fn(),
  newPage: vi.fn(),
  goto: vi.fn(),
  waitForSelector: vi.fn(),
  type: vi.fn(),
  press: vi.fn(),
  waitForFunction: vi.fn(),
  url: vi.fn(),
  querySelector: vi.fn(),
  screenshot: vi.fn(),
  click: vi.fn(),
  elementEvaluate: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('puppeteer-core', () => ({
  default: {
    launch: mocks.launch,
  },
}));

vi.mock('@sparticuz/chromium', () => ({
  default: {
    args: [],
    executablePath: vi.fn().mockResolvedValue('/tmp/chrome'),
  },
}));

import { M365LoginUtil } from './M365LoginUtil.js';

const makePage = () => ({
  goto: mocks.goto,
  waitForSelector: mocks.waitForSelector,
  type: mocks.type,
  keyboard: { press: mocks.press },
  waitForFunction: mocks.waitForFunction,
  url: mocks.url,
  $: mocks.querySelector,
  screenshot: mocks.screenshot,
  click: mocks.click,
});

describe('M365LoginUtil', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('PUPPETEER_EXECUTABLE_PATH', '/tmp/chrome');
    vi.stubEnv('TOTP_SERVER_BASE_URL', 'https://totp.example.com');
    vi.stubGlobal('fetch', mocks.fetch);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    Object.values(mocks).forEach((mock) => mock.mockReset());

    const page = makePage();
    mocks.launch.mockResolvedValue({ newPage: mocks.newPage, close: mocks.browserClose });
    mocks.newPage.mockResolvedValue(page);
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ otp: '123456' }) });
    mocks.waitForSelector.mockResolvedValue(undefined);
    mocks.waitForFunction.mockResolvedValue(undefined);
    mocks.url.mockReturnValue('https://www.microsoft.com/en-us/microsoft-365');
    mocks.querySelector.mockResolvedValue(null);
    mocks.screenshot.mockResolvedValue('screenshot');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns visible Microsoft error text from final sign-in failure', async () => {
    const errorElement = { evaluate: mocks.elementEvaluate };
    mocks.querySelector.mockImplementation(async (selector: string) => (selector === loginErrorSelector ? errorElement : null));
    mocks.elementEvaluate.mockResolvedValue(
      ' Your account or password is incorrect.\nIf you do not remember your password, reset it now. ',
    );

    const resultPromise = M365LoginUtil.login('user@example.com', 'bad-password', 'totp-key');
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({
      success: false,
      errorMessage: 'Your account or password is incorrect. If you do not remember your password, reset it now.',
      screenshotBase64: 'screenshot',
    });
  });

  it('returns Microsoft error text instead of an OTP selector timeout', async () => {
    const microsoftError = 'Your account has been locked. Contact your support person to unlock it, then try again.';
    const errorElement = { evaluate: mocks.elementEvaluate };
    mocks.waitForSelector.mockImplementation(async (selector: string) => {
      if (selector === 'input[name="otc"]') {
        throw new Error('Waiting for selector `input[name="otc"]` failed: Waiting failed: 10000ms exceeded');
      }
    });
    mocks.querySelector.mockImplementation(async (selector: string) => (selector === loginErrorSelector ? errorElement : null));
    mocks.elementEvaluate.mockResolvedValue(microsoftError);

    const resultPromise = M365LoginUtil.login('user@example.com', 'password', 'totp-key');
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toMatchObject({
      success: false,
      errorMessage: microsoftError,
      screenshotBase64: 'screenshot',
    });
  });

  it('falls back to the browser error when no Microsoft error text is visible', async () => {
    mocks.waitForSelector.mockImplementation(async (selector: string) => {
      if (selector === 'input[name="otc"]') {
        throw new Error('Waiting for selector `input[name="otc"]` failed: Waiting failed: 10000ms exceeded');
      }
    });

    const resultPromise = M365LoginUtil.login('user@example.com', 'password', 'totp-key');
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toMatchObject({
      success: false,
      errorMessage: 'Waiting for selector `input[name="otc"]` failed: Waiting failed: 10000ms exceeded',
      screenshotBase64: 'screenshot',
    });
  });
});

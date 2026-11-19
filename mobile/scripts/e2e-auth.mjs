import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://127.0.0.1:8090';
const OUT = 'shots';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function see(page, text, timeout = 8000) {
  try {
    await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    const body = await page.locator('body').innerText();
    console.log('BODY ON FAILURE:', body.slice(0, 1200));
    throw new Error('Missing text: ' + text);
  }
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push('PAGEERROR ' + err.message));

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await see(page, '先入团，再一起跑。');
  await page.screenshot({ path: OUT + '/auth-login.png', fullPage: true });
  console.log('OK login screen');

  await page.getByText('填入演示账号', { exact: true }).click();
  await page.getByText('进入跑团', { exact: true }).click();
  await see(page, '你好，林小满');
  await page.screenshot({ path: OUT + '/auth-home.png', fullPage: true });
  console.log('OK demo login');

  await page.getByRole('tab', { name: '我的' }).click();
  await see(page, '一个普通跑者的成长档案。');
  await page.getByText('退出登录', { exact: true }).click();
  await see(page, '先入团，再一起跑。');
  console.log('OK logout');

  await page.getByText('我有邀请码', { exact: true }).click();
  await see(page, '找到你的跑团');
  await page.getByPlaceholder('例如 KANGFU-2026').fill('WRONG-0000');
  await page.getByText('验证邀请码', { exact: true }).click();
  await see(page, '邀请码不对');
  console.log('OK invalid invite guard');

  await page.getByPlaceholder('例如 KANGFU-2026').fill('KANGFU-2026');
  await page.getByText('验证邀请码', { exact: true }).click();
  await see(page, '接下来填写入团资料。');
  await page.getByPlaceholder('社团里怎么称呼你').fill('周小满');
  await page.getByText('高二', { exact: true }).click();
  await page.getByPlaceholder('3–20 个字符，登录时使用').fill('zhouxiaoman');
  await page.getByPlaceholder('至少 6 位').fill('run123456');
  await page.getByText('提交入团申请', { exact: true }).click();
  await see(page, '申请已提交');
  await page.screenshot({ path: OUT + '/auth-pending.png', fullPage: true });
  console.log('OK pending');

  await page.getByText('演示：立即通过', { exact: true }).click();
  await see(page, '你好，周小满');
  await page.screenshot({ path: OUT + '/auth-approved.png', fullPage: true });
  console.log('OK approve');

  await page.getByRole('tab', { name: '我的' }).click();
  await see(page, '周小满');
  await page.getByText('退出登录', { exact: true }).click();
  await see(page, '先入团，再一起跑。');
  console.log('OK logout after approval');

  if (errors.length) {
    console.log('CONSOLE_ERRORS', JSON.stringify(errors.slice(0, 10)));
    process.exitCode = 2;
  } else {
    console.log('CONSOLE_ERRORS none');
  }
} finally {
  await browser.close();
}

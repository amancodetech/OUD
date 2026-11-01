import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
// Run against the isolated Worker harness, never a production browser profile.
const config = JSON.parse(await readFile(process.argv[2], 'utf8'));
assert.match(config.base, /^http:\/\/127\.0\.0\.1:\d+$/);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
await context.addInitScript(() => { window.__cacheEvents = []; const observer = new BroadcastChannel('oud-data-v1'); observer.onmessage = event => window.__cacheEvents.push(event.data.kind); });
const page = await context.newPage();
const errors = []; page.on('pageerror', error => errors.push(error.message));
const checks = [];
const logoutResponses = [];
page.on('response', async response => { if (response.url().endsWith('/api/auth/logout')) logoutResponses.push({ status: response.status(), body: await response.text().catch(() => '') }); });
async function databaseRows(target) {
  return target.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('oud-session-cache-v1', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('reads')) { db.close(); resolve([]); return; }
      const tx = db.transaction('reads'); const all = tx.objectStore('reads').getAll();
      all.onsuccess = () => resolve(all.result.map(row => ({ fields: Object.keys(row), encrypted: row.ciphertext instanceof ArrayBuffer && row.iv instanceof Uint8Array })));
      tx.oncomplete = () => db.close();
    };
  }));
}
try {
  await page.goto(config.base + '/login');
  await page.locator('input[type=text]').fill(config.username);
  await page.locator('input[type=password]').fill(config.password);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(config.base + '/');
  const dashboardCard = page.locator('main').getByText(/صافي المبيعات/).first();
  await dashboardCard.waitFor({ timeout: 30000 });
  await page.locator('a[href="/items"]').first().click();
  await page.waitForURL('**/items');
  await page.locator('main table tbody tr').first().waitFor({ timeout: 30000 });
  // Wait for encrypted write completion, not for a fixed arbitrary delay.
  for (let n = 0; ; n++) {
    const rows = await databaseRows(page);
    if (rows.length >= 2) { assert.ok(rows.every(row => row.encrypted && !row.fields.some(f => /key|body|password|cookie/i.test(f)))); checks.push('IndexedDB contains encrypted records only'); break; }
    if (n > 60) throw new Error('Encrypted records were not persisted');
    await new Promise(done => setTimeout(done, 100));
  }
  let release; const blocked = new Promise(done => { release = done; });
  await page.route('**/api/reports/dashboard?**', async route => { await blocked; await route.continue().catch(() => {}); });
  const started = Date.now();
  await page.locator('a[href="/"]').first().click();
  await dashboardCard.waitFor({ timeout: 5000 });
  assert.equal(await page.locator('main .animate-spin').count(), 0, 'Cached dashboard must not be replaced by a spinner');
  checks.push(`Revisit rendered with report network response blocked (${Date.now() - started} ms including navigation)`);
  await page.reload();
  await dashboardCard.waitFor({ timeout: 5000 });
  assert.equal(await page.locator('main .animate-spin').count(), 0);
  checks.push('Reload decrypted cached dashboard before report network response');
  release(); await page.unroute('**/api/reports/dashboard?**');
  const second = await context.newPage(); await second.goto(config.base + '/items');
  await second.locator('main table tbody tr').first().waitFor({ timeout: 10000 });
  await mkdir('reports/cloudflare', { recursive: true });
  await page.screenshot({ path: 'reports/cloudflare/cached-dashboard.png', fullPage: false });
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /تسجيل الخروج|Logout|Sign out/i }).last().click();
  await page.waitForURL('**/login', { timeout: 10000 }); await second.waitForURL('**/login', { timeout: 10000 });
  for (let n = 0; ; n++) {
    if ((await databaseRows(page)).length === 0) break;
    if (n > 50) throw new Error('Logout did not clear encrypted records');
    await new Promise(done => setTimeout(done, 100));
  }
  checks.push('Logout clears IndexedDB and locks both tabs');
  assert.deepEqual(errors, [], 'Browser runtime errors');
  const result = { passed: true, checks };
  await writeFile('reports/cloudflare/browser-cache.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await mkdir('reports/cloudflare', { recursive: true });
  await page.screenshot({ path: 'reports/cloudflare/browser-failure.png', fullPage: false }).catch(() => {});
  console.error(JSON.stringify({ browserErrors: errors, logoutResponses, completedChecks: checks, pages: await Promise.all(context.pages().map(async p => ({ url: p.url(), state: await p.evaluate(() => ({ text: document.body.innerText.slice(0, 500), events: window.__cacheEvents })).catch(() => null) }))) })); throw error;
} finally { await browser.close(); }

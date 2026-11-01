import { readFile } from 'node:fs/promises';
const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
const problems = [];
if (!config.hyperdrive?.some(h => h.binding === 'HYPERDRIVE' && /^[a-f0-9]{32}$/.test(h.id) && !/^0+$/.test(h.id))) problems.push('Set the real HYPERDRIVE ID after creating it with query caching disabled.');
if (!/^https:\/\/[^/]+$/.test(config.vars?.APP_URL || '') || /\.invalid$/.test(config.vars.APP_URL)) problems.push('Set APP_URL to the exact HTTPS application origin.');
if (!config.queues?.producers?.some(q => q.binding === 'JOBS') || !config.r2_buckets?.some(b => b.binding === 'JOB_FILES')) problems.push('Configure private R2 storage and the job queue.');
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('Static deployment configuration checked. SESSION_SECRET and resource provisioning must be completed in Cloudflare before release.');

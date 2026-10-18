#!/usr/bin/env node
/**
 * Cloudflare Pages Rollback Script
 * Usage:
 *   node pages-rollback.mjs current   -> prints prev_id=<current production deployment id>
 *   node pages-rollback.mjs <id>      -> rolls back production to <id>
 */
const token = process.env.CLOUDFLARE_API_TOKEN;
const acct = process.env.CLOUDFLARE_ACCOUNT_ID;
const project = process.env.PAGES_PROJECT ?? 'local-agent-harness';

if (!token || !acct) {
  console.error('❌ CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required.');
  process.exit(1);
}

const api = `https://api.cloudflare.com/client/v4/accounts/${acct}/pages/projects/${project}`;

const call = async (url, init = {}) => {
  const r = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const j = await r.json();
  if (!j.success) throw new Error(JSON.stringify(j.errors));
  return j.result;
};

const arg = process.argv[2];
if (arg === 'current') {
  const deployments = await call(`${api}/deployments?env=production&per_page=1`);
  if (!deployments || deployments.length === 0) {
    console.log('prev_id=none');
  } else {
    console.log(`prev_id=${deployments[0].id}`);
  }
} else if (arg && arg !== 'none') {
  const d = await call(`${api}/deployments/${arg}/rollback`, { method: 'POST' });
  console.log(`rolled back production to ${d.id}`);
} else {
  console.log('No prior deployment ID provided; skipping rollback.');
}

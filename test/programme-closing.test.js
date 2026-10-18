// Copyright 2026 Quantova Inc
// SPDX-License-Identifier: Apache-2.0 OR MIT

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const q = require('..');
const { network, stamper, iso } = require('./chain');

async function world() {
  const now = Math.floor(Date.now() / 1000);
  const net = network(now - 86400);
  const at = stamper(q, net);
  const K = {};
  for (const r of q.ROLES) K[r] = q.generateKey();
  const t0 = now - 80000;
  const secret = new Uint8Array(32).fill(3);
  const programme = await at(q.programme({ key: K.authority, title: 'Flood relief', rules: Buffer.from('rules'), currency: 'EUR', budget: '100000', maxAward: '5000', approvalAbove: '100000', opensAt: iso(t0), closesAt: iso(t0 + 1000), publishedAt: iso(t0) }), t0 + 10);
  const roles = Object.fromEntries(Object.entries(K).map(([r, k]) => [r + 'Keys', [q.keyId(k)]]));
  const check = (env, more) => {
    net.chain.block(now);
    return q.verify(env, Object.assign({ type: 'application', allSupplied: true, records: [programme] }, roles, net.opts, more));
  };
  const apply = (who, t) => q.application({ key: K.intake, programme, applicant: who, partySecret: secret, content: Buffer.from('form ' + who), receivedAt: iso(t) });
  return { K, at, t0, programme, check, apply };
}

const closing = (r) => r.checks.find((c) => c.name === 'closing');

test('a programme closes after it opens and refuses applications received after it closed', async () => {
  const w = await world();
  assert.throws(() => q.programme({ key: w.K.authority, title: 'x', rules: Buffer.from('r'), currency: 'EUR', budget: '10', maxAward: '1', approvalAbove: '1', opensAt: iso(w.t0), closesAt: iso(w.t0), publishedAt: iso(w.t0) }), /closes only after it opens/);
  assert.throws(() => w.apply('NL-1', w.t0 + 1000), /closed/);
});

test('an application must be anchored before the programme closes', async () => {
  const w = await world();
  const early = await w.at(w.apply('NL-1', w.t0 + 100), w.t0 + 200);
  const ok = await w.check(early);
  assert.strictEqual(ok.status, 'valid', JSON.stringify(ok.checks.filter((c) => !c.ok)));
  assert.ok(closing(ok).ok);
  const late = await w.at(w.apply('NL-2', w.t0 + 900), w.t0 + 1500);
  const bad = await w.check(late, { maxAnchorDelay: 3600 });
  assert.strictEqual(bad.status, 'invalid');
  assert.match(closing(bad).detail, /anchored after the programme closed/);
  const bare = w.apply('NL-3', w.t0 + 300);
  const open = await w.check(bare);
  assert.strictEqual(open.status, 'indeterminate');
  assert.ok(!closing(open).ok && closing(open).indeterminate);
  const lax = await w.check(bare, { requireAnchor: false });
  assert.strictEqual(lax.status, 'valid', JSON.stringify(lax.checks.filter((c) => !c.ok)));
});

// Copyright 2026 Quantova Inc
// SPDX-License-Identifier: Apache-2.0 OR MIT

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert');
const { honest } = require('./honest');
const { iso } = require('./chain');

const dirs = [];
test.after(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

function folder() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'qaid-series-'));
  dirs.push(d);
  return d;
}

const refused = (e) => e.code === 'QAID_LEDGER';

test('with a ledger a second assessor cannot start the decision series of a programme again', async () => {
  const w = await honest();
  const { q, K, all } = w;
  const dir = folder();
  const decide = (key, more) => q.decision(Object.assign({ key, programme: all.programme, application: all.application, award: '2500', decidedAt: iso(w.now - 60), ledger: dir }, more));
  const results = await Promise.allSettled([K.assessor, q.generateKey()].map((key) => decide(key, { first: true })));
  assert.strictEqual(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.ok(refused(results.find((r) => r.status === 'rejected').reason));
  const latest = await q.ledgerLatest(dir, 'decision', q.refOf(all.programme));
  assert.deepStrictEqual(latest, results.find((r) => r.status === 'fulfilled').value);
});

test('with a ledger two paying officers cannot both pay the first disbursement of a decision', async () => {
  const w = await honest();
  const { q, K, all } = w;
  const dir = folder();
  const pay = (key) => q.disbursement({ key, programme: all.programme, decision: all.decision, approval: all.approval, amount: '2500', first: true, paidAt: iso(w.now - 60), ledger: dir });
  const first = await pay(K.payer);
  await assert.rejects(pay(q.generateKey()), refused);
  assert.strictEqual(first.statement.seq, 1);
});

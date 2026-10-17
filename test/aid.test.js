// Copyright 2026 Quantova Inc
// SPDX-License-Identifier: Apache-2.0 OR MIT

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const q = require('..');
const F = require('../lib/format');
const { network, stamper, iso, failing } = require('./chain');

async function programme() {
  const now = Math.floor(Date.now() / 1000);
  const net = network(now - 86400);
  const at = stamper(q, net);
  const K = { authority: q.generateKey(), intake: q.generateKey(), assessor: q.generateKey() };
  const t0 = now - 80000;
  const prog = await at(q.programme({ key: K.authority, title: 'Flood relief', rules: Buffer.from('rules'), currency: 'EUR', budget: '100000', maxAward: '5000', approvalAbove: '100000', opensAt: iso(t0), publishedAt: iso(t0) }), t0 + 10);
  const secret = new Uint8Array(32).fill(9);
  const apply = (applicant, n) => at(q.application({ key: K.intake, programme: prog, applicant, partySecret: secret, content: Buffer.from('a' + n), receivedAt: iso(t0 + 100 + n) }), t0 + 110 + n);
  const decide = (application, opts, n) => at(q.decision(Object.assign({ key: K.assessor, programme: prog, application, currency: 'EUR', award: '5000', decidedAt: iso(t0 + 300 + n) }, opts)), t0 + 310 + n);
  const roles = { authorityKeys: [q.keyId(K.authority)], intakeKeys: [q.keyId(K.intake)], assessorKeys: [q.keyId(K.assessor)] };
  return { net, at, K, prog, secret, apply, decide, roles, now };
}

test('an application must derive the applicant from the secret of the authority', async () => {
  const p = await programme();
  assert.throws(() => q.application({ key: p.K.intake, programme: p.prog, applicantRef: q.commitParty('NL-123456789').ref, content: Buffer.from('x') }), /partySecret/);
  assert.throws(() => q.application({ key: p.K.intake, programme: p.prog, applicant: 'NL-123456789', partySecret: p.secret, applicantRef: q.commitParty('NL-123456789').ref, content: Buffer.from('x') }));
  const a = q.application({ key: p.K.intake, programme: p.prog, applicant: 'NL-123456789', partySecret: p.secret, content: Buffer.from('x') });
  assert.strictEqual(a.format, 'qaid/2');
  assert.strictEqual(a.statement.partyScheme, F.PARTY_SCHEME);
  assert.strictEqual(a.statement.applicantRef, q.commitParty('NL-123456789', { secret: p.secret, scope: q.refOf(p.prog) }).ref);
});

test('a record that states another derivation scheme is not a valid application', () => {
  const st = { applicationId: 'ab'.repeat(16), intakeKeyId: 'cd'.repeat(32), programmeRef: 'ef'.repeat(32), applicantRef: '01'.repeat(32), partyScheme: 'random-salt/1', contentDigest: '02'.repeat(32), receivedAt: '2026-01-01T00:00:00.000Z', note: '' };
  assert.match(F.statementProblem('application', st), /secret of the authority/);
  st.partyScheme = F.PARTY_SCHEME;
  assert.strictEqual(F.statementProblem('application', st), null);
});

test('the same applicant written in another way receives the same commitment and a second award is refused', async () => {
  const p = await programme();
  const variants = ['nl123456789', 'NL‑123456789', 'ＮＬ 123 456 789', 'ΝL-123456789', 'nl.123.456.789'];
  const first = await p.apply('NL-123456789', 0);
  const d1 = await p.decide(first, { first: true }, 0);
  for (const [i, v] of variants.entries()) {
    const again = await p.apply(v, i + 1);
    assert.strictEqual(again.statement.applicantRef, first.statement.applicantRef, v);
    assert.throws(() => q.decision({ key: p.K.assessor, programme: p.prog, application: again, currency: 'EUR', award: '5000', previous: d1 }), /already used the same applicantRef/);
  }
});

test('a second award to the same applicant made outside the series is detected', async () => {
  const p = await programme();
  const a1 = await p.apply('NL-123456789', 0);
  const a2 = await p.apply('nl 123456789', 1);
  const d1 = await p.decide(a1, { first: true }, 0);
  const d2 = await p.decide(a2, { first: true }, 1);
  p.net.chain.block(p.now);
  const r = await q.verify(d2, Object.assign({ type: 'decision', allSupplied: true, records: [p.prog, a1, a2, d1] }, p.roles, p.net.opts));
  assert.strictEqual(r.status, 'invalid', failing(r).join('\n'));
});

test('awards to different applicants stay valid', async () => {
  const p = await programme();
  const a1 = await p.apply('NL-123456789', 0);
  const a2 = await p.apply('NL-987654321', 1);
  const d1 = await p.decide(a1, { first: true }, 0);
  const d2 = await p.decide(a2, { previous: d1 }, 1);
  p.net.chain.block(p.now);
  const r = await q.verify(d2, Object.assign({ type: 'decision', allSupplied: true, records: [p.prog, a1, a2, d1] }, p.roles, p.net.opts));
  assert.strictEqual(r.status, 'valid', failing(r).join('\n'));
  const salt = q.commitParty('NL 123 456 789', { secret: p.secret, scope: q.refOf(p.prog) }).salt;
  const party = await q.verify(a1, Object.assign({ type: 'application', records: [p.prog], party: { field: 'applicantRef', identity: 'nl123456789', salt } }, p.roles, p.net.opts));
  assert.strictEqual(party.status, 'valid', failing(party).join('\n'));
});

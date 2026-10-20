'use strict';

const crypto = require('crypto');
const test = require('node:test');
const assert = require('node:assert');
const q = require('..');
const F = require('../lib/format');
const native = require('../lib/native');
const { network, stamper, iso, failing } = require('./chain');
const { mulberry32, iterations } = require('./fuzz');
const { variantOf } = require('./variants');

const CODE = F.NAME.toUpperCase() + '_';
const NAMES = ['NL-123456789', 'Jose Perez', 'ACME Coop 01', 'Olga Ivanova', 'IBAN NL91 ABNA 0417 1643 00', 'K. Okonkwo', 'Maria-Jose Lopez 1970', 'TAX/2026/0001'];

function rawSign(type, st, key) {
  const problem = F.statementProblem(type, st);
  if (problem) throw new Error(problem);
  const sig = native.sign(key, F.payload(type, st), crypto.randomBytes(32));
  return { format: F.FORMAT, type, algorithm: F.ALGORITHM, signer: { id: q.keyId(key), publicKey: Buffer.from(q.publicKey(key)).toString('base64') }, statement: st, signature: Buffer.from(sig).toString('base64') };
}

const CYRILLIC = { A: '\u0410', B: '\u0412', C: '\u0421', E: '\u0415', H: '\u041d', I: '\u0406', K: '\u041a', M: '\u041c', O: '\u041e', P: '\u0420', T: '\u0422', X: '\u0425', a: '\u0430', c: '\u0441', e: '\u0435', o: '\u043e', p: '\u0440', x: '\u0445', i: '\u0456' };

function forms(rng, name) {
  const out = [
    variantOf(rng, name),
    name.toLowerCase(),
    name.toUpperCase(),
    name.replace(/[-\s./]/g, ''),
    name.replace(/[-\s./]/g, (c) => ({ '-': ' ', ' ': '.', '.': '/', '/': '-' })[c]),
    name.replace(/[A-Za-z]/g, (c) => CYRILLIC[c] || c),
    name.replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)),
    name.replace(/[0Oo]/g, (c) => (c === '0' ? 'O' : '0')),
  ];
  return [...new Set(out)].filter((v) => v !== name);
}

const ROUNDS = iterations(24);

test('one award per applicant, however the applicant is written in case, separators, Cyrillic or fullwidth lookalikes or 0 for O', async (t) => {
  const rng = mulberry32(0xa1d);
  const int = (n) => Math.floor(rng() * n);
  const now = Math.floor(Date.now() / 1000);
  const net = network(now - 86400);
  const at = stamper(q, net);
  const K = { authority: q.generateKey(), intake: q.generateKey(), intake2: q.generateKey(), assessor: q.generateKey() };
  const roles = { authorityKeys: [q.keyId(K.authority)], intakeKeys: [q.keyId(K.intake), q.keyId(K.intake2)], assessorKeys: [q.keyId(K.assessor)] };
  const secret = Uint8Array.from({ length: 32 }, (_, i) => (3 + i) & 255);
  const counts = { variants: 0, refusedByLibrary: 0, inSeries: 0, outsideSeries: 0 };
  let t0 = now - 80000;
  for (let round = 0; round < ROUNDS; round += 1) {
    t0 += 600;
    const prog = await at(q.programme({ key: K.authority, title: 'Relief ' + round, rules: Buffer.from('rules'), currency: 'EUR', budget: '1000000', maxAward: '5000', approvalAbove: '1000000', opensAt: iso(t0), closesAt: iso(t0 + 30 * 86400), publishedAt: iso(t0) }), t0 + 1);
    const name = NAMES[int(NAMES.length)];
    for (const variant of forms(rng, name)) {
      t0 += 1;
      assert.ok(F.sameIdentifier(variant, name), JSON.stringify(variant) + ' should share the canonical form of ' + name);
      counts.variants += 1;
      const a1 = await at(q.application({ key: K.intake, programme: prog, applicant: name, partySecret: secret, content: Buffer.from('a' + round + variant), receivedAt: iso(t0 + 10) }), t0 + 11);
      const a2 = await at(q.application({ key: [K.intake, K.intake2][int(2)], programme: prog, applicant: variant, partySecret: secret, content: Buffer.from('b' + round + variant), receivedAt: iso(t0 + 20) }), t0 + 21);
      assert.strictEqual(a1.statement.applicantRef, a2.statement.applicantRef, JSON.stringify(variant) + ' was committed apart from ' + JSON.stringify(name));
      const award = String(1 + int(5000));
      const d1 = await at(q.decision({ key: K.assessor, programme: prog, application: a1, award, first: true, decidedAt: iso(t0 + 30) }), t0 + 31);
      assert.throws(() => q.decision({ key: K.assessor, programme: prog, application: a2, award, previous: d1, decidedAt: iso(t0 + 40) }), (e) => typeof e.code === 'string' && e.code.startsWith(CODE));
      counts.refusedByLibrary += 1;
      const last = F.parse(d1).statement;
      const second = String(1 + int(5000));
      const st = Object.assign({}, last, { decisionId: crypto.randomBytes(16).toString('hex'), applicationRef: q.refOf(a2), applicantRef: a2.statement.applicantRef, seq: 2, prevDecisionRef: q.refOf(d1), award: second, awardedTotal: String(BigInt(last.awardedTotal) + BigInt(second)), decidedAt: iso(t0 + 40) });
      const d2 = await at(rawSign('decision', st, K.assessor), t0 + 41);
      const r = await q.verify(d2, Object.assign({ type: 'decision', at: iso(now), allSupplied: true, records: [prog, a1, a2, d1, d2] }, roles, net.opts));
      assert.strictEqual(r.status, 'invalid', 'a second award in the series to ' + JSON.stringify(variant) + ' after ' + JSON.stringify(name) + ' verified ' + r.status + '\n' + failing(r).join('\n'));
      assert.ok(r.checks.some((c) => c.name === 'repeat' && !c.ok), failing(r).join('\n'));
      counts.inSeries += 1;
      const d3 = await at(q.decision({ key: K.assessor, programme: prog, application: a2, award: second, first: true, decidedAt: iso(t0 + 50) }), t0 + 51);
      const r3 = await q.verify(d3, Object.assign({ type: 'decision', at: iso(now), allSupplied: true, records: [prog, a1, a2, d1, d3] }, roles, net.opts));
      assert.strictEqual(r3.status, 'invalid', 'a second award outside the series to ' + JSON.stringify(variant) + ' verified ' + r3.status + '\n' + failing(r3).join('\n'));
      counts.outsideSeries += 1;
    }
  }
  t.diagnostic(JSON.stringify(Object.assign({ rounds: ROUNDS }, counts)));
});

test('awards to applicants with different canonical forms stay valid', async () => {
  const now = Math.floor(Date.now() / 1000);
  const net = network(now - 86400);
  const at = stamper(q, net);
  const K = { authority: q.generateKey(), intake: q.generateKey(), assessor: q.generateKey() };
  const roles = { authorityKeys: [q.keyId(K.authority)], intakeKeys: [q.keyId(K.intake)], assessorKeys: [q.keyId(K.assessor)] };
  const secret = Uint8Array.from({ length: 32 }, (_, i) => (4 + i) & 255);
  const t0 = now - 80000;
  const prog = await at(q.programme({ key: K.authority, title: 'Relief', rules: Buffer.from('rules'), currency: 'EUR', budget: '1000000', maxAward: '5000', approvalAbove: '1000000', opensAt: iso(t0), closesAt: iso(t0 + 30 * 86400), publishedAt: iso(t0) }), t0 + 1);
  const records = [prog];
  let prev = null;
  for (let i = 0; i < NAMES.length; i += 1) {
    const a = await at(q.application({ key: K.intake, programme: prog, applicant: NAMES[i], partySecret: secret, content: Buffer.from('a' + i), receivedAt: iso(t0 + 10 + i) }), t0 + 20);
    prev = await at(q.decision(Object.assign({ key: K.assessor, programme: prog, application: a, award: '100', decidedAt: iso(t0 + 100 + i) }, prev ? { previous: prev } : { first: true })), t0 + 200);
    records.push(a, prev);
  }
  const r = await q.verify(prev, Object.assign({ type: 'decision', at: iso(now), allSupplied: true, records }, roles, net.opts));
  assert.strictEqual(r.status, 'valid', failing(r).join('\n'));
});

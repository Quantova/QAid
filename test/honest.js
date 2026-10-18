'use strict';

const q = require('..');
const { network, stamper, iso } = require('./chain');

async function honest() {
  const now = Math.floor(Date.now() / 1000);
  const net = network(now - 86400);
  const at = stamper(q, net);
  const K = {};
  for (const r of q.ROLES) K[r] = q.generateKey();
  const t0 = now - 80000;
  const secret = new Uint8Array(32).fill(9);
  const programme = await at(q.programme({ key: K.authority, title: 'Flood relief', rules: Buffer.from('rules'), currency: 'EUR', budget: '100000', maxAward: '5000', approvalAbove: '1000', opensAt: iso(t0), publishedAt: iso(t0) }), t0 + 10);
  const application = await at(q.application({ key: K.intake, programme, applicant: 'NL-123456789', partySecret: secret, content: Buffer.from('form'), receivedAt: iso(t0 + 100) }), t0 + 110);
  const decision = await at(q.decision({ key: K.assessor, programme, application, award: '2500', first: true, decidedAt: iso(t0 + 300) }), t0 + 310);
  const approval = await at(q.approval({ key: K.approver, decision, approvedAt: iso(t0 + 400) }), t0 + 410);
  const disbursement = await at(q.disbursement({ key: K.payer, programme, decision, approval, amount: '2500', first: true, paidAt: iso(t0 + 500) }), t0 + 510);
  const recovery = await at(q.recovery({ key: K.authority, decision, reason: Buffer.from('overpaid'), amount: '100', recoveredAt: iso(t0 + 600) }), t0 + 610);
  net.chain.block(now);
  const roles = Object.fromEntries(Object.entries(K).map(([r, k]) => [r + 'Keys', [q.keyId(k)]]));
  return { q, net, now, K, roles, at, all: { programme, application, decision, approval, disbursement, recovery } };
}

module.exports = { honest };

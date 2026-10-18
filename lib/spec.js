// Copyright 2026 Quantova Inc
// SPDX-License-Identifier: Apache-2.0 OR MIT

'use strict';

module.exports = Object.freeze({
  version: 3,
  name: 'qaid',
  title: 'QAid',
  kind: 1105,
  magic: 'QAID',
  summary: 'post quantum integrity for grants, subsidies and aid',
  roles: {
    authority: 'managing authority key',
    intake: 'application intake key',
    assessor: 'assessing officer key',
    approver: 'approving officer key',
    payer: 'paying officer key',
  },
  types: {
    programme: {
      role: 'authority', id: 'programmeId', signer: 'authorityKeyId', time: 'publishedAt',
      fields: { title: ['text', 128, true], rulesDigest: ['digest', 0, false, 'rules'], currency: ['currency'], budget: ['posamount'], maxAward: ['posamount'], approvalAbove: ['amount'], opensAt: ['time'], closesAt: ['time'] },
      shape: (st) => {
        if (BigInt(st.maxAward) > BigInt(st.budget)) return 'the largest award cannot exceed the budget of the programme';
        if (Date.parse(st.closesAt) <= Date.parse(st.opensAt)) return 'a programme closes only after it opens';
        return null;
      },
    },
    application: {
      role: 'intake', id: 'applicationId', signer: 'intakeKeyId', time: 'receivedAt',
      links: { programme: { field: 'programmeRef', type: 'programme' } },
      fields: { applicantRef: ['party'], partyScheme: ['text', 64, true], contentDigest: ['digest', 0, false, 'content'] },
      secretParty: { field: 'applicantRef', scheme: 'partyScheme', scope: 'programme', identity: 'applicant' },
      signCheck: (st, links) => {
        if (Date.parse(st.receivedAt) < Date.parse(links.programme.statement.opensAt)) return 'an application cannot be received before the programme opens';
        if (Date.parse(st.receivedAt) >= Date.parse(links.programme.statement.closesAt)) return 'an application cannot be received once the programme has closed';
        return null;
      },
      verifyCheck: (p, links, h) => {
        if (!links.programme) return [];
        const ok = Date.parse(p.statement.receivedAt) >= Date.parse(links.programme.statement.opensAt);
        const out = [['opening', ok, ok ? 'received after the programme opened' : 'received before the programme opened']];
        const closes = links.programme.statement.closesAt;
        const closesMs = Date.parse(closes);
        const a = h.info.anchor;
        if (a && a.proven) {
          const inTime = a.ms < closesMs;
          out.push(['closing', inTime, inTime ? 'anchored before the programme closed at ' + closes : 'anchored after the programme closed at ' + closes]);
        } else if (Date.parse(p.statement.receivedAt) >= closesMs) {
          out.push(['closing', false, 'received after the programme closed at ' + closes]);
        } else if (h.ctx.req) {
          out.push(['closing', false, 'not anchored with a proven time, so it is not proven to have been received before the programme closed at ' + closes, true]);
        } else {
          out.push(['closing', true, 'dated before the programme closed at ' + closes + ', anchors were not required']);
        }
        return out;
      },
    },
    decision: {
      role: 'assessor', id: 'decisionId', signer: 'assessorKeyId', time: 'decidedAt',
      links: {
        programme: { field: 'programmeRef', type: 'programme', copy: [['currency', 'currency']], max: [['award', 'maxAward']] },
        application: { field: 'applicationRef', type: 'application', copy: [['applicantRef', 'applicantRef']], match: [['programmeRef', 'programmeRef']] },
      },
      fields: { applicantRef: ['party'], currency: ['currency'], award: ['posamount'] },
      chain: { scope: 'programmeRef', prev: 'prevDecisionRef', total: 'awardedTotal', amount: 'award', cap: ['programme', 'budget'], unique: 'applicantRef' },
    },
    approval: {
      role: 'approver', id: 'approvalId', signer: 'approverKeyId', time: 'approvedAt',
      links: { decision: { field: 'decisionRef', type: 'decision' } },
      fields: {},
    },
    disbursement: {
      role: 'payer', id: 'disbursementId', signer: 'payerKeyId', time: 'paidAt',
      links: {
        programme: { field: 'programmeRef', type: 'programme' },
        decision: { field: 'decisionRef', type: 'decision', copy: [['currency', 'currency']], match: [['programmeRef', 'programmeRef']] },
        approval: { field: 'approvalRef', type: 'approval', optional: true, match: [['decisionRef', 'decisionRef']] },
      },
      fields: { currency: ['currency'], amount: ['posamount'] },
      chain: { scope: 'decisionRef', prev: 'prevDisbursementRef', total: 'paidTotal', amount: 'amount', cap: ['decision', 'award'] },
      signCheck: (st, links) => {
        const needs = BigInt(links.decision.statement.award) > BigInt(links.programme.statement.approvalAbove);
        if (needs && !links.approval) return 'this award is above the approval limit of the programme, give the approval of a second officer';
        return null;
      },
      verifyCheck: (p, links) => {
        if (!links.decision || !links.programme) return [];
        const needs = BigInt(links.decision.statement.award) > BigInt(links.programme.statement.approvalAbove);
        if (!needs) return [['approval', true, 'the award is within the limit that needs a second approval']];
        const ok = p.statement.approvalRef !== '';
        return [['approval', ok, ok ? 'the award above the approval limit carries the approval of a second officer' : 'the award is above the approval limit and carries no second approval']];
      },
    },
    recovery: {
      role: 'authority', id: 'recoveryId', signer: 'authorityKeyId', time: 'recoveredAt',
      links: { decision: { field: 'decisionRef', type: 'decision', copy: [['currency', 'currency']] } },
      fields: { reasonDigest: ['digest', 0, false, 'reason'], currency: ['currency'], amount: ['posamount'] },
    },
  },
});

// Copyright 2026 Quantova Inc
// SPDX-License-Identifier: Apache-2.0 OR MIT

export type RecordType = 'programme' | 'application' | 'decision' | 'approval' | 'disbursement' | 'recovery';
export type Role = 'authority' | 'intake' | 'assessor' | 'approver' | 'payer';

export interface Envelope {
  format: 'qaid/3';
  type: RecordType;
  algorithm: 'ML-DSA-65';
  signer: { id: string; publicKey: string };
  statement: Record<string, unknown>;
  signature: string;
  anchor?: unknown;
}

export interface SeriesLedger {
  read(name: string): Promise<string | null>;
  compareAndSwap(name: string, expected: string | null, next: string): Promise<boolean>;
}

export interface KeyDescription {
  format: 'qaid-key/1';
  algorithm: 'ML-DSA-65';
  id: string;
  publicKey: string;
}

export type KeyRef = string | Uint8Array | KeyDescription;

export interface ProgrammeOptions {
  key: Uint8Array;
  title: string;
  rulesDigest?: string;
  rules?: Uint8Array;
  currency: string;
  budget: string;
  maxAward: string;
  approvalAbove: string;
  opensAt: string;
  closesAt: string;
  publishedAt?: string;
  note?: string;
}

export interface ApplicationOptions {
  key: Uint8Array;
  programme: Envelope;
  applicantRef?: string;
  partyScheme?: string;
  contentDigest?: string;
  content?: Uint8Array;
  applicant: string;
  partySecret: Uint8Array;
  receivedAt?: string;
  note?: string;
}

export interface DecisionOptions {
  key: Uint8Array;
  programme: Envelope;
  application: Envelope;
  applicantRef?: string;
  currency?: string;
  award: string;
  previous?: Envelope;
  first?: boolean;
  ledger: string | SeriesLedger | false;
  decidedAt?: string;
  note?: string;
}

export interface ApprovalOptions {
  key: Uint8Array;
  decision: Envelope;
  approvedAt?: string;
  note?: string;
}

export interface DisbursementOptions {
  key: Uint8Array;
  programme: Envelope;
  decision: Envelope;
  approval?: Envelope;
  currency?: string;
  amount: string;
  previous?: Envelope;
  first?: boolean;
  ledger: string | SeriesLedger | false;
  paidAt?: string;
  note?: string;
}

export interface RecoveryOptions {
  key: Uint8Array;
  decision: Envelope;
  reasonDigest?: string;
  reason?: Uint8Array;
  currency?: string;
  amount: string;
  recoveredAt?: string;
  note?: string;
}

export type KeyStatus = { revoked: false } | { revoked: true; revokedAt: number };

export interface VerifyOptions {
  type: RecordType;
  network: 'testnet' | 'custom';
  authorityKeys?: KeyRef[];
  intakeKeys?: KeyRef[];
  assessorKeys?: KeyRef[];
  approverKeys?: KeyRef[];
  payerKeys?: KeyRef[];
  records?: Envelope[];
  allSupplied?: boolean;
  party?: { field: string; identity: string; salt: Uint8Array };
  rulesDigest?: string;
  rules?: Uint8Array;
  contentDigest?: string;
  content?: Uint8Array;
  reasonDigest?: string;
  reason?: Uint8Array;
  requireAnchor?: boolean;
  at?: string;
  maxAnchorDelay?: number;
  maxAnchorLookups?: number;
  deadlineMs?: number;
  keyStatus?: (keyId: string) => KeyStatus | Promise<KeyStatus>;
  keyStatusTimeoutMs?: number;
  rpc?: string | string[];
  client?: unknown;
  clients?: Array<string | unknown>;
  trustSingleEndpoint?: boolean;
  trustCustomEndpoints?: boolean;
  allowLoopback?: boolean;
  endpointAllowList?: string[];
  expectedSender?: string | string[];
  contract?: string;
  trustCustomContract?: boolean;
}

export interface VerifyCheck {
  name: string;
  ok: boolean;
  detail: string;
  transport: boolean;
  indeterminate: boolean;
}

export interface VerifyResult {
  valid: boolean;
  status: 'valid' | 'invalid' | 'indeterminate';
  type: RecordType | null;
  checks: VerifyCheck[];
  endpoints: string[];
  officialEndpoints: boolean | null;
  notices: string[];
  facts: Record<string, unknown>;
  [field: string]: unknown;
}

export interface AnchorOptions {
  seed: Uint8Array;
  index: number;
  network?: 'testnet';
  rpc?: string | string[];
  client?: unknown;
  clients?: Array<string | unknown>;
  trustSingleEndpoint?: boolean;
  allowLoopback?: boolean;
  endpointAllowList?: string[];
  meter?: number;
  maxFee?: string | number;
  timeoutMs?: number;
  onPending?: (pending: unknown) => void | Promise<void>;
}

export function generateKey(): Uint8Array;
export function publicKey(key: Uint8Array): Uint8Array;
export function keyId(key: Uint8Array): string;
export function describeKey(key: Uint8Array): KeyDescription;
export function commitParty(identity: string, options?: { salt?: Uint8Array; secret?: Uint8Array; scope?: string }): { salt: Uint8Array; ref: string };
export function programme(options: ProgrammeOptions): Envelope;
export function application(options: ApplicationOptions): Envelope;
export function decision(options: DecisionOptions & { ledger: string | SeriesLedger }): Promise<Envelope>;
export function decision(options: DecisionOptions & { ledger: false }): Envelope;
export function approval(options: ApprovalOptions): Envelope;
export function disbursement(options: DisbursementOptions & { ledger: string | SeriesLedger }): Promise<Envelope>;
export function disbursement(options: DisbursementOptions & { ledger: false }): Envelope;
export function recovery(options: RecoveryOptions): Envelope;
export function create(type: RecordType, options: Record<string, unknown>): Envelope | Promise<Envelope>;
export function folderLedger(folder: string): SeriesLedger;
export function ledgerLatest(ledger: string | SeriesLedger, type: RecordType, seriesRef: string): Promise<Envelope | null>;
export function anchor(envelopes: Envelope | Envelope[], options: AnchorOptions): Promise<Envelope[]>;
export function complete(envelopes: Envelope | Envelope[], pending: unknown, options?: { rpc?: string | string[]; client?: unknown; clients?: Array<string | unknown>; trustSingleEndpoint?: boolean; allowLoopback?: boolean; endpointAllowList?: string[]; timeoutMs?: number }): Promise<Envelope[]>;
export function verify(envelope: unknown, options: VerifyOptions): Promise<VerifyResult>;
export function refOf(envelope: Envelope): string;
export function anchorDigest(envelope: Envelope): string;
export const FORMAT: 'qaid/3';
export const ALGORITHM: 'ML-DSA-65';
export const KIND: 1105;
export const TYPES: readonly RecordType[];
export const ROLES: readonly Role[];

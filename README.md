# QAid

QAid is a post quantum integrity layer for grants, subsidies and aid. It seals the rules of each programme, every application, every eligibility decision, every approval and every disbursement, and links each payment to the decision and the programme it relies on, so managing authorities, auditors, donors and oversight bodies can later prove that every payment had a valid basis and was made only once, without any personal data of beneficiaries leaving the authority. Every record is signed with the Module Lattice Digital Signature Algorithm, parameter set 65, as standardised in FIPS 204, and can carry a Qstamp time proof recorded on the Quantova network under the QAid record kind.

QAid is part of QGov, the government branch of the Qstamp family.

## What QAid is

Benefit, grant and aid programmes make very large numbers of payments through several systems. Payments to people never assessed as eligible, the same entitlement paid twice, awards above the limits of a programme, or rules changed after decisions were made are rarely visible in any single system.

QAid removes that possibility. The managing authority seals each programme with its rules, budget, largest award and approval limit. Intake seals each application, naming the applicant only by a salted commitment. An assessing officer seals each eligibility decision against the application and the programme, and the decisions of a programme form a series whose running total cannot exceed its budget and in which an applicant can receive only one award. Awards above the approval limit need the approval of a second officer, and a paying officer seals each disbursement against the decision, carrying the running total paid on the award.

QAid is standalone. It runs on the systems of its users, holds keys locally and uses the Quantova network only as a neutral public ledger for time proofs.

## What it detects

1. A record altered, replaced, inserted or backdated after it was sealed.
2. An application received before the programme opened.
3. An award above the largest award of the programme, awards that together exceed its budget, or a second award to the same applicant in the same programme.
4. A disbursement above its award, or a disbursement of an award above the approval limit without the approval of a second officer.
5. Two different decisions or disbursements in the same position of a series, once the records held for the series are supplied.
6. A record signed by a key that is not trusted for its role, or two linked records signed by the same key.

## Who uses it

1. Ministries and agencies that run benefit, grant and subsidy programmes.
2. Humanitarian and development bodies that disburse aid.
3. Supreme audit institutions, donors and oversight bodies that examine programmes.

## How a managing authority integrates QAid

1. Issue keys by role. The managing authority, application intake, assessing officers, approving officers and paying officers hold separate ML-DSA-65 keys. The verifier is given one list of trusted keys for each role, managing authority key, application intake key, assessing officer key, approving officer key and paying officer key. A key may appear in only one list, and QAid refuses to sign a record with the key that signed a record it relies on.

2. Name applicants privately. The commitParty function turns each applicant identifier into a salted commitment, and the authority derives it from its own 32 byte secret and the reference of the programme, so the same applicant always receives the same commitment in a programme and a repeated applicant is detected.

3. Seal the programme. The authority calls programme with the title, the fingerprint of the rules, the currency, the budget, the largest award, the approval limit and the opening time.

4. Seal applications and decisions. Intake calls application against the programme. An assessing officer calls decision against the application and the programme, naming the previous decision of the programme or declaring it the first.

5. Approve and pay. Awards above the approval limit are approved with approval by a second officer. A paying officer calls disbursement against the programme, the decision and any approval, naming the previous disbursement of the decision or declaring it the first. Recoveries are sealed with recovery.

6. Anchor promptly. A single service with a funded Quantova account anchors new records in batches under the QAid record kind, and each record receives its own receipt.

7. Verify on demand. Auditors and courts verify any record against the lists of trusted keys and the records held, with the verify command, the library or the independent procedure below.

## What is published and what stays private

Beneficiary identities, household data and bank details stay with the authority. Applicants are named only by salted commitments, which cannot be reversed and cannot be linked across programmes without the salts held by the authority.

When a record is anchored, only a 32 byte Qstamp commitment reaches the chain. It is derived from a salted fingerprint of the signed record and cannot be reversed into any field of the record.

## Cryptographic construction

1. Keys. Keys are 32 byte seeds from which ML-DSA-65 key pairs are derived by the key generation procedure of FIPS 204. A key identifier is the SHA3 hash with a 256 bit output of the ASCII label quantova/qaid/key/1, the byte 0x00 and the 1952 byte public key.

2. Party commitments. A party is named by the SHA3-256 hash of the ASCII label quantova/qaid/party/1, the byte 0x00, a random 32 byte salt and the identifier in Unicode normal form C. When the authority supplies its own 32 byte secret and the reference of the record that defines the series, the salt is instead the SHA3-256 hash of the ASCII label quantova/qaid/party-salt/1, the byte 0x00, the secret, the 32 byte reference and the identifier in Unicode normal form C, so the same party always receives the same commitment in that series.

3. Statements. Each statement is a canonical binary encoding that begins with the ASCII bytes QAID and the version byte 1, followed by the statement type and its fields in a fixed order. Every field is an unsigned 16 bit big endian length followed by its bytes. Identifiers, key identifiers, references and digests are encoded as raw bytes, an absent reference is an empty field, sequence numbers and sizes are unsigned 64 bit big endian integers, and text is UTF-8 in Unicode normal form C, so every statement has exactly one encoding. Amounts are whole numbers of minor units with no leading zeros, and a currency is three capital letters, which QAid checks for form only, so the integrating system should use ISO 4217 codes.

4. Signatures. Statements are signed with ML-DSA-65 in its hedged form under the FIPS 204 context string quantova/qaid/1, which separates QAid signatures from every other SDK of the family and from every other use of the algorithm.

5. References. A record is referenced by the SHA3 hash of the label quantova/qaid/ref/1, the byte 0x00, the encoded statement and its signature. Each record names the records it relies on by these references, so it relies on one exact signed record that existed before it was signed.

6. Series. The decisions of one programme form a series, and the disbursements of one decision form a series. Every record of a series carries its position from one and the reference of the previous record of the series, which is empty only for the first, and a running total including itself.

7. Anchor. To anchor a record, QAid stamps the SHA3 hash of the label quantova/qaid/anchor/1, the byte 0x00, the encoded statement and its signature as a Qstamp record of kind 1105.

## Record types

| Type | Signed by | Relies on | Series |
|---|---|---|---|
| programme | managing authority key | none | none |
| application | application intake key | programme | none |
| decision | assessing officer key | programme, application | per programme, running total capped by the budget of the programme, one record per applicant |
| approval | approving officer key | decision | none |
| disbursement | paying officer key | programme, decision, approval when required | per decision, running total capped by the award of the decision |
| recovery | managing authority key | decision | none |

## Rules applied by verification

1. The expected record type is required, so a record of one type can never be presented as another, and options that do not apply to that type are refused.
2. The record is well formed and signed by the key it names, and that key is trusted for the role of its type. The lists of trusted keys must not share a key.
3. Every record the record relies on, and every earlier record of each series involved, is taken from the records supplied and verified in turn by the same rules.
4. Each linked record is exactly the one referenced, of the expected type, signed by a different key, and dated no later than the record that relies on it.
5. Copied and matched fields agree with the records they come from, and limits taken from linked records are respected.
6. Each record of a series continues the previous record in position, running total and currency, and any limit on the series is respected.
7. Any two different supplied records in the same position of a series involved make the result invalid.
8. A record that depends on a series is valid only when the verifier declares that every record it holds for the series involved was supplied. Without that declaration the result is indeterminate, and with it a missing record makes the result invalid.
9. An application is received no earlier than the opening of its programme.
10. A disbursement of an award above the approval limit of its programme names an approval of the same decision by a second officer.
11. When documents are supplied, their fingerprints match the signed fingerprints, and when a party identity and salt are supplied, they match the commitment.
12. Each anchor is verified under the QAid record kind with a SHA3 digest, and the stated time is not later than the anchor time, allowing five minutes. An anchor more than twenty four hours after the stated time, unless another limit is given, or later than a given verification time, does not prove the stated time and makes the result indeterminate.

A result is valid only when the trusted keys are given, every record relied on is supplied, the records held for each series are declared complete where a series is involved, and every record is anchored. When any of these is missing the result is indeterminate rather than valid. A record verified with anchoring not required proves only who signed it and what was signed, and its stated time is the claim of its signer.

## Trust model of this release

This release anchors on the live Quantova network Q-test-net-1. The signing module is compiled from the Quantova Q-Crypto library, which follows FIPS 204 and FIPS 202 and has been tested against the NIST vectors. It has not been validated under FIPS 140-3. Anchor times are confirmed by the endpoints a verifier queries and are accepted only when at least two endpoints run by different operators agree. Verification names the endpoints it consulted and says whether they are the official endpoints of the network, and a verifier who needs independence from any single operator should query several independent endpoints.

A sealed record proves who signed it, what was signed and when it was anchored. Each check is made from the records a verifier is given, so two records in the same position of a series are detected only when both are supplied, and auditors should obtain every record held for the series they examine. A party commitment is the same in every record that uses the same salt, so records about one party can be linked by anyone who sees them, and anyone who obtains the salt can test guesses of the identifier, so salts must be protected like the identifiers themselves. Verifiers must keep the keys of retired officials in the trusted lists for as long as records they signed are verified. A sealed record does not verify the truth of what an applicant declared, which remains a matter for the authority and its investigators. One award per applicant is enforced through the applicant commitment, so the authority must derive applicant commitments from its secret and the programme reference, with commit-party and the options secret-file and scope or with commitParty and the options secret and scope, because two random salts for the same applicant produce two different commitments.

## Installation

```
npm install @quantovainc/qaid
```

QAid requires Node 20 or later.

## Command line use

```
qaid keygen authority.key
qaid keygen intake.key
qaid keygen assessor.key
qaid keygen approver.key
qaid keygen payer.key
qaid key authority.key > authority.pub.json
qaid key intake.key > intake.pub.json
qaid key assessor.key > assessor.pub.json
qaid key approver.key > approver.pub.json
qaid key payer.key > payer.pub.json
qaid commit-party --identity-file household.txt --secret-file authority.secret --scope PROGRAMME_REF --salt-out household.salt

qaid programme --key authority.key --title "Flood relief 2026" --rules rules.pdf --currency EUR --budget 10000000 --max-award 20000 --approval-above 10000 --opens-at 2026-10-01T00:00:00.000Z --out programme.json
qaid application --key intake.key --programme programme.json --applicant-ref <commitment> --content application.pdf --out application.json
qaid decision --key assessor.key --programme programme.json --application application.json --award 8000 --first --out decision.json
qaid disbursement --key payer.key --programme programme.json --decision decision.json --amount 8000 --first --out disbursement.json
qaid anchor programme.json application.json decision.json disbursement.json --seed-file account.key

qaid verify disbursement.json --type disbursement --authority authority.pub.json --intake intake.pub.json --assessor assessor.pub.json --approver approver.pub.json --payer payer.pub.json --record programme.json --record application.json --record decision.json --all-supplied
```

The file account.key holds the 32 byte seed of a funded Quantova account, as 64 hexadecimal characters, which pays for anchoring. It is separate from the signing keys of officials.

If anchoring is interrupted after its transaction may have been sent, a pending stamp is kept beside each envelope and the envelopes are not anchored again. Finish with qaid complete, giving the same envelopes in the same order and the pending stamp.

The command exits with status 0 when the result is valid, 1 when it is invalid, refused or the evidence is malformed, 2 when it cannot be decided, and 64 for usage errors. Key and salt files must be readable only by their owner and are never followed through symbolic links.

## Independent verification procedure

1. Decode each public key and signature from base64 and confirm their lengths are 1952 and 3309 bytes.
2. Compute each key identifier from the label quantova/qaid/key/1, the byte 0x00 and the public key, and compare it with the signer identifier and the signing party named in the statement.
3. Encode each statement as described above and verify its signature with ML-DSA-65 under the context string quantova/qaid/1, following FIPS 204.
4. Compute the reference of each linked record and of each earlier record of each series, confirm each is the one named, and apply the rules of verification listed above.
5. Compute the anchor value of each record and verify its receipt by the procedure published with Qstamp under record kind 1105.

## Network

The live Quantova network is named Q-test-net-1 with genesis hash ca91e093bb8de33e90db52d7c89876597d14760703793ea7211929e73e613062. Anchors are recorded by the official Qstamp contract on that network. The public endpoint is https://rpc-testnet.quantova.org. Chain data is accepted only when at least two endpoints run by different operators agree. Give them with the rpc or clients option, or with --rpc once for each on the command line. The option trustSingleEndpoint, or --trust-single-endpoint, relies on one endpoint, which can then invent an anchor alone.

## Licence

QAid is created and owned by Quantova Inc. It is licensed under the Apache License 2.0 or the MIT licence, at your option. The full texts are in the files LICENSE-APACHE and LICENSE-MIT, and the notice is in NOTICE.

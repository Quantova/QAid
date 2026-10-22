# QAid

QAid is a post quantum integrity layer for grants, subsidies and aid. It seals the rules of each programme, every application, every eligibility decision, every approval and every disbursement, and links each payment to the decision and the programme it relies on, so managing authorities, auditors, donors and oversight bodies can later prove that every payment had a valid basis and was made only once, without any personal data of beneficiaries leaving the authority. Every record is signed with the Module Lattice Digital Signature Algorithm, parameter set 65, as standardised in FIPS 204, and can carry a Qstamp time proof recorded on the Quantova network under the QAid record kind.

QAid is part of QGov, the government branch of the Qstamp family.

## What QAid is

Benefit, grant and aid programmes make very large numbers of payments through several systems. Payments to people never assessed as eligible, the same entitlement paid twice, awards above the limits of a programme, or rules changed after decisions were made are rarely visible in any single system.

QAid removes that possibility. The managing authority seals each programme with its rules, budget, largest award and approval limit. Intake seals each application, naming the applicant only by a salted commitment. An assessing officer seals each eligibility decision against the application and the programme, and the decisions of a programme form a series whose running total cannot exceed its budget and in which an applicant can receive only one award. Awards above the approval limit need the approval of a second officer, and a paying officer seals each disbursement against the decision, carrying the running total paid on the award.

QAid is standalone. It runs on the systems of its users, holds keys locally and uses the Quantova network only as a neutral public ledger for time proofs.

## What it detects

1. A record altered, replaced, inserted or backdated after it was sealed.
2. An application received before the programme opened or anchored after it closed.
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

2. Name applicants privately. The authority keeps a 32 byte secret made with keygen. Each application derives the applicant commitment from that secret, the reference of the programme and the canonical applicant identifier, so the same applicant always receives the same commitment in a programme however the identifier is written, and a repeated applicant is detected. QAid refuses to make an application from a commitment with a random salt.

3. Seal the programme. The authority calls programme with the title, the fingerprint of the rules, the currency, the budget, the largest award, the approval limit, the opening time and the closing time. Applications are received only before the programme closes, and an application must be anchored before then to be valid.

4. Seal applications and decisions. Intake calls application against the programme with the applicant identifier and the secret of the authority. An assessing officer calls decision against the application and the programme, naming the previous decision of the programme or declaring it the first.

5. Approve and pay. Awards above the approval limit are approved with approval by a second officer. A paying officer calls disbursement against the programme, the decision and any approval, naming the previous disbursement of the decision or declaring it the first. Recoveries are sealed with recovery.


Signing alone is not a gate. Two officials who each hold the same previous record can both sign the next record of a series, so decision and disbursement take a ledger, one folder or one store with an atomic compare and swap shared by every signer, which serialises the decisions of a programme and the disbursements of a decision. With it a record is signed only when it follows the latest record of its series that the ledger holds, and a second first record or a record after a stale previous one is refused with the code QAID_LEDGER. The ledger also records every value that must not repeat within a series, so a value already used by any earlier record of the series is refused, not only one used by the previous record. Each record of a series needs ledger, or ledger set to false when the integrating system serialises each series itself.

6. Anchor promptly. A single service with a funded Quantova account anchors new records in batches under the QAid record kind, and each record receives its own receipt.

7. Verify on demand. Auditors and courts verify any record against the lists of trusted keys and the records held, with the verify command, the library or the independent procedure below.

## What is published and what stays private

Beneficiary identities, household data and bank details stay with the authority. Applicants are named only by salted commitments, which cannot be reversed and cannot be linked across programmes without the salts held by the authority.

When a record is anchored, only a 32 byte Qstamp commitment reaches the chain. It is derived from a salted fingerprint of the signed record and cannot be reversed into any field of the record.

## Cryptographic construction

1. Keys. Keys are 32 byte seeds from which ML-DSA-65 key pairs are derived by the key generation procedure of FIPS 204. A key identifier is the SHA3 hash with a 256 bit output of the ASCII label quantova/qaid/key/1, the byte 0x00 and the 1952 byte public key.

2. Party commitments. Each party identifier is first made canonical. It is brought to Unicode normal form KC, every decimal digit of any script is replaced by the ASCII digit of the same value, combining marks of the Inherited script are removed, spaces, punctuation and invisible characters are removed, case is folded, and every character is replaced by its prototype in the confusable skeleton of Unicode Technical Standard 39, version 18.0.0, first in upper case and then in lower case, until the result no longer changes. An identifier that holds an unassigned character, or no letter or digit, is refused. A party is then named by the SHA3-256 hash of the ASCII label quantova/qaid/party/3, the byte 0x00, a 32 byte salt and the canonical identifier in UTF-8, so the same identifier written with other case, spacing, separators or lookalike letters gives the same commitment. The salt is random or reused from an earlier commitment, or, when the authority supplies its own 32 byte secret and the reference of the record that defines the series, it is the SHA3-256 hash of the ASCII label quantova/qaid/party-salt/3, the byte 0x00, the secret, the 32 byte reference and the canonical identifier, so the same party always receives the same commitment in that series. A commitment made under an earlier scheme is refused.

3. Statements. Each statement is a canonical binary encoding that begins with the ASCII bytes QAID and the version byte 3, followed by the statement type and its fields in a fixed order. Every field is an unsigned 16 bit big endian length followed by its bytes. Identifiers, key identifiers, references and digests are encoded as raw bytes, an absent reference is an empty field, sequence numbers and sizes are unsigned 64 bit big endian integers, and text is UTF-8 in Unicode normal form C, so every statement has exactly one encoding. Amounts are whole numbers of minor units with no leading zeros, and a currency is three capital letters, which QAid checks for form only, so the integrating system should use ISO 4217 codes. This release reads records of format version 3 only, so a record made by an earlier release in an older format verifies as invalid.

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
8. A record that depends on a series is valid only when the verifier declares that every record it holds for the series involved was supplied. Without that declaration the result is indeterminate, and with it a missing record makes the result invalid. The verifier gives in records every record it holds for each series involved, because a second record at the same position is found only among the records given, and allSupplied is a declaration that it did so.
9. An application is received no earlier than the opening of its programme and is anchored before its closing time, and an application without a proven anchor time is indeterminate unless anchoring is not required and its stated time is before the closing time. It states in its signed field partyScheme that the applicant was derived as secret-scope-canonical/2, the only scheme of this format. A decision names no applicant that an earlier decision of the programme already named.
10. A disbursement of an award above the approval limit of its programme names an approval of the same decision by a second officer.
11. When documents are supplied, their fingerprints match the signed fingerprints, and when a party identity and salt are supplied, they match the commitment.
12. Each anchor is verified under the QAid record kind with a SHA3 digest, and the stated time is not later than the anchor time, allowing five minutes. An anchor more than twenty four hours after the stated time, unless another limit is given, or later than a given verification time, does not prove the stated time and makes the result indeterminate. When different anchors of one record are supplied, anchors that do not commit to the record are set aside, the others are taken in order of anchor time, chain, height, transaction and position in the batch, and the earliest that verifies is used, so a later anchor added by anyone cannot displace an earlier one. An anchor that cannot be checked keeps the result indeterminate only when it could be earlier than the anchor that verifies. One that claims an earlier time at a height on the same chain no lower than the verified anchor is set aside, because an honest chain cannot hold it, and an unchecked anchor never removes the time proven by a verified one. Anchors are read at most four at a time. Each anchoring transaction is read once per verification, at most eight for each record supplied plus 32 unless maxAnchorLookups gives another bound, and a record whose anchor was not read within that bound is indeterminate. A verification that has not finished within deadlineMs, two minutes unless given, stops with the result indeterminate and a time limit check that says so. When keyStatus is given it is asked for the registry status of each signing key and must answer, within keyStatusTimeoutMs or ten seconds, with an object whose revoked is true or false and, when revoked is true, whose revokedAt is the time of the revocation in whole seconds since 1970, not before the genesis of the network. Any other answer, an error or no answer in time makes the result indeterminate. The time of verification is read from the chain unless it is given with at, and when it cannot be read verification stops with an error rather than use the local clock.

A result is valid only when the trusted keys are given, every record relied on is supplied, the records held for each series are declared complete where a series is involved, and every record carries a proven anchor. When any of these is missing the result is indeterminate rather than valid, except that a record which moves value is invalid when a record it relies on is not supplied. A record verified with anchoring not required proves only which key signed it and what was signed, and its stated time is the claim of its signer.

## Trust model of this release

This release anchors on the live Quantova network Q-test-net-01. The signing module is compiled from the Quantova Q-Crypto library, which follows FIPS 204 and FIPS 202 and has been tested against the NIST vectors. It has not been validated under FIPS 140-3. An anchor time is accepted only when Qstamp proves the anchor, either by a finality certificate checked against a pinned validator roster or by official endpoints of the network run by two different operators. An anchor confirmed by endpoints of one operator, or by endpoints chosen by the verifier, is unproven. An unproven anchor is treated as not anchored and makes the result indeterminate, never valid, whatever options are set. While the network has one official endpoint and no pinned roster every anchor is unproven, which is the honest result. Verification names the endpoints it consulted and says whether they are the official endpoints of the network.

A sealed record proves which key signed it, what was signed and when it was anchored. Each check is made from the records a verifier is given, so two records in the same position of a series are detected only when both are supplied, and auditors should obtain every record held for the series they examine. A party commitment is the same in every record that uses the same salt, so records about one party can be linked by anyone who sees them, and anyone who obtains the salt can test guesses of the identifier, so salts must be protected like the identifiers themselves. Verifiers must keep the keys of retired officials in the trusted lists for as long as records they signed are verified. A sealed record does not verify the truth of what an applicant declared, which remains a matter for the authority and its investigators. One award per applicant is enforced through the applicant commitment, which every application derives from the secret of the authority and the programme reference. The secret stays with the authority, so a verifier cannot recompute the commitment and relies on the signed scheme field and on intake using the one secret of the authority for the whole programme. Anyone who holds the secret can test guesses of applicant identifiers, so it must be protected like the identifiers themselves. Two applicants whose identifiers differ only in case, spacing, separators or lookalike letters are treated as one applicant. No anchor proves that a record was not made before the time it states, so a rule that a record comes after a moment, such as an application received after the programme opened, rests on the stated time of a trusted signer.

## Threat model

QAid protects every record from programme to disbursement, the keys of each role, the secret behind applicant commitments, the series ledger shared by the signers, and the receipts of anchors.

It trusts the role key lists that the verifier gives, the key registry it consults through keyStatus, the network values pinned in the Qstamp release it depends on, and the storage that holds keys, the secret and the ledger. It does not trust the gateway or any endpoint, the holders of records, or any record not signed by a trusted key for its role.

A forged or altered record fails its signature or the reference that a later record names, and two linked records signed by one key are refused. Signatures use the context string quantova/qaid/1 and anchors use record kind 1105, so a record signed or anchored for another SDK never verifies here, and every anchor is checked against the genesis and contract pinned in the Qstamp release. A hostile gateway cannot make an unproven anchor count, the local clock is never used as the time of verification, and an anchor more than 24 hours after the stated time does not prove that time. An application anchored after its programme closed is invalid. Running totals cap awards by the budget and disbursements by their award, and one applicant receives one award in a programme. The ledger refuses a second record at a position it holds, two different records at one position are invalid once both are supplied, and a ledger folder that every user can write, or that lies under a folder another user can change, is refused. A record anchored after the revocation time that keyStatus reports for its key is invalid. Input is parsed strictly within fixed size and time limits.

Left to the integrator are the protection of keys and the secret, keeping the ledger folder writable only by the signers and backed up whole, since a folder rolled back or missing a file lets a position be signed again, and supplying every record held for each series. Intake must use one secret for the whole programme, QAid does not verify what an applicant declared, and that an application came after the programme opened rests on the stated time of a trusted signer.

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
qaid keygen authority.secret

qaid programme --key authority.key --title "Flood relief 2026" --rules rules.pdf --currency EUR --budget 10000000 --max-award 20000 --approval-above 10000 --opens-at 2026-10-01T00:00:00.000Z --closes-at 2026-12-31T23:59:59.999Z --out programme.json
qaid application --key intake.key --programme programme.json --applicant-file household.txt --party-secret-file authority.secret --content application.pdf --out application.json
mkdir ledger
qaid decision --key assessor.key --programme programme.json --application application.json --award 8000 --first --ledger ledger --out decision.json
qaid disbursement --key payer.key --programme programme.json --decision decision.json --amount 8000 --first --ledger ledger --out disbursement.json
qaid anchor programme.json application.json decision.json disbursement.json --network testnet --seed-file account.key --trust-single-endpoint

qaid verify disbursement.json --type disbursement --network testnet --authority authority.pub.json --intake intake.pub.json --assessor assessor.pub.json --approver approver.pub.json --payer payer.pub.json --record programme.json --record application.json --record decision.json --all-supplied --trust-single-endpoint
```

The file account.key holds the 32 byte seed of a funded Quantova account, as 64 hexadecimal characters, which pays for anchoring. It is separate from the signing keys of officials.

The network has one official endpoint today, so the anchor and verify commands above are given --trust-single-endpoint to rely on it. Without that flag they stop, because chain data is accepted only when endpoints of two different operators agree. With it a verification reports INDETERMINATE and exits with status 2, because an anchor confirmed by one operator is unproven. Once the Qstamp release lists official endpoints of two different operators the flag is no longer needed.

Every command that signs a record of a series takes --ledger with the folder shared by every signer of the series, as in the example above. The ledger folder records every position already signed, so keep it on storage that only the signing service can write to, never edit or delete a file in it, and back it up as a whole, because a folder that is rolled back or loses a file lets a position be signed a second time. Without --ledger it signs nothing and exits with status 64, unless --no-ledger declares that the integrating system serialises the series itself.

If anchoring is interrupted after its transaction may have been sent, a pending stamp is kept beside each envelope and the envelopes are not anchored again. Finish with qaid complete, giving the same envelopes in the same order and the pending stamp.

The command exits with status 0 when the result is valid, 1 when it is invalid, refused or the evidence is malformed, 2 when it cannot be decided, and 64 for usage errors. Key and salt files must be readable only by their owner and are never followed through symbolic links.

## Independent verification procedure

1. Decode each public key and signature from base64 and confirm their lengths are 1952 and 3309 bytes.
2. Compute each key identifier from the label quantova/qaid/key/1, the byte 0x00 and the public key, and compare it with the signer identifier and the signing party named in the statement.
3. Encode each statement as described above and verify its signature with ML-DSA-65 under the context string quantova/qaid/1, following FIPS 204.
4. Compute the reference of each linked record and of each earlier record of each series, confirm each is the one named, and apply the rules of verification listed above.
5. Compute the anchor value of each record and verify its receipt by the procedure published with Qstamp under record kind 1105.

## Network

The live Quantova network is named Q-test-net-01. Its genesis hash and the official Qstamp contract that records anchors are pinned in the Qstamp release this SDK depends on. The public endpoint is https://q-test-net-01.quantova.org. By default verification consults the official endpoints of the network. On the command line a note, an amount or a text field can be read from a file with its -file flag, or from standard input with -, so confidential values stay out of the shell history and the process list. Every verification names the network its records were anchored on with the network option, or --network on the command line, testnet for the public network or custom for a chain reached only through endpoints the verifier chose, and an anchor recorded on any other network fails. Endpoints chosen by the verifier are given with the rpc or clients option, or with --rpc once for each on the command line, and verification consults them only with trustCustomEndpoints, or --trust-custom-endpoints. An endpoint on a loopback address is refused unless allowLoopback, or --allow-loopback, is set, and an endpoint on a private network address unless it is named in endpointAllowList, or with --allow-endpoint. The option expectedSender, or --expect-sender, names the Quantova accounts entitled to anchor records, and an anchor signed by any other account is invalid. Anchoring accepts chain data only when at least two endpoints run by different operators agree, and the option trustSingleEndpoint, or --trust-single-endpoint, relies on one endpoint for anchoring and for the time of the chain.

## Licence

QAid is created and owned by Quantova Inc. It is licensed under the Apache License 2.0 or the MIT licence, at your option. The full texts are in the files LICENSE-APACHE and LICENSE-MIT, and the notice is in NOTICE.

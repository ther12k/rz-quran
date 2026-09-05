# Content, Curriculum & Religious-Integrity Specification

## 1. Responsibility and boundaries

The application supports practice; it does not issue a fatwa, certify tajwid, judge religiosity or prove memorization. A qualified human content lead must approve the curriculum, script edition, pronunciation conventions, reciter selection and lesson wording. An implementation agent cannot supply that approval.

No production Qur'an corpus or recitation files are included. The PNG mockups contain generated Arabic-like decoration and fictional examples. Treat every such mark as unverified illustration, not as text suitable for instruction.

## 2. Source strategy

**Canonical text candidate:** Tanzil's verified text distribution, subject to its stated license and usage conditions [S11]. Its text terms require verbatim preservation and attribution/linking; do not assume that permission covers translations, recordings or every derivative asset. Keep the applicable notice with the distribution and provide source attribution in the parent/source area and relevant learning views.

**Provider integration candidate:** Quran Foundation Content APIs for text/audio metadata and supported resources [S12]. The current backend-oriented flow requires app credentials and approved environment permissions. Use the backend only. API access is not a blanket grant of recording redistribution, offline download, caching or commercial rights.

**Hijaiyah audio:** commission or license clearly recorded letter sounds from an approved educator/reciter. Use one pronunciation convention per module. Do not generate an authoritative recitation track with generic TTS. Store consent/usage rights for the adult voice talent independently of child privacy records.

**Translation and explanations:** optional in the pilot and separately sourced/reviewed. Do not copy translations from arbitrary websites or infer that a Qur'an text license licenses them. If rights are unresolved, omit the optional translation and show only reviewed instructions rather than generating one.

**Illustrations and fonts:** create or license production assets. The supplied concepts are visual references, not a license dossier. Do not distribute font binaries from this handoff. Confirm licenses for any eventual selected production font.

## 3. Source registry fields

Each release: source ID; source kind; organization/creator; title; edition/version; acquisition date; original reference; permitted uses (display, streaming, redistribution, offline); license or agreement reference; attribution requirements; evidence object; immutable raw checksum; reviewer; rights decision and expiry/recheck date when applicable.

Rights states: pending, approved, denied, revoked. Technical availability never moves a source to approved. A human rights reviewer records a documented decision. Revocation identifies dependent assets/lessons and initiates recall as needed.

## 4. Ingestion pipeline

Register source → acquire permitted original bytes server-side → quarantine → compute SHA-256 → validate format/encoding and metadata → map chapter/verse/unit references → generate staff preview → human content review → approve candidate → publish immutable release.

Reject missing source versions, incomplete attribution, duplicate/conflicting verse keys, count mismatches against approved metadata, unsupported encoding, zero-byte audio, bad duration/segment bounds and mismatched checksums. Preserve original text exactly; do not automatically normalize Arabic characters or strip marks to “fix” a validation failure.

For JSON imports, validate `contracts/lesson.schema.json` then apply domain checks: IDs unique, ordinals contiguous, referenced sources/assets exist, required-unit count >0, every choice unit has a question, every correct option belongs to its question, quiz/game has exactly five required choice units in the pilot. Schema validity alone cannot establish truth, legality or educational suitability.

## 5. Text and audio verification

Review every pilot ayah against the chosen source edition and its chapter metadata. Do not insert or omit basmala by a generic string rule; its placement/numbering follows the selected edition and unit mapping. Each mapping records source ID, verse key, reciter, recording source and either a whole-verse file or reviewed start/end timestamps.

A human listens to every pilot segment, checking that the intended verse is complete, not clipped, not paired with another verse and free from unintended intro/outro material. A second person checks the text/audio alignment and child-facing instructions. Automated duration/hash checks support this work; they do not replace listening.

Arabic rendering is checked using real canonical text, including combining marks, verse markers, line wraps and mixed RTL/LTR references. Prevent machine translation overlays from changing canonical blocks. Optional transliteration is off for MVP unless separately approved; it must never replace Arabic or be presented as pronunciation certification.

## 6. Proposed curriculum inventory

| Track | Pilot proposal | Completion meaning |
| --- | --- | --- |
| Foundations | 12 short lessons across 6 selected letters | Required recognition/listening activities completed |
| Short-surah practice | Al-Fatihah, Al-Ikhlas, Al-Falaq, An-Nas, Al-Kautsar | Required ayah practice units acknowledged |
| Quiz | Four reviewed sets, five questions each | Five first responses and feedback acknowledgments |
| Game | One five-round sound-to-letter template with reviewed variants | Five rounds completed |

Sequence proposal: recognize shape → hear sound → imitate privately → distinguish from similar shapes → short retrieval practice → parent-guided review. The content lead chooses the actual letter sequence; this package does not present a universally correct pedagogical order.

Lesson duration estimates are planning labels, not mandatory timers. Default goals of 5/10/15 minutes are parent-selected comfort options, not health guidance.

## 7. Learning rules

Avoid conflating a letter's name with its sounded form under a particular vowel mark. An activity prompt must clearly say what is being identified or repeated. For a sound-matching question, distractors must be reviewed for ambiguity and appropriate difficulty.

For every lesson record: target skill, prerequisites, explanation, required units, source dependencies, correct-answer rationale and a completion definition. A parent can choose a starting stage without rewriting historical completion. A curriculum release is an acyclic graph with a fixed list of included lesson IDs so denominator changes can be explained.

Do not gate essential review behind points or payment. Repetition remains freely available. Feedback says “Coba lagi” or “Bagus, kamu sudah berlatih,” not “bacaanmu sempurna” when no expert listened.

## 8. Review and publishing checklist

Editor and reviewer are different people. Verify source/rights status, exact Arabic, reference mapping, all audio segments, instructional wording, question correctness, distractors, accessibility and mobile rendering. Approve a release hash, not a mutable file name. A change after review invalidates the decision for that changed candidate.

Publisher may publish only when review and rights checks are satisfied. Staff roles can be combined operationally only where separation of author and reviewer is preserved; no self-approval. Maintain a preview link that is staff-authenticated and cannot leak draft answers publicly.

## 9. Correction and recall

Parents report a reason (`wrong_text`, `wrong_audio`, `unclear_instruction`, `other`) from their gated area. Reports are not displayed to other users. Triage critical text/audio problems promptly; halt the affected content while investigating. Use a new reviewed release for corrections. Never overwrite canonical history.

If a licensing problem arises, revoke rights and inspect all dependent assets. A technical recall prevents new delivery but cannot erase bytes already downloaded by a user. Provide a calm child-facing unavailable state and a parent-facing explanation without unverified allegations about a provider.

## 10. Fixtures and production checks

The bundled `demo-hijaiyah-lesson.json` is a non-production authoring example with no audio and no Qur'an verses. It exercises schema parsing and UI empty-media behavior. Even a simple letter example is not labeled human-reviewed. A local demo may render it only under an explicit demo mode with a visible banner.

Production rejects `demo_only=true`, unresolved source rights, absent reviewer evidence, missing required audio and incomplete content dependencies. A test that passes these guards is still not a substitute for real content approval. Never copy the mockup's fictional percentages, dates or Arabic seals into seeded production data.

# Product Requirements Document
## RZ Qur'an Kids

**Version:** 1.0 | **Date:** 5 September 2026 | **Status:** proposed MVP baseline

**Owner:** product owner, to be assigned. **Primary audience:** children learning with a parent or guardian. **Market assumption:** Indonesia first. **Interface:** Bahasa Indonesia. **Working age bands:** 5–7 and 8–10, subject to curriculum and legal review. Age bands are product hypotheses, not declarations of legal eligibility.

### Document intent

This document defines a buildable learning product, not a claim that software can validate a child's Qur'an recitation. Requirements marked P0 are required for the MVP. P1 items are later increments. The six supplied images are concept references; the written UX and content rules resolve their inconsistencies. Reference sources are indexed in `12_SOURCES.md`. Targets below are proposed product/engineering targets, not measured results.

## 1. Product vision

Help a child complete a small, positive Qur'an learning activity, then help their parent understand what was practiced and what needs guided repetition. The product should make the next step obvious, use clear audio and readable Arabic, and encourage rest as well as consistency.

The public landing page preserves the user's central message: “Semua yang Dibutuhkan Anak untuk Belajar Al-Qur'an” and “Dirancang agar anak belajar lebih mudah, lebih menyenangkan, dan tidak cepat bosan.” The child's signed-in home is not a marketing brochure: it prioritizes one continue-learning action and a small choice of activities.

### Value proposition

A child can listen, imitate without recording, practice short surahs, recognize Hijaiyah letters, and play short learning games. A parent can choose a learning stage, see actual practice activity, and record their own assessment. A content team can publish only source-traceable, reviewed material.

### Problem hypotheses

Children may struggle with dense text, too many choices and interfaces built for adults. Parents may find it difficult to distinguish time spent from genuine fluency. Teams may accidentally introduce incorrect Arabic, mismatched audio or unlicensed assets when assembling a learning app. These hypotheses must be tested in supervised prototype sessions; they are not research findings established by this package.

## 2. Users and jobs to be done

| User | Job | Design consequence |
| --- | --- | --- |
| Early learner, proposed age 5–7 | “Show me what to do and let me hear it again.” | Large targets, short copy, audio prompts, one main task per view |
| Developing learner, proposed age 8–10 | “Let me continue and see what I have practiced.” | A visible path, short quizzes and non-competitive achievements |
| Parent or guardian | “Help me guide practice without overstating ability.” | Private progress, clear denominators and explicit parent assessments |
| Content editor | “Create structured lessons with a known source.” | Imports, metadata, validation and draft previews |
| Content reviewer/publisher | “Catch errors before children see them.” | Side-by-side source review, distinct reviewer and publication history |
| Operations administrator | “Keep access, data and published content safe.” | Role boundaries, audits, backups, rollback and content recall |

Children do not create email/password accounts. One verified adult account owns up to three child profiles in MVP. Profiles use nicknames, curated avatars and an age band; no exact date of birth, real photo, school or address is required by the default design. A jurisdiction-specific review may require a different eligibility/assurance flow before public release.

## 3. Outcomes and measurement

### Product success hypotheses

For an opt-in supervised pilot, target at least 80% of participating children completing the first guided activity with no more than one navigation intervention; at least 80% of parents correctly distinguishing “practice completed” from “memorization confirmed by parent”; and zero known critical Qur'an content errors at launch. These are decision thresholds, not promises of educational efficacy.

The main learning-use metric is **weekly practicing child profiles**: profiles with at least one server-accepted activity completion in a seven-day reporting interval. Do not optimize for maximum screen time. Track session completion, audio failure and parent usefulness alongside the main metric.

### Operational targets

Proposed production SLO: 99.5% monthly availability for authenticated learning API requests, excluding only explicitly scheduled maintenance. Proposed p95 API latency: under 500 ms for ordinary reads and writes at 50 concurrent active sessions, excluding media transfer, imports, export jobs and auth-email delivery. Validate on the deployment chosen for the pilot.

At a fixed mobile test profile, target LCP at or below 2.5 seconds, INP at or below 200 ms and CLS at or below 0.1 for the signed-in home. These are team performance budgets, not measurements. The default frontend initial route budget is 250 KB compressed JavaScript excluding on-demand media and fonts; exceeding it requires a recorded explanation.

## 4. Scope and release boundaries

### P0 — MVP

Parent onboarding and verified adult account; consent-state capture and production eligibility gate; up to three child profiles; one active profile per browser session; child-safe home; curated learning catalog; guided stages; listen-and-imitate player; short-surah practice; a five-question quiz engine; one sound-to-letter game; parent progress and assessment; child achievements; profile/settings; content source registration, review and publication; export and deletion; monitoring and restore procedures.

The public landing page explains all eight requested benefits. The application implements these as focused flows rather than eight dense cards on every child screen. The app is mobile-first with desktop and tablet layouts. Installable-shell support is included; full offline learning is not.

### P1 — after MVP evidence

Parent-controlled reminders, additional game types, more curriculum units, optional downloads of licensed content, careful offline synchronization, multiple guardians, teacher-assigned lessons and a wider surah library. Each is a separate scope decision.

### Explicitly excluded

Open-ended child chatbot, AI-generated Qur'an or tafsir, automated tajwid certification, microphone capture, voice biometrics, social feeds, user messaging, public rankings, purchases/subscriptions, school tenancy, native app-store builds, unlimited offline learning and a general-purpose full-Qur'an reader. No RAG or vector database is needed.

## 5. Learning and content baseline

Proposed pilot inventory: twelve guided lessons covering six selected foundational Hijaiyah letters with recognition, sound and short practice activities; five short-surah practice modules: Al-Fatihah, Al-Ikhlas, Al-Falaq, An-Nas and Al-Kautsar; four quiz sets of five items; one five-round sound-to-letter game; and a small set of practice achievements.

This inventory is a workload proposal, not a completed or scholar-approved curriculum. A qualified content lead must approve the sequence, pronunciation conventions, reciter, script edition and lesson objectives before publication. The twelve lessons do not imply mastery of the entire alphabet or the ability to read the Qur'an independently.

Canonical verse text, recitation audio, translation, explanations and illustrations have separate provenance and rights records. Import verified source bytes; never transcribe Qur'an from generated images. In development, unavailable audio produces an honest unavailable state, not synthetic substitute recitation.

## 6. Primary journeys

### J1 — Parent sets up learning

Parent opens the public landing page, reviews the parent notice, creates and verifies an adult account, completes the approved consent/eligibility flow, chooses a timezone and creates a nickname/avatar/age-band profile. The parent selects a starting stage and an optional session goal of 5, 10 or 15 minutes. The app opens child mode, revokes the adult gate and shows one suggested activity.

A product demo can use a non-production consent simulation. Production cannot create real child profiles until the configured legal policy and assurance flow are approved. Failure to verify an email or complete a required step preserves parent-only access without silently creating a child record.

### J2 — Child learns a letter

Child taps “Lanjut belajar,” sees the letter and short instruction, taps “Dengarkan,” hears approved audio, repeats aloud privately, and selects a recognition answer. The application records verified activity steps and presents encouragement. A correct practice answer is not proof of pronunciation. Completion unlocks the next stage only through the defined server rules.

### J3 — Child practices a short surah

Child selects an available surah, views an ayah with its correct reference, listens, pauses, repeats one or three times, then moves to the next ayah. The session can stop and resume at the last accepted ayah. A session summary says how much was practiced, not “you have memorized this.” A parent can later record “Perlu latihan,” “Mulai lancar” or “Lancar menurut orang tua.”

### J4 — Child plays or takes a quiz

Child chooses a quiz or a five-round sound-matching game. Each round has one task, large choices, optional replay and encouraging feedback. First-submission correctness is saved by the server; later retries support learning but do not inflate the recorded first-attempt score. There is no timer pressure, life counter, public ranking or streak penalty.

### J5 — Parent reviews and manages

Parent uses the protected parent entry, reauthenticates, selects their own child, and sees activity totals, a weekly chart, per-lesson history and parent assessments. They can adjust the stage, export data or delete a profile. Backing into child mode immediately closes adult privileges. Sensitive actions require fresh verification even within the parent area.

### J6 — Content team publishes safely

Editor registers a source and its rights evidence, imports a draft, assembles a structured lesson and submits for review. A different qualified reviewer verifies text, media mappings and child-appropriate copy against the source. An authorized publisher publishes an immutable version only when all checks pass. Retiring or recalling a version prevents new sessions; emergency recalls also interrupt in-flight sessions safely.

## 7. Functional requirements

### FR-01 — Adult onboarding and account access [P0]

Use a maintained auth library for adult accounts, verified email, password reset and session management. Provide clear sign-in failure, expired verification and recovery states. Staff accounts must use MFA before production content administration. Authentication does not by itself establish parental consent.

**Acceptance:** an unverified or policy-blocked adult cannot create a real child profile; successful verification does not auto-publish a consent record; password reset tokens are single-use/expiring through the auth provider; sign-out revokes the current application session and clears local private state.

### FR-02 — Child profiles and session separation [P0]

Store a nickname of 1–30 characters, a curated avatar key and an age band. Parent owns up to three active profiles. Selection establishes a server-side active child. Every switch stops audio, clears pending UI state and avoids cross-profile progress leakage.

**Acceptance:** parent A cannot read, edit, select, export or delete parent B's child through any ID substitution; the server rejects a fourth active profile; a deleted or suspended profile cannot start or complete a session.

### FR-03 — Parent gate and child mode [P0]

Child navigation must not expose parent reports, settings, personal information or outbound links. Returning to parent mode requires password reauthentication and creates a five-minute adult gate. Entering child mode clears that gate. Staff operations use a separate staff capability check, not parent status.

**Acceptance:** typing a parent API URL in child mode fails even with a valid adult account cookie; expired gate returns a predictable error; browser back does not restore cached private parent screens; the auth library's generic user-update endpoints cannot bypass child mode.

### FR-04 — Child home and public landing [P0]

Landing page shows the eight requested benefits and parent CTA. Child home shows nickname/avatar, one suggested or resumable lesson, a small category grid and a gentle session goal. No fabricated scores, notifications or streaks.

**Acceptance:** first-time, returning, all-complete and no-published-content states work; 320 CSS-pixel width has no page-level horizontal scrolling; decorative imagery never blocks a primary button; data cards show real state or explicit empty text.

### FR-05 — Catalog and guided stages [P0]

Provide filters for all lessons, sound, letters and memorization. Search only the curated catalog, not the public internet. Stages use published prerequisite links and server-computed completion. Parents may select a starting stage or grant a recorded unlock; children cannot self-override locks.

**Acceptance:** catalog never returns drafts or answer keys; missing prerequisites display a helpful next step; cycles are rejected at publication; content withdrawal cannot leave an unresolvable child dead end.

### FR-06 — Listen and imitate [P0]

A single audio player offers play/pause, replay, previous/next segment and repeat count 1 or 3. Default speed is 1.0× and no speed control is required in MVP. “Ikuti” means repeat aloud after playback; no recording or automatic scoring occurs.

**Acceptance:** audio starts only after a user action; route/profile changes stop the previous audio; failed media has a retry and a readable message; pause, buffering and ended states are distinct; cancellation prevents stale audio callbacks from advancing another lesson.

### FR-07 — Short-surah practice [P0]

Present reviewed ayah text and references, source/reciter attribution and sequential practice. Persist last accepted ayah and unique practiced units. Practice progress is separate from parent-assessed memorization status.

**Acceptance:** each verse/audio mapping matches the approved release; a percentage uses unique completed practice units, never a playback timer estimate; no “Sudah lancar” label is inferred from listening; unavailable/withdrawn ayat are not silently replaced.

### FR-08 — Interactive quizzes [P0]

Use five reviewed multiple-choice questions per configured set. Render one question at a time, with two to four alternatives according to the approved lesson. Record first-submission correctness. Allow a supportive retry; compute the session score on the server. Quiz sets must have at least five eligible items before publication.

**Acceptance:** client DTOs omit correct-answer fields; double-tapping submit creates one answer; invalid option IDs and questions from another session are rejected; retries do not award duplicate stars; zero answered items is “Belum ada kuis,” not 0% failure.

### FR-09 — Hijaiyah sound-matching game [P0]

One MVP game has five rounds: replay a reviewed letter sound, select the matching tile, receive feedback, continue. Tap selection is primary. Drag-and-drop may enhance it but is never the only interaction.

**Acceptance:** a complete game works with keyboard and single-pointer taps; no round depends only on color; incorrect choices allow retry without shame; the active round and success summary are separate states, unlike the simultaneous states in the concept image.

### FR-10 — Progress, resume and rewards [P0]

Persist validated activities, session durations, last position, lesson completion and practice rewards. A first completion of a logical lesson awards one non-spendable star; a parent override or migrated progress awards none. Replaying a lesson remains possible. Display descriptive achievements, not comparisons against other children.

**Acceptance:** repeated event IDs and concurrent finishes cannot duplicate progress or rewards; a new content version of the same logical lesson does not reset its first-completion star; interrupted sessions resume accurately; a practice session cannot assert that a child has mastered recitation.

### FR-11 — Parent dashboard and assessment [P0]

Show completed lessons as a numerator/denominator within an explicitly named assigned curriculum version; distinct surahs practiced; first-submission quiz accuracy over the selected interval; and estimated active practice time. A weekly chart has a text/table alternative. The parent can record a timestamped assessment for a surah and change it later with history.

**Acceptance:** totals and charts derive from the same scoped records/timezone; no data is shown as an empty state, not invented sample data; only the owning gated parent can write an assessment; the interface labels it as a parent's observation, not scholarly certification.

### FR-12 — Session goals and comfort settings [P0]

A parent can select a soft practice goal, enable/disable celebration sounds, and prefer reduced motion. At the goal, offer a calm break suggestion with “Selesai dulu” as the primary action. Resume remains possible without guilt. No push reminder or bell inbox in MVP.

**Acceptance:** the goal is not a medical recommendation or forced timer; quiet mode suppresses decorative sounds, not requested lesson audio; reduced-motion mode suppresses confetti/bounce; all preferences persist without cross-child leakage.

### FR-13 — Content registry and publication [P0]

Manage sources, rights decisions, assets, lessons, questions, curriculum ordering, review records and immutable releases. Publication requires a distinct editor/reviewer, complete source metadata, approved rights and integrity checks. Staff roles are provisioned out of band with least privilege.

**Acceptance:** unauthorized staff cannot publish; author cannot approve their own version; published payloads cannot be edited in place; source revocation identifies dependent versions; audit logs capture actor, object, action and outcome without copying child data.

### FR-14 — Content correction and recall [P0]

Provide a parent-side content-issue form and an emergency staff recall action. Parent reports allow a reason code and optional short text; no child photo/audio attachments. A recalled release is removed from the catalog and blocks continuation. Historical progress is retained as history with the content label.

**Acceptance:** recall invalidates served lesson/media entitlements within the configured five-minute content-status cache limit; a learner gets a safe return path; security-relevant recalls stop a current session on its next server check; no guarantee is made about already-downloaded bytes being erased remotely.

### FR-15 — Privacy, export and deletion [P0]

Provide a parent-readable data notice, versioned consent ledger, withdrawal, machine-readable export and deletion. Keep a clear distinction between operational data, optional analytics and legally reviewed records. No child analytics SDK, advertising ID, exact location or microphone permission.

**Acceptance:** withdrawal immediately blocks new learning writes for that profile; export contains only the requesting parent's data; downloads expire and require the adult gate; deletion removes active data and queues backup-retention handling; a confirmation explains any separately justified retention.

### FR-16 — Offline and reconnect behavior [P0]

Cache only the application shell and approved static visual assets in the service worker. Authenticated content, progress, adult data and media are network-only in MVP. During a brief connection loss in an already loaded session, retain a small pending event queue in memory; do not award authoritative completion until the server accepts it.

**Acceptance:** cold offline launch shows “Sambungkan internet untuk mulai belajar”; reconnection retries the same event IDs; page reload may discard unsent work and the UI explains that limit; refresh/logout clears private state; no “works fully offline” marketing.

### FR-17 — Responsive accessibility and localization [P0]

Implement all child flows at 320–767 widths, tablet layouts at 768–1023 and desktop layouts at 1024+. Use Indonesian navigation and clear language. Arabic is rendered as separate RTL text with appropriate glyph support and generous line height; translated copy remains separate LTR content.

**Acceptance:** targets are at least 48×48 CSS pixels by product policy; normal text meets the chosen WCAG AA contrast target; 200% zoom, focus order, screen-reader labels and tap alternatives pass manual checks; Arabic marks are not clipped on tested browsers. See [S05] in the source register for the accessibility reference.

### FR-18 — Operations and support [P0]

Provide structured logs without payload/PII leakage, readiness checks, backups, restore tests, error reporting, rate limits and a parent support path. Jobs handle exports, deletion and imports with retry limits. Capture package compatibility and deployment decisions explicitly.

**Acceptance:** a fresh non-production environment can be set up from documented steps; restore is exercised before launch; dependency and secret scans pass; errors carry a request ID; the release owner signs the content, privacy, QA and operations checklist.

## 8. Non-functional requirements

### Security and isolation

Use TLS, HTTP-only secure cookies, same-origin deployment, explicit origin/CSRF protections, server-derived child context, owner-scoped queries, staff MFA and audited privileged actions. No direct browser access to the database or upstream content-provider secrets. Defense-in-depth tests must attempt cross-parent reads and writes, auth-handler bypasses, content leakage and export reuse. [S06] explains the object-authorization risk being addressed.

### Reliability and data correctness

Domain events are idempotent. Quiz answer acceptance, practice projection and first-completion reward update occur transactionally. Resubmissions return the stored result. A conflicting reused identifier returns an explicit conflict. Database constraints plus application checks enforce lesson/session/child consistency. Published versions are immutable and replaceable by a new version.

### Accessibility and usability

Use the WCAG 2.2 AA criteria as the baseline review target, with the larger 48-pixel product touch-target policy. Do not equate automated scanning with full conformance. Test actual Arabic and screen readers manually. The child interface uses short instructions, no meaning conveyed solely by color, and calm error states.

### Privacy and legal readiness

The legal review must consider Indonesian child-system regulation and personal-data rules, including the 2026 implementing regulation listed in the sources. International expansion requires a fresh jurisdiction review. These documents do not declare legal compliance. A parent gate, checkbox or verified email alone is not an approved child-consent mechanism. [S07–S10]

## 9. Rules and calculations

**Lesson completion:** the server determines completion from required units in the immutable lesson version. Listening/imitating completion records a practice action, not acoustic evidence. A quiz requires all five first responses plus acknowledgment of feedback; a game requires all five rounds completed. Completion at 100% means the defined activity was finished.

**Practice percentage:** unique required units completed divided by the count of required units for that version, multiplied by 100 and rounded for display. The underlying fraction is stored; the UI uses 0–100. Repeats do not increase the numerator beyond the required count.

**Quiz accuracy:** accepted correct first responses divided by all accepted first responses in the interval. Exclude unanswered items. Show “Belum ada kuis” when the denominator is zero. Explain the interval in the parent view; do not average percentages with different denominators.

**Practice time:** sum server-accepted active intervals, not elapsed wall time between opening and closing a page. Heartbeat intervals are capped and de-duplicated; backgrounded or idle intervals are excluded. Label as estimated practice time. Two tabs cannot double-count simultaneous learning for one child.

**Stars:** one star for the first ever completion of a logical lesson, enforced by a unique reward record. Stars cannot be purchased, spent or lost. Practice badges never assert memorization. Parent assessment is a separate immutable history with a latest observation.

## 10. Analytics and data minimalism

Use operational session/answer/progress records for the parent dashboard. Do not build a separate tracking-event system for MVP. For pilot analysis, export only consented aggregate counts with a documented purpose, no child identifiers, and a minimum reporting cohort of ten profiles. This threshold is a product privacy policy, not a legal anonymization guarantee.

Do not send nicknames, emails, Arabic response bodies, asset signed URLs, answer text or support-note contents into logs. Store no free-form child input. Monitor error categories, response latency, media failures and job outcomes without third-party behavior recording.

## 11. Dependencies, approvals and risks

The build depends on reviewed sources, recitation rights, a qualified curriculum reviewer, adult email delivery, suitable deployment/storage and a privacy owner. Development may proceed against marked fixtures while these are unresolved, but public launch may not.

Key risks: wrong verse/audio mapping; false claims about memorization; child-to-parent mode bypass; source-rights uncertainty; network unreliability; over-dense mobile layouts; scope growth; and accidental promotion of demo data. The technical and testing documents assign a mitigation and release check for each.

The six image mockups do not include onboarding, gates, empty/error states, actual ayah player or admin screens. These are specified in the UX document and require implemented screenshots before release. They must not be treated as visually approved just because the existing images were supplied.

## 12. Definition of MVP done

All FR-01 through FR-18 acceptance criteria have evidence. All P0 tasks are complete or explicitly blocked by an owner-approved scope change. No open critical/high security issue, no known critical Qur'an error and no unreviewed production content. Parent/child isolation, source review, content recall, export, deletion and restore drills pass. Browser/responsive/accessibility checks are documented. The parent gate and production eligibility flow are reviewed together.

The product owner accepts the pilot curriculum and naming; the qualified reviewer accepts the text/audio mappings; the privacy owner signs the jurisdiction/consent/retention plan; the engineering owner signs operational readiness. Approval is an external act and must never be invented by an implementation agent.

## 13. Delivery milestones

**M0 — Foundations and decisions:** repository, compatibility, tokens, contracts, threat model, source inventory and launch blockers.

**M1 — Safe vertical slice:** adult auth/consent state, child mode, one demo lesson, validated completion and a real parent progress summary.

**M2 — Learning experience:** catalog, guided stages, audio player, reviewed short-surah flow, quiz/game engines, resume and parent assessment.

**M3 — Content operations:** source registration, structured imports, review/publish/recall and audit.

**M4 — Privacy and hardening:** export/deletion, rate limiting, accessibility, performance, failure recovery and browser verification.

**M5 — Controlled pilot and launch decision:** reviewed content, legal-readiness evidence, restore drill, supervised usability sessions and release sign-off.

Task dependencies, effort bands and requirement traceability are in `tasks/`. No calendar delivery promise is implied by the milestone sequence.

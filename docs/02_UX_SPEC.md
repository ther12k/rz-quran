# UX, Screen Behavior & Responsive Specification

**Normative companion to the PRD.** The PNG files show a visual direction; they are not a pixel-perfect specification of behavior or content correctness.

## 1. Visual direction and corrections

Preserve warm green as the primary action color, cream/mint surfaces, restrained pastel category colors, dark readable text, soft rounded cards and friendly illustrated children/star mascots. Use one illustration per primary screen region, not decorative clutter around every control. Recreate clean licensed/original artwork during implementation; the screenshots are not layered design assets.

Important corrections to the image concepts:

| Concept behavior | Required implementation |
| --- | --- |
| Marketing headline and eight dense feature cards on child home | Put full messaging on public landing; child home prioritizes one continue action |
| Five tabs including both Quiz and Progress | Canonical child tabs: Beranda, Belajar, Main, Prestasi, Profil |
| Parent analytics reachable from the child's bottom tab | Parent “Progres anak” is behind the server-enforced parent gate |
| “Sudah Lancar” inferred from 85% practice | Use “Latihan 85%”; fluency label only from parent assessment |
| Four cramped analytics cards across a phone | Two columns on mobile; four only when available width supports them |
| Drag-only matching | Tapping/keyboard is the default equivalent path |
| Active game and congratulation panel shown simultaneously | Separate playing, feedback and completed states |
| Notification badge/streak heat in header | Remove unsupported notifications and punitive streak mechanics |
| Decorative Arabic in seals/books | Illustration only; never treat it as real verse text |
| Very tall phone mockup packed with content | Real viewport scroll and sticky navigation; do not shrink typography to fit |

Use “Kuis,” “Progres,” “Permainan” or “Main,” and “Orang tua” consistently in new Indonesian copy. Original PNG text is preserved as source imagery only.

## 2. Design tokens

The machine-readable tokens are in `design/tokens.json` and `design/tokens.css`. Proposed values: primary green `#157F43`, dark ink `#17312B`, page cream `#FBFCF7`, white surface, borders `#DEE8DD`, and gentle mint/lavender/blue/yellow category backgrounds. All actual foreground/background pairs must be checked for contrast after implementation; a pastel token is not a guarantee of accessibility.

Spacing scale: 4, 8, 12, 16, 24, 32, 48. Small card radius 16, main card 24, round pill 999. Button height at least 52; minimum interactive target 48×48 CSS pixels; icon itself can be 24. Body text 16–18 px, child task instruction 20–24, screen title 28–32. Adult dashboard may use 14 px secondary labels, never for the main child instruction.

Use a rounded, legible Latin font and a verified Arabic font with the required Qur'anic marks. Candidate families are a design choice, not bundled assets: a rounded sans-serif such as Nunito for Latin and an appropriately tested Arabic face such as Noto Naskh Arabic. Validate actual script coverage, license and shaping before choosing. No font binaries are distributed in this package.

Arabic practice text: `lang="ar"`, `dir="rtl"`, `translate="no"`, no letter spacing, normal word spacing, 32–44 px minimum proposed learning size and generous line height around 1.9. Do not clip combining marks inside fixed-height cards. No visual reversal of strings; use native bidi isolation for verse references. Do not strip diacritics or replace script styles dynamically.

## 3. Responsive rules

| Viewport | Layout |
| --- | --- |
| 320–479 px | 16 px gutters, one-column content, two-column simple answer tiles, compact header, sticky child bottom nav |
| 480–767 px | 20–24 px gutters, same mobile navigation, paired category cards if each has adequate width |
| 768–1023 px | 24–32 px gutters; constrained central learning area; two-column dashboard cards; child nav remains bottom-aligned |
| 1024 px and above | 80 px child navigation rail; content max-width 1120; main activity stays max-width 680; contextual progress may sit alongside |

Parent and admin areas use a labeled side navigation at desktop and an accessible drawer on mobile. Desktop grids reflow; they do not stretch Arabic or game tiles across the whole monitor. Public landing can use two-column hero at 1024+ and a 1/2/4-column benefit grid according to available width.

Reserve safe-area padding using `env(safe-area-inset-bottom)`. Sticky controls must not hide the last list row or keyboard focus. Minimum tested widths: 320, 390, 768, 1024 and 1440. At 200% zoom, content remains operable without losing controls. A screen can scroll vertically; it need not fit the entire concept in a single physical viewport.

## 4. Information architecture and routes

Public: `/`, `/masuk`, `/daftar`, `/verifikasi`, `/pulihkan`, `/privasi`, `/sumber`.

Parent onboarding: `/orang-tua/mulai`, `/orang-tua/persetujuan`, `/orang-tua/anak/baru`.

Child shell: `/anak/beranda`, `/anak/belajar`, `/anak/belajar/:lessonId`, `/anak/surat/:lessonId`, `/anak/main`, `/anak/kuis/:lessonId`, `/anak/permainan/:lessonId`, `/anak/prestasi`, `/anak/profil`.

Parent area: `/gerbang-orang-tua`, `/orang-tua/anak`, `/orang-tua/anak/:childId/progres`, `/orang-tua/anak/:childId/pengaturan`, `/orang-tua/data`, `/orang-tua/bantuan`.

Admin: `/admin`, `/admin/sumber`, `/admin/aset`, `/admin/pelajaran`, `/admin/pelajaran/:versionId`, `/admin/review`, `/admin/rilis`, `/admin/audit`.

Routes are presentation routes, not API endpoints. API authorization is defined separately; a route guard alone is insufficient. Use browser-history fallback configuration without making unknown `/api/*` paths return the HTML shell.

## 5. Screen specifications

### S01 — Public landing

Use the user's headline and supporting sentence exactly. Feature names cover all eight benefits. Main CTA is “Mulai bersama orang tua”; secondary is “Lihat cara belajar.” Show honest source/privacy links for adults. No sign-up urgency, countdown or claim of guaranteed memorization. Child mode never navigates out to this marketing page without clearing private session state.

### S02 — Adult sign-in and verification

Email and password form with visible labels, password show/hide and recovery link. After sign-up, show verification pending, resend cooldown and edit-email option through the auth library. Error copy does not reveal whether an unrelated email address exists. No child profile form until eligibility/consent gating is satisfied.

### S03 — Consent and eligibility

Explain what profile data and activity records are collected, why, for how long, and how to withdraw. Display the active notice version. Present the jurisdiction-approved assurance step, not an invented checkbox-only substitute. Unconfigured production flow shows a parent-only wait/unsupported notice; local demos carry a visible demo label.

### S04 — Create/select child

Nickname, curated avatar choice, age band and starting stage. No photo uploader or exact birthdate by default. Show up to three existing profiles and a clear active selection. Switching requires an adult gate. On continue, warn briefly that parent settings will lock, then enter child mode.

### S05 — Child home

Top: small avatar, “Assalamu'alaikum, Aisyah!” and a protected adult-entry icon labeled “Orang tua.” Primary card: resume/suggested lesson title, one line of context, progress fraction and “Lanjut belajar.” Two-by-two category links are Mendengar, Hafalan, Huruf and Main. Small achievement strip is optional; empty users see welcoming guidance instead of zero-filled analytics.

The hero illustration must occupy less visual priority than the primary CTA. The first meaningful action appears in the initial 390×844 viewport without scrolling. There is no parent email, precise age, source URL or personal notification in this view.

### S06 — Learning catalog and path

Search field, category chips and a stage/path list. Search is debounced, keyboard-operable and cancels stale requests. Keep the recommendation visible before a long catalog. Cards contain short title, type, duration estimate, progress and status icon. Locked cards open a helpful explanation and a link to prerequisites, not a purchase wall. Display empty, no-results and content-unavailable states separately.

### S07 — Listen/imitate lesson player

Header: back and title; compact progress “Langkah 2 dari 5.” Main content: one large letter or reviewed ayah, short instruction, source/reciter label where needed. Primary audio button has accessible play/pause name. Repeat controls 1×/3× refer to repetition count, not playback speed. “Sekarang ikuti bacaannya” appears after playback. “Sudah berlatih” submits practice acknowledgment, not a recording judgment.

Player states: idle, loading, ready, playing, paused, buffering, ended, unavailable. A second tap during loading must not create another audio instance. Screen-reader progress updates occur politely, not every audio frame. Avoid waveform decoration presented as measured pronunciation.

### S08 — Short-surah list

List the five pilot modules only once approved/published. Each row shows a Latin title, lesson progress such as “3 dari 7 ayat dilatih,” and a parent-assessment badge only when one exists. The assessment label is “Catatan orang tua,” visible in details; no ungrounded “Hafal” claim. Large play/navigation target, not tiny chevrons as the only button.

### S09 — Ayah practice

Keep Arabic centered or RTL-aligned within a text column, with reference and optional independently reviewed translation below. Allow verse-by-verse replay, next/previous and one/three repeats. Do not split a word across tiles or crop the basmala. Stop/return preserves the last server-accepted unit. Handling of basmala and verse numbering follows the chosen edition and reviewed mappings, not a generic add-prefix rule.

### S10 — Main hub

Two clear options: “Kuis huruf” and “Cocokkan suara.” Each has one-sentence instruction, five-step estimate and a large start button. Avoid a large scrolling game store. Unavailable sets are not shown as playable. The main navigation item is “Main,” not an ambiguous gamepad labeled Quiz for all activities.

### S11 — Quiz question

Header “Soal 3 dari 5,” no forced countdown. Prompt card, two to four large option buttons, and “Periksa” until submitted. Correct/incorrect state has icon plus text. On error, say “Belum tepat. Coba dengarkan lagi, ya.” After feedback acknowledgment, “Lanjut” moves forward. At completion, show effort-focused summary and exit; a detailed first-response percentage belongs primarily in parent reporting.

### S12 — Sound-matching game

Large “Dengarkan suara” control and tile choices. Tap a tile, then “Periksa,” or choose with keyboard. Optional drag behavior must call the same selection mechanism and support cancel/undo. During play no completion banner is visible. Completed state replaces the task with “Latihan selesai!” and actions “Selesai dulu” and “Main lagi.” Rewards use actual server data; do not hardcode three stars from the original image.

### S13 — Child achievements

Show first-completion stars and descriptive practice badges such as “Latihan pertama” and “Mencoba lima pelajaran.” No public rank, cash value, loss mechanism or inferred “hafal lima surat.” Empty state is encouraging. Long-term records remain private to this family.

### S14 — Child profile and comfort

Curated avatar, nickname and non-sensitive settings summary. Parent-only edits are labeled as requiring an adult. The child may change local reduced-motion/quiet presentation settings only if policy allows; persistent parent goals require the gate. Provide an obvious safe stop action. No outbound support, billing or app-store links.

### S15 — Parent gate

Neutral dialog/page: “Minta bantuan orang tua.” Require adult password reauthentication; allow password manager/paste and recovery. On failure do not blame the child. Rate-limit and reset the UI after repeated attempts. Gate duration five minutes; leaving to child mode ends it. Do not implement a simple arithmetic puzzle as authorization or consent verification.

### S16 — Parent dashboard

Selected owned child, reporting interval and timezone label. Metric grid is 2×2 on mobile, 4×1 only on wide screens. Metrics: lessons completed in assigned curriculum, surahs practiced, first-response quiz accuracy and estimated active practice time. Each has a meaningful denominator or explanatory label. Weekly chart has an accessible table and handles zero days; no fake 2025 dates from mockups.

Details include actual lesson activity, assessment status and recommended next practice based on deterministic rules. “Catat perkembangan hafalan” opens the assessment form. This screen contains no claim of measured oral fluency.

### S17 — Parent assessment/settings

Choose surah and one of “Perlu latihan,” “Mulai lancar,” “Lancar menurut orang tua.” Show the observation date. No free-text child diagnosis. Editing appends a new record. Stage selection and recorded prerequisite override are available with an explanation; neither awards a star nor marks a lesson complete.

### S18 — Privacy/export/delete and help

Explain stored data, current consent status and withdrawal consequences. Export is asynchronous and owner-gated; delete requires a fresh gate and explicit confirmation mentioning the profile nickname. Do not force typing a long phrase for accessibility. State backup-retention handling honestly. Support offers a category and optional short note, with a warning not to include a child's identifying information.

### S19 — Content source/asset management

Desktop-first staff screen, usable at mobile widths. Table/cards show source, version, rights status, reviewer and dependent lessons. Import is an authorized server-side action; no arbitrary public URL fetch. Source identifiers and checksums are visible to staff. Uploads remain private/quarantined until validated.

### S20 — Lesson editor and review

Structured form with title/type/stage, required units, verse references, audio mappings, quiz items and preview. Source and draft appear side by side on desktop, stacked on phone. Missing rights or content checks produce specific blocking messages. Editor cannot approve their own version; every change after review resets review for the new immutable candidate.

### S21 — Publication and recall

Publisher sees a preflight checklist and a clear candidate version. Publish creates a immutable public content version, not an editable page. Recall requires reason, scope and confirmation, then shows affected lessons. Rollback selects another approved version; it never mutates historical session content.

## 6. Shared interaction states

Every data screen must implement: initial loading skeleton; loaded; empty; permission denied; network error with retry; session expired; and content withdrawn where applicable. Preserve focus and typed parent input on recoverable errors. Skeletons must not imply fake learning data.

Use the same primary button placement across lesson steps. Pending submission disables duplicate sending but has a timeout/retry route. A successful retry displays the stored result without another celebration. A fetch canceled by navigation must not announce an error on the next screen.

A background-tab return checks session/content status before resuming audio. Logout immediately stops audio, clears in-memory queues, query cache and private screen state. Browser history must not render retained private parent data when the gate is gone.

## 7. Accessibility acceptance

Keyboard-only navigation and visible focus across child and adult flows; landmark and heading hierarchy; focus trapped/restored for dialogs; icons paired with accessible labels; announce feedback once; honor reduced motion; avoid auto-playing lesson or celebration audio; every drag interaction has a tap equivalent; charts have a data table.

Contrast tests must include disabled, focused, selected, error and pastel card states. Arabic verification must use actual reviewed text with marks at 200% zoom and the smallest screen, across iOS Safari, Android Chrome and desktop browsers. Automated tooling is supplementary to manual review. [S05]

## 8. Design deliverables still needed in implementation

The package includes six PNG concepts, not editable Figma files or approved tablet/desktop mockups. Implement and capture S02–S04, S07/S09, S15, S18 and S19–S21 as additional screen states. Review all primary child screens at 390 px and representative tablet/desktop views at 768 and 1440 px. Do not claim these additional visuals were supplied or approved.

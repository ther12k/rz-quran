# Canonical Text, Audio & Curriculum Dependency Inventory

**Task:** T004 · **Date:** 2026-09-05 · **Owner:** Content Lead + Rights Owner  
**Status:** Documented · **Requirements:** FR-06, FR-07, FR-13

## 1. Source Dependency Matrix

| Asset Kind | Candidate Source / Release | Upstream Reference | Current Rights Status | Missing Evidence / Blocker |
| --- | --- | --- | --- | --- |
| **Qur'an Canonical Text** | Tanzil Project (Simple or Uthmani Minimal script release) | `https://tanzil.net` | Pending Evaluation | Exact digital release checksum, scholarly endorsement verification, and license rights documentation. |
| **Recitation Audio** | Single approved slow/clear reciter (e.g. Mahmoud Khalil Al-Husary or Mishary Rashid Alafasy) | Upstream provider / Qur'an Foundation | Pending Evaluation | Distribution, streaming, and caching license agreement. Alignment timestamps human-checked against verses. |
| **Hijaiyah Audio** | Bespoke recorded alphabet audio (Indonesian children makhraj guide) | Studio recording pipeline | Pending Production | Professional studio recording with native Arabic/tajwid qualified reciter; studio master rights contract. |
| **Indonesian Translation** | Kemenag RI Al-Qur'an Terjemah (Standard Indonesian Edition) | Lajnah Pentashihan Mushaf Al-Qur'an | Pending Verification | Digital redistribution permission and textual verification against printed tashih. |
| **App Visual Art** | Original vector/SVG illustrations (child characters, mascots, badges) | Internal design team | Draft Concepts Only | Concept images in `design/mockups/` are non-layered AI concepts. Vector production art must be commissioned/licensed. |

## 2. Content Author & Reviewer Roles
Per `AGENTS.md` and `docs/06_CONTENT_AND_CURRICULUM.md`:
- **Content Author / Editor Role**: `content_editor` (Drafts lessons, uploads assets to quarantine, maps verses). Assigned to Content Operations.
- **Qualified Content Reviewer Role**: `content_reviewer` (Validates Arabic orthography, diacritics, and audio alignment). Assigned to Qualified Islamic Studies / Qur'anic Pedagogy Lead. Must be a different individual from the author.
- **Content Publisher Role**: `content_publisher` (Executes publication transactions).
- **Rule**: No approval is asserted or fabricated. All demo fixtures in `packages/database/src/seed-demo.ts` are marked `demo_only = true` and contain alphabet characters only, with explicit `audioAssetId: null` honest missing-media states.

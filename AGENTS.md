# Instructions for implementation agents

## Scope and precedence

Build the children's Qur'an learning app in this package. Do not repurpose the separate RZ-Fiqh chatbot project or introduce RAG. First inspect the existing repository, if any, and preserve unrelated work.

Precedence: explicit product-owner decisions recorded after this package > child-safety and content-integrity invariants > PRD requirements > machine contracts plus data model > UX behavior > concept images. Conflicting contracts are not permission to improvise silently: document the discrepancy, propose the smallest compatible change and update all affected artifacts together.

## Non-negotiable rules

- Rebuild the UI as real responsive components. Do not use screenshots as whole-screen backgrounds or slice generated Arabic into content assets.
- Child mode must be enforced by the server, not only by hidden links. Adult account sessions do not automatically grant adult-area access after child mode is entered.
- Derive active child and ownership from server session context. Every parent resource lookup must be scoped to the authenticated parent. UUIDs are not authorization.
- No fabricated Qur'an, translations, recitations, source licenses, scholarly endorsements, progress data or test results. No microphone request in MVP.
- Separate activity completion from memorization ability. Only an explicit parent assessment may label memorization as parent-confirmed; it is never machine-certified.
- Keep provider credentials, answer keys and unpublished content on the server. No public storage bucket for private data.
- Content publication requires a second human reviewer and verified rights. Demo bypasses may exist only in local/test environments and must fail closed in production.
- Persist append-only progress events with idempotency and transactional projections. Do not accept client-supplied scores, completion percentages or reward totals as authoritative.
- No ads, trackers, session replay, public leaderboards, chat, purchases, external child-facing links or punitive streak mechanics.
- A parent gate is a UX/security control, not proof of legally valid parental consent.

## Working method

Read the PRD, UX, architecture, API and data model, then inspect the mockups. Implement one dependency-ready task or vertical slice at a time. Add real tests while implementing. Prefer a modular monolith and a small dependency set. Do not rewrite the stack without an architecture decision.

Mark tasks complete only when their acceptance criteria have evidence. After each milestone report: changed files; behavior delivered; commands actually run and results; screenshot paths; remaining work; blockers and any contract deviations. Distinguish “implemented,” “tested,” and “approved.” Never call a mock, skipped check or unexecuted test a pass.

Use Indonesian for user-facing copy and English for code identifiers and technical comments. All mutations require server validation. Use standards-based accessible elements, keyboard support, visible focus and reduced-motion support. Do not remove Arabic marks or apply letter spacing to Qur'an text.

## First deliverable

Produce a short repository assessment and version-compatibility record. Then implement milestone M0 and the M1 vertical slice: verified adult account → consent-state gate → child profile → published demo Hijaiyah lesson → server-validated completion → parent progress. No production content publication or external deployment without the relevant approvals.

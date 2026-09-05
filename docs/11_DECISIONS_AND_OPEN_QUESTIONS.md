# Decisions, Assumptions & Open Approvals

“Proposed” means the agent may develop against the stated default. “Launch blocker” means a human decision/evidence is required before public release. This document deliberately avoids pretending unanswered business or legal questions were resolved.

## 1. Proposed architecture decisions

| ID | Decision | Reason |
| --- | --- | --- |
| ADR-01 | One web app and modular API monolith | Small initial team/scope; fewer infrastructure dependencies |
| ADR-02 | React/Vite, Tailwind/shadcn, Bun/Elysia, PostgreSQL/Drizzle | Fits project preferences and a simple typed application |
| ADR-03 | Maintained adult auth integration + app-level gate | Avoid custom password/session cryptography; enforce child mode separately |
| ADR-04 | No RAG/LLM/voice grading in MVP | Core features are structured practice, not open-ended generation |
| ADR-05 | Source-traceable immutable content versions | Correctness, review, recall and reproducible history |
| ADR-06 | Separate practice completion and parent assessment | Prevent unsupported claims about memorization |
| ADR-07 | Server-scored quiz/game with shared engine | Less code and less score manipulation |
| ADR-08 | App shell only offline | Avoid premature content licensing/local-data/sync complexity |
| ADR-09 | Five child tabs, gated parent reports | Clear mode separation; fixes ambiguous concept navigation |
| ADR-10 | One active writable learning session per child | Simple, testable time/progress consistency |
| ADR-11 | PostgreSQL job table | Avoid Redis/queue infrastructure until evidence demands it |
| ADR-12 | Exact dependency versions selected by compatibility spike | No unsupported “Elysia 2” assumption or untested version promise |

## 2. Open decision register

| ID | Question | Proposed default | Owner | Blocks |
| --- | --- | --- | --- | --- |
| D01 | Product name and branding | RZ Qur'an Kids working name | Product | Public branding |
| D02 | Launch markets and age/eligibility policy | Indonesia-first supervised pilot; proposed 5–10 ages | Product + legal | Public child enrollment |
| D03 | Valid parental authority/consent assurance | Must be chosen after applicability/risk review | Privacy/legal | Real child processing |
| D04 | Canonical Arabic edition/source | Evaluate Tanzil; approve exact release | Content lead | Qur'an publication |
| D05 | Reciter and recording/streaming rights | One approved reciter, verse mappings reviewed | Content + rights owner | Audio publication |
| D06 | Qualified curriculum reviewer | Named person distinct from editor | Product/content | Any production lesson |
| D07 | Six foundational letters and lesson order | Reviewer-selected pilot scope | Content | Curriculum sign-off |
| D08 | Translation/transliteration | Omit until separately approved/licensed | Content/rights | Optional content only |
| D09 | Hosting/storage/email/processor region | Choose one low-complexity deployment | Engineering + privacy | Production deploy |
| D10 | Retention and deletion exceptions | Use proposed short defaults pending review | Privacy/legal | Public launch |
| D11 | Exact package versions and auth plugins | Compatibility spike and lockfile | Engineering | M1 integration |
| D12 | Production illustrations and font licenses | Recreate/license assets; no screenshot slicing | Design/rights | Public visual assets |
| D13 | Budget and commercial model | No payments/ads in MVP | Product | Commercial rollout |
| D14 | Pilot size and evaluation protocol | Small supervised opt-in group | Product + privacy | Human usability pilot |
| D15 | Support/incident contacts | Named inbox/owner before launch | Operations | Launch |
| D16 | Accessibility and Arabic rendering sign-off | Manual plus automated evidence | Design/content/QA | Launch |

## 3. Development can proceed safely

No need to wait for D04/D05 to implement account/session isolation, schemas, placeholder states, the quiz engine or admin validation. Use explicit synthetic fixtures and no licensed recitation substitution. Keep unpublished source dependencies blocked. D02/D03 block real child-data collection, not local synthetic tests.

## 4. Conflict policy

Record any new decision with date, owner, options considered, selected option, consequences and affected files. Contract changes must update OpenAPI/JSON Schema, database model, tests and backlog together. Image text never overrides safety or canonical source data. An agent must raise a real conflict rather than silently broadening scope.

## 5. What this handoff does not establish

No legal compliance certification; no source/reciter contract; no scholarly review; no validated child usability result; no exact schedule/budget; no editable Figma source; no working application; no completed production tests. Package-level validation is documented separately and must not be confused with those approvals.

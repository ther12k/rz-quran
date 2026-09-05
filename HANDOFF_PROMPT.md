# Copy-and-paste handoff prompt

You are the lead full-stack engineer implementing the mobile-first children's Qur'an learning app defined in the attached `RZ-Quran-Kids-Handoff-v1.0` package.

First inspect the repository and read `AGENTS.md`, `docs/01_PRD.md`, `docs/02_UX_SPEC.md`, `docs/03_ARCHITECTURE.md`, `docs/04_DATA_MODEL.md`, `docs/05_API_SPEC.md`, `tasks/BACKLOG.md`, and the six images under `design/mockups/`. Use the remaining documents as implementation references. Do not start by generating a generic landing page.

Use React + TypeScript + Vite, Tailwind CSS + shadcn/ui, Bun + Elysia, PostgreSQL + Drizzle, Better Auth for adult accounts, and S3-compatible media storage. Verify compatible supported versions and pin them in the lockfile. Prefer one modular backend and one web app. Do not add Next.js, a vector database, RAG, an LLM, Redis or microservices without a documented need and approval.

Implement responsive child, parent and content-admin areas with Indonesian copy. Preserve the mockups' friendly green/pastel direction, but follow the written UX specification for mobile sizing, navigation, parent gates, data labels and responsive behavior. Render real HTML controls, not screenshot-based screens. Never reuse generated Arabic as authentic learning content.

Follow backlog dependencies and deliver small, tested vertical slices. Start with M0, then M1: adult authentication and consent-state gate, child profile, one clearly marked non-production Hijaiyah lesson, server-validated progress and the parent summary. Continue through M2–M5 only when prerequisite gates pass.

Enforce child-mode restrictions and ownership on every API. Keep answer keys and provider secrets server-side. No child voice capture, invented Qur'an/audio, automatic memorization claims, ads, tracking SDKs, payments or chat. Implement safe missing-content states when reviewed assets are unavailable. Do not treat an ordinary login or parent gate as legally sufficient consent. Block public launch until content rights, curriculum and privacy approvals are recorded.

For each task, implement its acceptance criteria and tests, update task status, and keep API/schema/docs consistent. At each milestone return: files changed, working flows, commands actually executed with results, screenshots at 390/768/1440 widths, unresolved issues and the next dependency-ready tasks. Do not claim completion based on mocks or tests you did not run. Do not deploy externally or publish content without approval.

Begin now with a concise repository assessment, any blocking contradictions and the M0/M1 execution plan; then implement the first safe slice rather than stopping at the plan.

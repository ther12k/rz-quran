# Source Register & Verification Limits

**Research checked:** 5 September 2026. These are primary sources used for technical and regulatory context. Recheck before implementation/public launch because documentation, access rules and regulations can change. All numerical product targets, timelines, size limits and retention defaults in this package are proposed design decisions unless explicitly attributed.

No licensed text/audio dataset or full third-party document is redistributed here. Source discovery is not a rights, security, scholarly or legal approval.

## S01 — Elysia quick start and Bun integration

Primary reference: https://elysiajs.com/quick-start

Companion reference: https://bun.com/guides/ecosystem/elysia

Use and limit: Official Elysia/Bun documentation describes the Bun-oriented server setup. It supports the proposed integration, not an untested version matrix. Use the exact stable versions verified during M0.

## S02 — Vite getting started

Primary reference: https://vite.dev/guide/

Use and limit: Vite documents its build-tool/runtime requirements and setup. Check those requirements separately from the choice of Bun as backend runtime; do not assume a Bun backend establishes frontend build compatibility.

## S03 — shadcn/ui with Vite and Tailwind Vite setup

Primary reference: https://ui.shadcn.com/docs/installation/vite

Companion reference: https://tailwindcss.com/docs/installation/using-vite

Use and limit: Official setup documentation is available for Vite, shadcn/ui and the Tailwind Vite plugin. The visual tokens and component adaptations in this package are our proposed design choices.

## S04 — Better Auth Elysia integration

Primary reference: https://better-auth.com/docs/integrations/elysia

Use and limit: The integration documentation mounts the auth handler into Elysia and resolves sessions through the auth API. Parent-mode restrictions, consent and object authorization still need application logic and tests.

## S05 — W3C Web Content Accessibility Guidelines 2.2

Primary reference: https://www.w3.org/TR/WCAG22/

Companion reference: https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html

Use and limit: WCAG 2.2 provides accessibility criteria including alternatives to dragging. The package selects AA as its review target and adopts a larger 48 CSS-pixel product touch-target policy; 48 pixels is not stated as the WCAG AA minimum. Automated checks alone do not establish conformance.

## S06 — OWASP API1:2023 Broken Object Level Authorization

Primary reference: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/

Use and limit: OWASP describes the risk of missing object authorization where clients supply identifiers. Owner-scoped queries and adversarial tests in this package are design responses to that risk.

## S07 — Indonesia: UU Nomor 27 Tahun 2022, Pelindungan Data Pribadi

Primary reference: https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022

Companion reference: https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/undangundang%2Bnomor%2B27%2Btahun%2B2022

Use and limit: Official regulatory sources identify the personal-data law. Applicability, bases, duties and retention decisions for this product require qualified review. The package does not give a legal opinion or claim compliance.

## S08 — Indonesia: PP Nomor 17 Tahun 2025, child protection in electronic systems

Primary reference: https://jdih.komdigi.go.id/produk_hukum/view/id/965/t/peraturan%2Bpemerintah%2Bnomor%2B17%2Btahun%2B2025

Companion reference: https://peraturan.bpk.go.id/Details/316698/pp-no-17-tahun-2025

Use and limit: Official sources identify the child-protection framework for electronic systems. It is included as a launch-review input; this package does not determine the product risk class or resolve eligibility merely by describing the app as educational.

## S09 — Indonesia: Permenkomdigi Nomor 9 Tahun 2026

Primary reference: https://peraturan.bpk.go.id/Details/346040/permenkomdigi-no-9-tahun-2026

Use and limit: The official record identifies an implementing regulation for PP 17/2025, including age, child-protection design, verification and risk-assessment topics. This 2026 source must be considered in the launch review; this package does not interpret its full application to the product.

## S10 — US FTC COPPA rule and 2025 final rule

Primary reference: https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa

Companion reference: https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule

Use and limit: Official US materials describe protections for covered services and children under 13, including parental-consent/security requirements. US availability needs a separate applicability review. A parent gate or verified email is not itself a legal conclusion about valid consent.

## S11 — Tanzil Quran text license

Primary reference: https://tanzil.net/docs/text_license

Use and limit: The published terms describe CC BY 3.0 labeling alongside explicit verbatim-preservation, attribution/link and notice conditions. Preserve the actual applicable notice when distributing its text. This permission must not be assumed to cover unrelated translations, recordings, artwork or other assets.

## S12 — Quran Foundation Content APIs quickstart and audio reference

Primary reference: https://api-docs.quran.foundation/docs/quickstart/

Companion reference: https://api-docs.quran.foundation/docs/sdk/javascript/audio/

Use and limit: Current documentation describes backend app credentials, pre-live/production permissions and server-side access to content/audio metadata. Provider credentials must remain server-side. This documentation does not establish blanket redistribution, caching, commercial or offline rights for every recording.

## Verification performed

Official search results and the relevant documentation/regulatory pages were reviewed for the stated narrow claims. No upstream account was created, no production API credential was tested, no media rights agreement was obtained, and no complete legal applicability analysis or scholarly content review was performed. Avoid turning source links into stronger assurances than they support.

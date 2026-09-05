# Package validation record

**Package:** RZ-Quran-Kids-Handoff-v1.0  
**Prepared:** 5 September 2026  
**Scope:** documentation and reference assets, not an application release.

## Checks actually performed

| Check | Result | Evidence and limits |
| --- | --- | --- |
| JSON Schemas | Passed | Three schemas pass Draft 2020-12 meta-validation; three positive example files validate, with format checks enabled. |
| Negative fixtures | Passed | Excess heartbeat time and client-injected child ID are rejected. |
| OpenAPI structure | Passed, limited scope | 57 unique operation IDs, 69 component-schema meta-checks, 673 resolvable internal references, path parameters and capability/auth metadata checked. Three embedded example payloads validate. This is not a dedicated full OpenAPI semantic-conformance check. |
| Delivery graph | Passed | 74 unique planned tasks; every dependency exists; graph is acyclic; tasks have acceptance criteria. |
| Requirements and tests | Passed as a planning check | All 18 requirements map to tasks and planned tests. The 42 application test cases remain explicitly **not run**. |
| Source images | Passed | All six original PNGs match the registered SHA-256 and 941 × 1672 dimensions; copied byte-for-byte from supplied assets. |
| Gallery and inventory | Passed | Local gallery asset links resolve; no script or remote asset dependency; 21 screen definitions map to available concepts or explicitly request additional visual design. |
| SQL reference | Static checks only | 28 unique table declarations and declared foreign-reference table names. No PostgreSQL parser/server was available; DDL has not been executed or migration-tested. |
| DOCX/PDF reading copy | Passed | DOCX archive integrity checked. The complete reading copy was rendered to a 21-page PDF and page PNGs. Every rendered page was visually inspected; no blank pages, clipping, missing body glyphs or layout overlap found. All 18 requirements and six design appendices are present. |
| Design overview | Passed | Contact sheet visually inspected; captions and originals remain legible without cropping. |
| Distribution hygiene | Passed | No font files, application secrets, licensed recitation assets, node_modules or temporary render output are bundled. |

The reproducible machine results are in `package-validation.json`. The root `MANIFEST.json` records file hashes, excluding itself. Archive integrity is checked during final ZIP creation.

## Run the artifact checks again

From the extracted package root, in an isolated Python environment:

```sh
python -m pip install -r qa/requirements.txt
python qa/validate_package.py
```

The script does not write files by default and needs no network after dependencies are installed. Its optional `--output PATH` overwrites that report path; changing packaged files makes the original root manifest stale. The script checks the fixed v1.0 baseline counts; update those checks deliberately when extending the package.

## Not performed, and not implied

No product code was built or deployed. The Bun/Elysia/auth/ORM dependency matrix, PostgreSQL migrations, API behavior, isolation controls, device layouts, browser audio, accessibility conformance, load targets, backup restore, export and deletion workflows remain implementation work. The application's 42 planned tests are not test results.

No production source/API credential was exercised. No Qur'an corpus or reciter recording was independently reviewed or licensed by this package. No legal, parental-consent, curriculum or public-release approval is claimed. Generated Arabic and sample statistics inside the original screenshots remain unverified concept content.

Full OpenAPI semantic validation and PostgreSQL execution must run in implementation CI. Documentation validation cannot establish production correctness or child safety.

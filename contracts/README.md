# Contracts

`openapi.yaml` is a self-contained OpenAPI 3.1 domain specification. It does not reimplement the authentication library's endpoints. `x-capability` metadata must be enforced in application policies; authentication security definitions alone cannot enforce parent mode, ownership or consent.

`lesson.schema.json` is **server-side authoring data** and can contain correct answers. Do not send it directly to children. PublicLesson/PublicQuestion in OpenAPI are deliberately separate. `progress-event.schema.json` describes untrusted client events; the server still checks sequence, ownership, lesson membership and state. `content-manifest.schema.json` validates metadata shape, not actual rights.

Positive examples are synthetic and non-production. The letter demo contains no recitation audio or Qur'an verse and has not received human curriculum approval. Missing audio is intentional and must yield an honest UI state; production publication must reject missing required content. Examples under `examples/invalid/` are expected to fail validation.

Identifiers using `example.invalid` are non-resolving schema identifiers, not live services or source licenses. Application integration tests and deployment are not included. Run the package validator for artifact checks, then implement the application tests in the test plan.

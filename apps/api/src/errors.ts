// Typed API errors mapped to the error-code table in docs/05 §6.
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_REQUIRED"
  | "PARENT_GATE_REQUIRED"
  | "CONSENT_REQUIRED"
  | "ELIGIBILITY_BLOCKED"
  | "CAPABILITY_REQUIRED"
  | "NOT_FOUND"
  | "IDEMPOTENCY_CONFLICT"
  | "EVENT_SEQUENCE_CONFLICT"
  | "EVENT_ID_CONFLICT"
  | "SESSION_IN_USE"
  | "SESSION_REPLACED"
  | "SESSION_EXPIRED"
  | "INCOMPLETE_SESSION"
  | "REVIEW_REQUIRED"
  | "CONTENT_RECALLED"
  | "CONTENT_INVALID"
  | "RATE_LIMITED"
  | "MEDIA_UNAVAILABLE"
  | "INTERNAL_ERROR";

const STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  AUTH_REQUIRED: 401,
  PARENT_GATE_REQUIRED: 403,
  CONSENT_REQUIRED: 403,
  ELIGIBILITY_BLOCKED: 403,
  CAPABILITY_REQUIRED: 403,
  NOT_FOUND: 404,
  IDEMPOTENCY_CONFLICT: 409,
  EVENT_SEQUENCE_CONFLICT: 409,
  EVENT_ID_CONFLICT: 409,
  SESSION_IN_USE: 409,
  SESSION_REPLACED: 409,
  SESSION_EXPIRED: 409,
  INCOMPLETE_SESSION: 409,
  REVIEW_REQUIRED: 422,
  CONTENT_RECALLED: 410,
  CONTENT_INVALID: 422,
  RATE_LIMITED: 429,
  MEDIA_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  code: ApiErrorCode;
  status: number;
  details?: unknown;
  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = STATUS[code] ?? 500;
    this.details = details;
  }
}

// Central limits for the Schedule JSON Import module (Phase 11, D4).
// Kept in their own file so the API route (Worker B) and the admin UI
// (Worker C) share the same numbers as the schema (Worker A).

/** Maximum number of schedules in one import payload. */
export const MAX_IMPORT_SCHEDULES = 500;
/** Maximum raw JSON body size for one import request. */
export const MAX_IMPORT_JSON_BYTES = 256 * 1024;

/** Maximum length of a schedule's stable external id (`id` in the payload). */
export const MAX_IMPORT_EXTERNAL_ID_LENGTH = 128;
/** Maximum length of the optional idempotency key (`importId` in the envelope). */
export const MAX_IMPORT_ID_LENGTH = 128;
/** Maximum length of the envelope `source` string. */
export const MAX_IMPORT_SOURCE_LENGTH = 128;
/** Maximum length of a schedule title. */
export const MAX_IMPORT_TITLE_LENGTH = 200;
/** Maximum length of a schedule description. */
export const MAX_IMPORT_DESCRIPTION_LENGTH = 2000;
/** Maximum length of a schedule location. */
export const MAX_IMPORT_LOCATION_LENGTH = 200;
/** Maximum length of a schedule note. */
export const MAX_IMPORT_NOTE_LENGTH = 2000;

/**
 * Rate limit for unauthenticated integration attempts, per hashed IP
 * (D7): 10 attempts per minute. Applies to missing/unknown/revoked
 * tokens — a revoked token is not an authenticated caller.
 */
export const IMPORT_AUTH_LIMIT = { limit: 10, windowMs: 60 * 1000 };

/**
 * Rate limit for authenticated integration imports, per connection (D7):
 * 30 requests per 10 minutes.
 */
export const IMPORT_API_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 };

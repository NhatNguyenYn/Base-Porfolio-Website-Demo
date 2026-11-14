// Central limits for the Booking module (Phase 10).
// The flower pool lives in src/lib/flowers.ts; the pool size caps the number
// of simultaneously active (pending + confirmed) bookings.

export const BOOKING_SLOT_DURATIONS_MINUTES = [15, 30, 60] as const;
export const MAX_BOOKING_NOTES = 1000;
// Booking reference code format (15:17 correction): "BK-" + 6 unambiguous
// characters, e.g. BK-7K2M9Q. The random part uses the same unambiguous
// alphabet as the flower allocation (no 0/O, 1/I/l) — see
// src/app/api/bookings/route.ts generateReferenceCode().
// NOTE: the old BOOKING_REFERENCE_CODE_LENGTH = 8 (8 bare characters, no
// prefix) was removed; do not reintroduce it.
export const BOOKING_REFERENCE_CODE_PREFIX = "BK-";
export const BOOKING_REFERENCE_CODE_RANDOM_LENGTH = 6;
export const FLOWER_ALLOC_RETRIES = 5;

// Rate limits (same shape as contact/login in src/lib/rate-limit.ts).
export const SURVEY_SUBMIT_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 };
export const BOOKING_CREATE_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 };
export const AVAILABILITY_LIMIT = { limit: 120, windowMs: 60 * 1000 };

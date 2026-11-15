/**
 * Cards per infinite-scroll batch, server and client alike. 24 keeps the
 * first paint small while filling several screens, so most visitors never
 * wait for a second batch. The public API defaults to the same value.
 *
 * This lives in its own plain module on purpose: the gallery component is
 * a "use client" module, and a server component that imports a plain const
 * from a client module gets a client-reference function instead of the
 * value (Next turns every named export of a client module into a reference
 * — Prisma then rejects `take: [object Function]` at build time).
 */
export const GALLERY_PER_PAGE = 24;

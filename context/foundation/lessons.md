# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Password-policy validate: parse outcome vs policy verdict

**Context:** `nodes/NextcloudFiles/repositories/FilesShare.repository.ts` (`parseSharePasswordValidationResult` / `validateSharePasswordWithClient`)

**Problem:** Impl-review flagged fail-open when an HTTP-success body is non-OCS, meta fails Zod, or `passed` is missing — conflating “could not interpret the validate response” with “password accepted by policy.”

**Rule:** Treat OCS/Zod parse success/failure as transport-envelope correctness; treat `passed === true|false` as the password-policy verdict. Documented fail-open on missing password_policy app (404/405/501) is intentional and separate from parse handling.

**Applies to:** Nextcloud Files share password validation; any OCS helper that maps policy-app validate responses into accept/reject

## Zod object schemas: strip by default, no passthrough, strict only if necessary

**Context:** Suite repository Zod schemas (`nodes/NextcloudNews/repositories/`, `nodes/NextcloudFiles/repositories/`, future Calendar); Deck currently uses `.strict()`

**Problem:** Impl-review treated Deck `.strict()` as the pattern to copy; forcing strict (or passthrough) on News/Files hides the intended default — strip unknown keys without rejecting the payload.

**Rule:** Prefer Zod’s default object behavior (unknown keys stripped). Do not use `.passthrough()`. Use `.strict()` only when absolutely necessary. Existing Deck `.strict()` schemas are grandfathered, not the default for new repos.

**Applies to:** New/edited suite repository Zod object schemas (News, Files, Calendar, Talk, etc.)

# TeamGRIT Ops source recovery baseline — 2026-09-04

This folder is a safety baseline assembled before any further production overwrite.

## Source provenance
- Base code: last locally recoverable TeamGRIT Ops backend snapshot (`teamgrit-ops-backend-mvp.zip`).
- Production may contain newer changes that were deployed directly through Vercel and cannot currently be re-fetched because the Vercel connector returns a scope authorization 403.
- Therefore this package MUST NOT be promoted to production as-is until the missing delta below is reconciled.

## Newer production behavior that must be preserved during reconciliation
1. Google Drive connection and project-folder file listing.
2. Existing-files panel with a fixed height and internal vertical scrolling.
3. Work-request panel with purpose, audience, deadline, desired tone/direction, avoid, must-include fields.
4. Reference input inside the work-request panel.
5. Temporary image references are NOT automatically uploaded to Google Drive.
6. Image paste from clipboard, including Figma-copied bitmap/frame clipboard output when the browser exposes image/png or image/jpeg.
7. Reference URL input.
8. Search-keyword / visual-direction recommendation flow.
9. Gemini model selector with Auto / Gemini 3.6 Flash / Gemini 3.1 Flash Lite / Gemini 2.5 Flash Lite / Gemini 2.5 Flash.
10. Optional fallback to another Gemini model on quota/model errors.
11. AI-usage dialog with locally tracked calls/input/output tokens and link to Google AI Studio rate-limit page.
12. Current execution results are SESSION-ONLY UI state. They are not persisted per project. A new analysis clears the visible result list; generated Drive files remain visible through Existing files.
13. Drive design-system documents must NOT be injected into user design-job analysis. That interpretation was explicitly rejected.
14. TeamGRIT Ops' own UI should follow Google Material Design 3, not CoBiz design-system rules.
15. Branding: desktop/tablet uses the horizontal TeamGRIT logo; mobile uses the symbol logo.

## Branding assets
- `public/assets/teamgrit-logo-horizontal.png`: desktop/tablet logo.
- `public/assets/teamgrit-logo-symbol.png`: mobile logo.

## Responsive logo rule to implement
Recommended initial breakpoint: <= 767px uses the symbol; >= 768px uses the horizontal logo. Preserve intrinsic aspect ratio (`height:auto`, `object-fit:contain`).

## Safe next step
Reconcile this baseline with the latest production source before deploying. Once reconciled, commit it to GitHub and make GitHub the source of truth for Vercel deployments.

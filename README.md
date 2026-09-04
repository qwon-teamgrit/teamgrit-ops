# TeamGRIT Ops — Source Recovery Baseline

This repository is a **recovery baseline** for TeamGRIT Ops.

## Important
- This source bundle is preserved before making further production changes.
- It may not be byte-for-byte identical to the latest Vercel production deployment.
- Do not deploy directly to production until the recovered source has been compared against the current app behavior and verified in Preview.

## Safe workflow
1. Preserve this baseline on `main`.
2. Restore and verify missing/latest product deltas in a separate branch.
3. Apply Material Design 3 to the TeamGRIT Ops UI itself.
4. Use the horizontal TeamGRIT logo on desktop/tablet and the symbol logo on mobile.
5. Deploy to a Vercel Preview first.
6. Verify critical flows before promoting to Production.

See `RECOVERY.md` and `CURRENT_PRODUCT_SPEC.md` for recovery notes and current functional requirements.

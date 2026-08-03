# Quickstart: Restaurant Onboarding Wizard & Completion Checklist

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-08-02

How to run the feature and verify it by hand. Every check below traces to a requirement, so a
failed check names the requirement it broke.

---

## Run it

```bash
npm start            # ng serve against the default environment
# or
npm run start:local  # ng serve -c local
```

Both run `generate:env` first, so no manual env step is needed.

## Verify before pushing

```bash
npm run precheck
```

Runs lint → Prettier check → contrast check → unit tests (headless) → production build. This is
the merge gate (constitution § IV) and the pre-push hook enforces it. Do not bypass it.

To iterate on just this feature's tests:

```bash
npm test -- --include='**/setup-completion.service.spec.ts'
```

---

## Accounts you need

| State to test | How to get it |
|---|---|
| Fresh restaurant, nothing filled in | Register at `/sign-up`, verify the code at `/confirmation-required`, sign in |
| Partly complete | Fill only the business step, then exit the wizard |
| Fully complete, still pending | Fill all three required items; approval standing stays `PENDING_APPROVAL` |
| Approved | Have an admin approve it from the admin console (`/admin/restaurants`) |

Note there is **no way to submit for approval from the restaurant side** — that is a real
platform gap (see [contracts](./contracts/onboarding-ui-contract.md) § 3), not a missing button.
An admin must pick the account up.

---

## Manual verification

### A. Auto-entry and escape

1. Sign in as a fresh restaurant → you land on `/onboarding`, not `/home`. **FR-002**
2. The header states what is needed for approval and shows step 1 of 4. **FR-007**
3. Click exit → you reach the storefront and can browse the catalogue. **FR-003**, BR-AUTH-1
4. Navigate around, then return to `/home` → you are **not** pulled back into the wizard this
   session. **FR-004**
5. Sign out and back in → you are taken into the wizard again (dismissal is session-scoped;
   see [research](./research.md) R4). Spec § Assumptions
6. Sign in as an admin or market agent and open `/onboarding` directly → bounced to `/home`.
   **FR-005**
7. Sign in with `?redirectURL=/catalog` → you land on the catalog, not the wizard. research R5

### B. Steps, saving and validation

8. On step 1, leave the name blank and click Continue → blocked inline, nothing saved.
   **FR-008**
9. Set a receiving window whose end is before its start → blocked inline. **FR-008**
10. Fill step 1 validly and Continue → it saves, then advances. Reload `/profile` and confirm
    the values are there before you finished the wizard. **FR-009**
11. Upload a licence image on step 1 and Continue → the image **and** the business fields persist
    together. Confirm in the network tab that this was **one** `PUT /restaurants/me/profile`, not
    two. research R2 — this is the regression most worth watching
12. On the tax step, click Continue without entering anything → it advances without a write.
    Spec Decision 2
13. On the address step, Continue with no address saved → blocked; add one → advances.
    **FR-008**
14. Go back to step 1 → your saved values are shown and editable. **FR-011**
15. Kill the network, then Continue on a filled step → an error appears, your typed values stay
    on screen, and the step does not advance. **FR-024**

### C. Review step

16. Reach the review step with everything filled → it summarises what was provided. **FR-013**
17. Reach it with the licence missing → the missing item is named and can be opened directly
    from the summary. **FR-013**
18. Read the wording: it says an administrator will review the account and that ordering stays
    unavailable until approved. It must **not** claim the account was submitted, and there must
    be no "submit for approval" button. **FR-014**
19. As an approved restaurant, open `/onboarding` manually → the review step reflects "approved",
    not "pending". **FR-015**

### D. Checklist card on `/profile`

20. As a partly complete restaurant, open `/profile` → the getting-started card lists the three
    required items, marks which are done, and shows progress out of 3. **FR-016**, **FR-022**
21. The tax item appears as an action ("update tax details"), never as a tick, and does not move
    the progress number. **FR-021**, spec Decision 2
22. Click an outstanding item → the matching profile section opens. **FR-017**
23. Complete it there and return to the overview → the card updates **without a reload**.
    **FR-018**
24. Delete your only delivery address → that item goes back to outstanding and progress drops.
    **FR-018**, "progress regresses" edge case
25. With all three done, open `/profile` → the card recedes and does not present outstanding
    work. **FR-019**
26. As an approved restaurant that has everything → no card, no nagging. Edge case: already
    approved

### E. Bilingual

27. Switch between Vietnamese and English anywhere in the wizard → no untranslated text, and
    entered values and step position survive the switch. **FR-023**, edge case: language switch

---

## What "done" looks like

- All 27 checks above pass.
- `npm run precheck` is green.
- No new endpoint was called — compare the network tab against
  [contracts § 3](./contracts/onboarding-ui-contract.md); every request should already be one
  the profile area makes.
- The `/onboarding` chunk is lazy: confirm it does not appear in the initial bundle in the build
  output.

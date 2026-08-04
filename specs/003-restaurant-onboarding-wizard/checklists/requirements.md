# Specification Quality Checklist: Restaurant Onboarding Wizard & Completion Checklist

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-02
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`

### Iteration 1 — 2026-08-02

Two items fail, both tracing to the same two open decisions recorded in
spec.md § Outstanding Clarifications:

- **No [NEEDS CLARIFICATION] markers remain** — FR-021 and FR-022 carry markers.
  - **Q1 (FR-022)**: which of the four setup items are required for approval.
    `specs/product/BUSINESS_RULES.md` § Auth & Access defines the approval gate (BR-AUTH-1)
    but never states what a restaurant must supply before review, and the platform marks every
    one of these fields optional. No reasonable default exists — inventing a completeness
    threshold would be inventing a business rule, which
    [CLAUDE.md](../../../CLAUDE.md) forbids.
  - **Q2 (FR-021)**: how to present the tax/billing step, which cannot be read back from the
    server. The three viable answers differ materially: device-local memory (conflicts with
    SC-003), an always-actionable item excluded from the count, or a backend dependency.
- **All functional requirements have clear acceptance criteria** — fails only for FR-021 and
  FR-022, which are the two markers above. Every other FR is covered by an acceptance scenario
  in User Stories 1–3.

No further iterations are useful until Q1 and Q2 are answered — both change what "complete"
means, which is the spine of the progress indication, the closing step and the checklist card.

### Iteration 2 — 2026-08-02 — all items pass

Both questions were answered by the product owner and written into spec.md § Clarifications as
Decision 1 and Decision 2:

- **Decision 1** — a complete setup is business profile + delivery address + business licence;
  tax/billing is optional. FR-022 now states the threshold, FR-006 requires optional steps to
  be labelled, and progress is counted out of three.
- **Decision 2** — the tax step is a standing action, never marked done and excluded from the
  count, because it cannot be read back. FR-021 now states the behaviour.

Both markers are gone. Knock-on edits kept the rest of the spec consistent with the decisions:
the "step cannot be verified" edge case, FR-016's description of the card, the **Setup Item**
and **Setup Progress** entities, and the tax assumption. Every functional requirement now maps
to an acceptance scenario in User Stories 1–3.

**Status: ready for `/speckit-plan`.**

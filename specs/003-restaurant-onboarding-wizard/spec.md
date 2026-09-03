# Feature Specification: Restaurant Onboarding Wizard & Completion Checklist

**Feature Branch**: `003-restaurant-onboarding-wizard`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "Restaurant onboarding wizard & profile-completion checklist for
the restaurant role. A dedicated multi-step wizard at route /onboarding that a newly
self-registered restaurant is guided into after email verification and first sign-in: it walks
them through the steps needed before an admin can approve the account — business profile, tax
profile, at least one delivery address with a map point, and the business-license image upload
— with visible step progress, the ability to skip a step and come back, resumability across
sessions, and a final review step that explains what happens next. After the wizard, a
persistent getting-started completion checklist card lives on the /profile dashboard section
showing which steps remain, each deep-linking to the matching existing /profile section.
Restaurant-facing only; admin approval actions are out of scope."

## Context

Feature 001 delivered the restaurant self-service profile area: a restaurant can already edit
its business profile, tax profile, delivery addresses and business-license image. What it
cannot do is find out **what it must fill in, in what order, and why** — a freshly registered
restaurant lands on the storefront with a static "waiting for approval" notice that names no
action. Approval therefore stalls on details nobody asked the restaurant for.

This feature adds the missing journey on top of the forms that already exist. It does not
change what data the platform collects, and it does not change who approves an account.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete the required setup in one guided pass (Priority: P1)

A restaurant owner who has just registered and verified their email signs in for the first
time. Instead of being dropped on the storefront with an unexplained "pending" notice, they
are taken into a guided setup that states up front what the platform needs before an
administrator can approve them and how many steps that is. Each step asks for one coherent
group of details — the business itself, its tax/billing identity, where deliveries should go,
and proof of the business licence — and shows how far along they are. A closing step
summarises what was provided, flags anything still missing, and explains plainly that an
administrator now reviews the account and that ordering stays unavailable until that review
succeeds.

**Why this priority**: This is the whole point of the feature. A restaurant that finishes
this pass is reviewable by an administrator; today, one that registers is not, because nothing
ever told it what to supply. Shipping only this step already converts registrations into
approvable accounts.

**Independent Test**: Register a new restaurant, verify the email, sign in, and follow the
guided setup end to end without visiting the profile area — then confirm from the profile area
that every value entered during the setup was saved, and that the closing step's summary
matched what was actually saved.

**Acceptance Scenarios**:

1. **Given** a restaurant that has verified its email and never completed setup, **When** it
   signs in, **Then** it is taken into the guided setup, which states what is needed for
   approval and shows the total number of steps and the current position.
2. **Given** the guided setup is open, **When** the restaurant supplies valid details on a
   step and continues, **Then** those details are saved before the next step is shown, and the
   progress indicator advances.
3. **Given** a step contains invalid input, **When** the restaurant tries to continue, **Then**
   the move to the next step is blocked with an inline, human-readable explanation, and nothing
   is saved for that step.
4. **Given** every step has been completed, **When** the restaurant reaches the closing step,
   **Then** it sees a summary of what was provided and an explanation that an administrator
   must approve the account before ordering becomes available.
5. **Given** the closing step is reached with one or more steps still unfinished, **When** the
   restaurant views it, **Then** the unfinished items are named individually and each can be
   opened directly from the summary.
6. **Given** the restaurant finishes the guided setup, **When** it leaves, **Then** it is
   returned to the storefront and is not taken into the guided setup again on later sign-ins.

---

### User Story 2 - Leave the setup and resume it later without losing work (Priority: P2)

Setting up a business account is not always possible in one sitting — a tax code has to be
looked up, a photo of the licence has to be taken. The restaurant can leave any step for later
and continue with the rest, close the setup entirely and go browse the catalogue, and come
back — on the same device or another one — to find its earlier answers still there and the
remaining steps still marked as remaining.

**Why this priority**: Without this, a restaurant that lacks one document at signup abandons
the setup and reverts to the state this feature exists to fix. It is separable from P1 (which
is already useful for a restaurant with everything to hand) but it is what makes the flow
survive contact with real users.

**Independent Test**: Start the guided setup, complete one step, skip the next, close the
setup, sign out, sign in again on a different browser, re-open the setup, and confirm the
completed step still shows its saved values and the skipped step still shows as outstanding.

**Acceptance Scenarios**:

1. **Given** a step the restaurant cannot complete right now, **When** it chooses to leave that
   step for later, **Then** the setup moves on and that step remains marked as outstanding.
2. **Given** the guided setup is open, **When** the restaurant chooses to exit it, **Then** it
   reaches the storefront and can browse the catalogue, consistent with a pending account's
   existing right to browse.
3. **Given** a restaurant with a partially completed setup, **When** it signs in again on any
   device, **Then** the setup reflects the details already saved on the server and does not ask
   for them a second time.
4. **Given** a partially completed setup, **When** the restaurant re-enters it, **Then** it
   resumes at the first outstanding step rather than at the beginning.
5. **Given** a step was completed earlier, **When** the restaurant navigates back to it,
   **Then** the previously saved values are shown and can be changed.

---

### User Story 3 - See what is still outstanding from the profile area (Priority: P3)

Once a restaurant has left the guided setup, its progress does not disappear. The profile
overview carries a getting-started card listing each setup item with its state and an overall
progress indication. Every outstanding item links straight to the part of the profile area
where it is filled in. When everything the platform can verify is complete, the card stops
competing for attention.

**Why this priority**: It keeps an incomplete account recoverable long after the initial
setup — including for restaurants that registered before this feature existed and will never
see the wizard. It depends on the same notion of "what counts as done" as P1 and P2, so it
follows them.

**Independent Test**: With a restaurant whose setup is partially complete, open the profile
overview, confirm the card names exactly the outstanding items, follow one link, complete that
item, return to the overview, and confirm the card's state and progress advanced by one.

**Acceptance Scenarios**:

1. **Given** a restaurant with outstanding setup items, **When** it opens the profile overview,
   **Then** a getting-started card lists every setup item, marks which are done and which are
   outstanding, and shows overall progress.
2. **Given** the getting-started card, **When** the restaurant selects an outstanding item,
   **Then** the matching section of the profile area opens directly.
3. **Given** an outstanding item, **When** the restaurant completes it elsewhere in the profile
   area and returns to the overview, **Then** the card shows that item as done and the progress
   has advanced.
4. **Given** every verifiable item is done, **When** the restaurant opens the profile overview,
   **Then** the card no longer presents outstanding work and does not dominate the overview.
5. **Given** a restaurant that registered before this feature and already has a complete
   profile, **When** it opens the profile overview, **Then** it is not shown outstanding work
   it has in fact already done.

---

### Edge Cases

- **The account is already approved**: an approved restaurant is never pulled into the guided
  setup, even if an optional item is unfilled; the getting-started card does not reappear to
  nag an active customer.
- **The account is suspended**: a suspended restaurant may still view and correct its details,
  but the closing step must not imply that finishing the setup will restore ordering — the
  reason ordering is blocked is the suspension, not the missing data.
- **Ordering stays blocked while pending**: finishing every step changes nothing about the
  ordering gate. The setup must never suggest it grants ordering; approval is an
  administrator's decision (BR-AUTH-1) and remains server-authoritative.
- **Registered before this feature**: a restaurant with a partly filled profile that never saw
  the wizard sees a truthful checklist — items already satisfied show as done, and it is not
  forced back through a wizard for data it already supplied.
- **Progress regresses**: if the restaurant later deletes its only delivery address, that item
  becomes outstanding again and the checklist reflects it, rather than staying green on the
  strength of a past completion.
- **A step cannot be verified**: the tax/billing step cannot be read back from the server (see
  Assumptions), so it carries no completion state at all and sits outside the progress count
  (Decision 2) — the restaurant is never told an item is done when the platform cannot confirm
  it, and equally is never nagged about one it may already have filled in.
- **Save fails mid-setup**: a step whose save is rejected keeps the restaurant's typed values
  on screen with a retryable error, and the step stays outstanding; it is never silently
  treated as complete.
- **Connection lost mid-setup**: work already saved on earlier steps survives; the restaurant
  can resume from the last successfully saved step.
- **A non-restaurant opens the setup**: the guided setup is meaningless for other roles and for
  signed-out visitors, and must not be reachable by them.
- **Language switch mid-setup**: switching between Vietnamese and English does not lose entered
  values or reset progress.

## Requirements *(mandatory)*

### Functional Requirements

#### Entering and leaving the guided setup

- **FR-001**: The system MUST provide a dedicated guided setup journey for the restaurant role,
  separate from the profile area, that a restaurant can be sent to directly by link.
- **FR-002**: The system MUST take a signed-in restaurant into the guided setup automatically
  when its setup is outstanding and it has not yet chosen to leave the setup, and MUST NOT do
  so for a restaurant whose setup is complete or whose account is already approved.
- **FR-003**: The system MUST allow the restaurant to exit the guided setup at any point and
  reach the storefront, preserving the pending account's existing right to browse (BR-AUTH-1).
- **FR-004**: The system MUST NOT re-enter a restaurant into the guided setup automatically
  once it has completed the setup or has chosen to dismiss it, while still allowing it to be
  re-opened deliberately.
- **FR-005**: The system MUST restrict the guided setup to signed-in restaurant accounts and
  MUST redirect other roles and signed-out visitors away from it.

#### Steps and progress

- **FR-006**: The guided setup MUST present the setup as an ordered series of steps covering
  the business profile, the tax/billing profile, at least one delivery address, and the
  business-licence image, followed by a closing review step. Steps that are not required
  (FR-022) MUST be labelled as optional so the restaurant can tell what actually gates its
  review.
- **FR-007**: The system MUST show, at every point in the guided setup, which step is current,
  how many steps there are, and which steps are already done.
- **FR-008**: The system MUST validate a step's input before advancing and MUST block the
  advance with an inline, human-readable explanation when the input is invalid.
- **FR-009**: The system MUST persist a step's details when the restaurant advances past it, so
  that progress does not depend on reaching the end of the setup.
- **FR-010**: The system MUST let the restaurant leave any step for later and continue with the
  remaining steps, keeping the skipped step marked outstanding.
- **FR-011**: The system MUST let the restaurant return to any earlier step and see and change
  the values already saved for it.
- **FR-012**: The system MUST resume a re-opened setup at the first outstanding step.

#### Closing step

- **FR-013**: The closing step MUST summarise what has been provided and MUST name each item
  that is still outstanding, with a way to open each one directly.
- **FR-014**: The closing step MUST explain that an administrator reviews the account and that
  ordering remains unavailable until the account is approved, and MUST NOT state or imply that
  completing the setup approves the account or enables ordering.
- **FR-015**: The closing step MUST reflect the account's actual current standing — pending
  review, approved, or suspended — rather than assuming a pending account.

#### Completion checklist in the profile area

- **FR-016**: The profile overview MUST show a getting-started card listing the three required
  setup items with their states and the overall progress, for a restaurant whose setup is
  outstanding. The optional tax/billing action MAY be offered alongside them but MUST NOT
  affect the stated progress.
- **FR-017**: Each outstanding item on the getting-started card MUST open the part of the
  profile area where that item is completed.
- **FR-018**: The getting-started card MUST reflect changes made elsewhere in the profile area
  without requiring the restaurant to reload, and MUST show an item as outstanding again if the
  data behind it is later removed.
- **FR-019**: The getting-started card MUST recede once no verifiable item is outstanding, and
  MUST NOT be shown as outstanding work to a restaurant that has already supplied the data.

#### Truthfulness of state

- **FR-020**: The system MUST derive each item's state from the restaurant's saved data
  wherever that data can be read back, rather than from a record of which screens were visited.
- **FR-021**: The system MUST present the tax/billing item as a standing action ("update tax
  details") rather than as a completable checkbox: it MUST never be marked done, MUST never be
  reported as outstanding work, and MUST be excluded from the progress count — because its
  completion cannot be confirmed from saved data (Decision 2). Should the platform later expose
  a way to read the saved tax details, this item becomes an ordinary verifiable item under
  FR-020.
- **FR-022**: The system MUST treat the business profile, at least one delivery address, and
  the business-licence image as the three items required for a complete setup, and MUST treat
  the tax/billing details as optional (Decision 1). Progress MUST be counted over exactly those
  three required items.

#### Cross-cutting

- **FR-023**: All restaurant-facing text introduced by this feature MUST be available in both
  Vietnamese and English.
- **FR-024**: The system MUST preserve the restaurant's entered values and keep the step
  outstanding when a save is rejected, presenting a retryable, human-readable error.
- **FR-025**: The guided setup MUST collect only details the platform already collects in the
  profile area, and MUST NOT introduce new data the restaurant is asked for.

### Key Entities *(include if feature involves data)*

- **Setup Item**: one thing the restaurant supplies during setup, and whether it gates review.
  Three are **required** and verifiable — the business profile, a delivery address, the
  business licence — each carrying a state (done / outstanding) derived from the restaurant's
  saved data, plus the place in the profile area where it is completed. One is **optional and
  unverifiable** — the tax/billing profile — which carries no state at all and is offered as a
  standing action (Decision 2).
- **Setup Progress**: the restaurant's overall standing across the three required items — how
  many are done and which remain — together with whether the restaurant has chosen to dismiss
  the guided setup. It is a view over data the platform already holds, not a new record the
  restaurant edits.
- **Approval Standing**: the account's position in the approval workflow — pending review,
  approved, or suspended — owned and decided by the server, displayed but never set here.

### Out of Scope

- Any administrator-side action: approving, rejecting or suspending a restaurant, and setting
  credit limits. Those belong to the admin console (M13, UC-ADM-02).
- Changing what data the platform collects from a restaurant, or adding fields to the existing
  business, tax, address or licence forms.
- Registration and email verification themselves, which the auth feature (M1) already provides.
- Notifying an administrator that a restaurant has finished its setup.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A restaurant that has its business details, tax details, delivery address and
  licence image to hand can finish the entire guided setup in a single sitting in under 10
  minutes, without needing help or visiting the profile area.
- **SC-002**: A newly registered restaurant can state, without assistance, what remains before
  its account can be reviewed — measured by every outstanding item being named on screen at
  both the closing step and the profile overview.
- **SC-003**: A restaurant that leaves the setup part-way and returns later finds 100% of its
  previously saved answers intact, on any device.
- **SC-004**: Invalid input is caught before it is saved, so no setup step ever stores an
  incomplete or contradictory record.
- **SC-005**: The share of restaurants that reach a reviewable, complete profile within 24
  hours of registering increases relative to the pre-feature baseline, where nothing told them
  what to supply.
- **SC-006**: No screen in the feature claims an item is complete that the platform cannot
  confirm from saved data, and no screen states or implies that finishing the setup enables
  ordering.
- **SC-007**: The entire feature reads correctly in both Vietnamese and English with no
  untranslated text.

## Assumptions

- **The forms already exist.** Feature 001 delivered the business-profile, tax-profile,
  delivery-address and business-licence forms in the profile area. This feature arranges and
  explains them; it does not rebuild them, and any change to what they collect is out of scope.
- **No "submit for review" action exists.** The platform offers no way for a restaurant to
  submit its account for approval — only a way to read its current approval standing.
  Completing the setup therefore does not notify anyone; an administrator picks the account up
  from the admin console. The closing step must be worded to match that reality rather than
  promising a submission that does not happen.
- **The tax/billing details cannot be read back.** The platform accepts tax/billing details but
  offers no way to retrieve them afterwards. Consequently the tax step cannot be pre-filled on
  return, and its completion cannot be confirmed from saved data the way the other three items
  can. Decision 2 settles how that is handled: the step stays a standing action, outside the
  progress count.
- **The three required items can be verified.** The business profile (name, address, contact
  person, receiving window), the business-licence image and the saved delivery addresses can
  all be read back, so their states are derived from saved data rather than remembered. This is
  what makes Decision 1's threshold checkable at all.
- **Approval standing is the server's to decide.** The feature reads it and explains it; it
  never sets it, and it handles a server rejection of a disallowed action gracefully
  (BR-AUTH-4).
- **A pending restaurant may browse.** BR-AUTH-1 grants a pending account the right to browse
  the catalogue, so the guided setup is escapable by design and must never trap the restaurant.
- **The dismissal choice lasts the browser session, not forever.** Planning established that
  the platform holds no per-restaurant UI preference and offers no endpoint to store one, so a
  dismissal cannot follow the restaurant across devices. It therefore lasts the current session:
  a restaurant that exits the setup browses undisturbed until it signs in again, and the
  standing checklist card (User Story 3) is the reminder that persists. Making the dismissal
  durable and cross-device would need new backend support and is out of scope here.
- **Scale is one restaurant's own data.** Everything shown is the signed-in restaurant's, and
  there is no cross-restaurant view here.

## Clarifications

Two decisions could not be resolved from the product documentation. Both were put to the
product owner on 2026-08-02 and are now settled.

### Decision 1: A complete setup is business profile + delivery address + business licence

**Question**: Which of the four items must be supplied before the account counts as ready for
review, and which are genuinely optional?

**Context**: `BUSINESS_RULES.md` states only that a restaurant starts `PENDING_APPROVAL` and
cannot order until an administrator approves it (BR-AUTH-1); it does not say what the
restaurant must supply first. The underlying platform treats every one of these fields as
optional, so it enforces no answer either — the threshold had to be decided, not inferred.

**Resolution**: Three items are **required** — the business profile, at least one delivery
address, and the business-licence image. The **tax/billing details are optional**.

**Rationale**: The licence is the evidence an administrator actually verifies during approval,
and a delivery address is the minimum needed to receive goods at all; tax details are not
needed until the first invoice. The choice also sidesteps Decision 2 cleanly — the one item
whose completion cannot be verified is also the one item that does not gate review.

**Consequences**: Progress is counted out of three. FR-022 records the threshold; FR-006
requires the optional step to be labelled as such.

### Decision 2: The tax step is a standing action, never counted

**Question**: How should the tax/billing step behave, given the platform accepts tax details
but offers no way to read them back?

**Context**: The checklist can never confirm this item from saved data, and the form cannot be
pre-filled when the restaurant returns. Three answers were viable: remember it device-locally
and label it unconfirmed; present it as a permanent action excluded from the count; or treat it
as verifiable and block on backend work to expose a read.

**Resolution**: The tax item is presented as a standing action — "update tax details" — never
marked done, never reported as outstanding, and excluded from the progress count.

**Rationale**: It is the only option that is honest everywhere. Remembering completion on the
device that filled the form in would contradict SC-003's promise that a restaurant resumes on
any device, and would show a different state on a phone than on a laptop. Waiting for a
server-side read would make a UI feature hostage to backend work.

**Consequences**: FR-021 records the behaviour. "Complete" stays honestly attainable, because
the progress count covers only the three items the platform can verify. If the platform later
exposes a way to read the saved tax details, this item should be promoted to an ordinary
verifiable item under FR-020 and folded into the count.

---

## Addendum — 2026-09-03: setup stops asking twice

The original scope said the wizard "arranges and explains" the existing forms
and that "any change to what they collect is out of scope" (Assumptions). That
held for the arrangement, and it left one thing unaddressed: running the four
steps back to back makes plain how much a restaurant types twice.

**What was being asked twice.** Sign-up already takes the restaurant's name,
phone, email and tax code. Step 1 takes an address and a contact person. Step 2
then asks for an invoice address and an invoice email, and step 3 for a delivery
address, a recipient and a phone. For most restaurants those are the same
place and the same person, typed three times.

**What changed.** Nothing was removed and nothing is copied silently — the
fields are legally distinct, and a company can be billed where it does not trade
just as a chain's second branch takes delivery where it is not registered. Each
of the three now offers what setup already knows, as a one-tap fill that names
the value and steps aside as soon as anything is typed:

- **FR-A1**: The invoice address MUST offer the restaurant's own address.
- **FR-A2**: The invoice email MUST offer the account's own email.
- **FR-A3**: The delivery-address form MUST offer the restaurant's address,
    contact person and account phone.
- **FR-A4**: An offer MUST NOT appear when the field already holds something,
    and MUST NOT fill a value the platform does not hold.
- **FR-A5**: Filling a delivery address MUST NOT invent map coordinates. The
    fill seeds the place search; the point on the map stays the restaurant's to
    confirm.

**Also corrected.** Step 1's hint promised "khung giờ nhận hàng" — a
receiving-window field the business profile stopped collecting when every
delivery moved to one fixed early-morning window. The hint now names the
licence, which is what that step actually asks for beyond the identity fields.

---

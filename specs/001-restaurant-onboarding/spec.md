# Feature Specification: Restaurant Onboarding & Profile

**Feature Branch**: `001-restaurant-onboarding`

**Created**: 2026-07-22

**Status**: Draft

**Input**: User description: "Restaurant onboarding & profile (M2, route /profile) for the restaurant role — view/edit business profile, manage delivery addresses, view approval status, upload business license. Restaurant-facing self-service only; admin approve/credit-limit out of scope. Follows Postman collection folder 04."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete and maintain the restaurant business profile (Priority: P1)

A restaurant owner who has just self-registered signs in and lands on their profile
area. It shows their current approval status prominently and lets them fill in the
business details the platform needs before it can serve them: business name, address,
a contact person, and the daily receiving/pickup window during which deliveries can be
accepted. They edit these details, save, and see confirmation that the profile was
updated.

**Why this priority**: This is the gate. A restaurant cannot be approved, and therefore
cannot order, until its business profile is complete. It is the minimum viable slice —
delivering just this screen already moves a restaurant from "registered" to "ready for
admin approval".

**Independent Test**: Sign in as a restaurant, open the profile area, edit every business
field, save, reload the page, and confirm the saved values persist and the approval-status
indicator reflects the account's real state.

**Acceptance Scenarios**:

1. **Given** a signed-in restaurant with an incomplete profile, **When** they open the
   profile area, **Then** they see their current business details (empty where unset) and
   a clearly labelled approval-status indicator.
2. **Given** the profile form, **When** the restaurant edits the name, address, contact
   person and receiving window and saves, **Then** the changes persist and a success
   confirmation is shown.
3. **Given** a receiving window whose end time is not after its start time, **When** the
   restaurant tries to save, **Then** the save is blocked with an inline, human-readable
   explanation and no change is sent.
4. **Given** the account is `PENDING_APPROVAL`, **When** the restaurant views the profile,
   **Then** an explanation states that ordering is unavailable until an administrator
   approves the account.

---

### User Story 2 - Manage delivery addresses (Priority: P2)

The restaurant maintains the set of locations that orders can be delivered to. They can
view all saved addresses, add a new one (street address, recipient name, phone, and a map
point), edit an existing one, remove one that is no longer used, and mark exactly one as
the default delivery address.

**Why this priority**: Orders must be delivered somewhere. At least one delivery address is
required for the restaurant to receive goods, but it is separable from the core business
profile and can ship immediately after P1.

**Independent Test**: Sign in as a restaurant, add a delivery address, mark it default,
edit it, add a second and switch the default, then delete one — confirming the list and the
default selection stay consistent after each action.

**Acceptance Scenarios**:

1. **Given** the delivery-addresses view, **When** the restaurant adds an address with all
   required fields, **Then** it appears in the list.
2. **Given** an existing address, **When** the restaurant marks it as default, **Then** it
   becomes the sole default and any previously default address is no longer default.
3. **Given** an existing address, **When** the restaurant edits or deletes it, **Then** the
   list reflects the change immediately.
4. **Given** a required field is missing or invalid (e.g. empty recipient name or phone),
   **When** the restaurant tries to save, **Then** the save is blocked with an inline
   explanation.

---

### User Story 3 - Attach a business-license document (Priority: P3)

The restaurant uploads an image of its business license so an administrator can verify the
business during approval. After a successful upload the license image is shown on the
profile and stored with the business profile.

**Why this priority**: It strengthens the approval evidence and is expected by the approval
workflow, but a restaurant can still be created and reviewed without it, so it follows the
two core slices.

**Independent Test**: Sign in as a restaurant, upload a license image from the profile
area, save, reload, and confirm the image is associated with the profile.

**Acceptance Scenarios**:

1. **Given** the profile area, **When** the restaurant selects a valid image to upload,
   **Then** the image is stored and shown as the current business license.
2. **Given** an upload that fails (network or rejected file), **When** it happens, **Then**
   the restaurant sees a clear error and the previously stored license, if any, is
   unchanged.

---

### Edge Cases

- **Approval gate enforcement**: a `PENDING_APPROVAL` or `SUSPENDED` restaurant may open and
  edit its profile and addresses, but ordering actions remain unavailable with an inline
  explanation (per BR-AUTH-1; the server remains authoritative and any `403` is handled
  gracefully).
- **Deleting the default address**: removing the current default must leave the address set
  in a consistent state (either no default, or a clearly indicated next default) without a
  broken UI.
- **Suspended account**: the approval-status indicator distinguishes `SUSPENDED` from
  `PENDING_APPROVAL` so the restaurant understands why ordering is blocked.
- **Concurrent/stale data**: if the saved profile or address list changed elsewhere, the
  view can be refreshed to the authoritative server state.
- **Offline / API unreachable**: read failures show a retryable empty/error state; write
  failures preserve the user's entered values so they can retry.
- **Receiving window validation**: end time must be after start time; both are required
  together.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a signed-in restaurant view its current business profile:
  business name, address, contact person, and receiving/pickup window (start and end time).
- **FR-002**: The system MUST let a restaurant update its business profile and confirm the
  result of the save (success or a human-readable failure).
- **FR-003**: The system MUST validate the receiving/pickup window before saving so that the
  end time is after the start time and both are provided together.
- **FR-004**: The system MUST display the restaurant's approval status
  (`PENDING_APPROVAL`, `APPROVED`, `SUSPENDED`) with an inline explanation of what it means
  for the restaurant, refreshed from the authoritative source.
- **FR-005**: While the account is not `APPROVED`, the system MUST make ordering actions
  unavailable in the UI and MUST still handle a server rejection of a disallowed action
  gracefully.
- **FR-006**: The system MUST let a restaurant view all of its saved delivery addresses.
- **FR-007**: The system MUST let a restaurant add a delivery address with street address,
  recipient name, phone, and a geographic point, and MUST validate required fields before
  saving.
- **FR-008**: The system MUST let a restaurant edit and delete existing delivery addresses,
  reflecting each change in the list.
- **FR-009**: The system MUST let a restaurant mark exactly one delivery address as the
  default, ensuring no more than one default exists at a time.
- **FR-010**: The system MUST let a restaurant upload a business-license image, show it as
  the current license after a successful upload, and leave the previous value unchanged on
  failure.
- **FR-011**: All restaurant-facing text in this feature MUST be available in both Vietnamese
  and English.
- **FR-012**: The feature MUST be reachable from the restaurant navigation at the profile
  destination and MUST render within the restaurant (enterprise) chrome.

### Key Entities *(include if feature involves data)*

- **Restaurant Business Profile**: the restaurant's identity and operating details — business
  name, address, contact person, receiving/pickup window, and an optional business-license
  image reference. One per restaurant account.
- **Delivery Address**: a place an order can be delivered to — street address, recipient
  name, phone, geographic point, and a default flag. A restaurant has zero or more; at most
  one is the default.
- **Approval Status**: the account's standing in the approval workflow — one of
  `PENDING_APPROVAL`, `APPROVED`, `SUSPENDED` — determined and owned by the server.
- **Business License**: an uploaded image used as verification evidence, associated with the
  business profile.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A restaurant can complete every required business-profile field and save a
  valid profile in a single visit, in under 3 minutes.
- **SC-002**: A restaurant can add, edit, set-default, and delete a delivery address without
  leaving the profile area, and the list stays consistent after each action 100% of the time.
- **SC-003**: On every visit, the restaurant sees an approval-status indicator that matches
  the account's authoritative status, and — when not approved — an explanation of why
  ordering is unavailable.
- **SC-004**: Invalid input (bad receiving window, missing required address field) is caught
  before submission and never results in a saved invalid record.
- **SC-005**: The full profile area is presented correctly in both Vietnamese and English
  with no untranslated text.

## Assumptions

- The restaurant account already exists and can sign in; self-registration and
  authentication are provided by the existing Auth feature (M1) and are out of scope here.
- The approval decision, credit limit, and any admin-side actions are performed by
  administrators in a separate feature; this feature is restaurant-facing self-service only.
- The restaurant-facing profile, delivery-address, approval-status, and business-license
  operations are already available from the existing backend (Postman collection folder 04)
  and its generated typed client; no new backend endpoints are required.
- Image uploads reuse the platform's existing signed-upload pattern (as already used for
  product images), including its storage provider configuration.
- The profile area lives at the restaurant profile destination (`/profile`, M2) within the
  enterprise layout, consistent with the sitemap.
- A geographic point for a delivery address is captured with the platform's existing map/
  place tooling; precise map interaction detail is an implementation concern for planning.

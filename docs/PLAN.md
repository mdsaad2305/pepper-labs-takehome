# Catalog Manager Take-Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Each task below should be completed, verified, and committed before moving to the next one.

**Goal:** Complete the Catalog Manager README tasks with a small, maintainable implementation that demonstrates good engineering judgment without over-abstracting the existing app.

**Architecture:** Keep the current Express route and React page structure. Add lightweight centralized API error handling, use transactions for multi-table writes, validate at both API and form boundaries, and keep state local to the pages that own each workflow. Defer broader abstractions to the final submission write-up unless the implementation proves they are needed.

**Tech Stack:** Express, TypeScript, better-sqlite3, Vitest/Supertest, React, React Router, Tailwind, Vite.

**Spec:** [`README.md`](../../../README.md) and [`backend/__tests__/tasks.test.ts`](../../../backend/__tests__/tasks.test.ts).

## Scope Policy

| Category | What It Means Here |
|---|---|
| Required work | The README tasks and backend acceptance tests: create products, update variant price/inventory, hide soft-deleted products, products-page loading/error states, and client/server validation. |
| Good practices included | Lightweight centralized error middleware, JSON error consistency, synchronous route throws, database transaction for create-product, careful numeric validation where `0` is valid, disabled submit/save/delete states, and concise manual verification. |
| Deferred to `SUBMISSION.md` | Future improvements, out-of-scope bugs, broader abstractions, extra test coverage ideas, and trade-offs discovered while implementing. |

Do not edit or commit `SUBMISSION.md` until the final task. During implementation, keep notes locally if needed, then write them once at the end so the commit history stays focused on working software.

## Global Constraints

- Do not add dependencies.
- Do not edit `backend/__tests__/tasks.test.ts`.
- Keep Express route handlers synchronous.
- Use API error responses shaped as `{ error: string }`.
- Do not add machine-readable error codes in this pass.
- Treat `0` as valid for price and inventory.
- Convert dollars to integer cents in the frontend before sending API requests.
- Keep commits small and reviewer-friendly.

---

## Task 1: Lightweight Backend Error Handling

**Commit:** `chore(api): add lightweight error middleware`

**Purpose:** Standardize API error responses for Bonus B while keeping the error layer intentionally small.

**Files:**

- Create `backend/src/errors.ts`
- Create `backend/src/middleware/errorHandler.ts`
- Modify `backend/src/app.ts`
- Modify `backend/src/routes/products.ts`
- Modify `backend/src/routes/variants.ts`
- Modify `backend/src/routes/categories.ts`

**Implementation:**

- Add a tiny `HttpError` class with `status` and `message`.
- Add `notFoundHandler` that returns `404` JSON.
- Add `errorHandler` that:
  - returns `err.status` and `{ error: err.message }` for `HttpError`
  - returns `400 { error: "Invalid JSON request body" }` for malformed JSON from `express.json()`
  - logs unexpected errors and returns `500 { error: "Internal server error" }`
- Register both middleware functions after all routers in `app.ts`.
- Replace known 404 responses in routes with `throw new HttpError(...)`.
- Remove local `try/catch` blocks that only duplicate generic error handling.

**Good-practice signal:**

- Centralized errors make route behavior consistent.
- The middleware remains simple enough for the size of the app.
- Malformed JSON stays a client error instead of becoming a generic server error.

**Out of scope for this commit:**

- No `code` field.
- No `details` payload.
- No database-specific error classifier.
- No separate error test suite unless time remains after all required work.

**Verify:**

- Run `npm test`.
- Expected: health still passes; task tests still fail for unimplemented routes and the soft-delete bug.

---

## Task 2: Hide Soft-Deleted Products

**Commit:** `fix(products): hide soft-deleted products from list`

**Purpose:** Complete README Task 3.

**Files:**

- Modify `backend/src/routes/products.ts`

**Implementation:**

- In `GET /api/products`, always include `p.deleted_at IS NULL`.
- Preserve the existing search filter.
- Preserve the existing category filter.
- Keep the current response shape.

**Good-practice signal:**

- This is a targeted bug fix with no unrelated lifecycle refactor.

**Verify:**

- Run `npm test --prefix backend -- -t "Task 3"`.
- Run `npm test`.
- Expected: Task 3 passes; create and variant update tests still fail.

---

## Task 3: Create Product API

**Commit:** `feat(products): create products with variants`

**Purpose:** Complete the backend half of README Task 1 and create-product server validation from Task 5.

**Files:**

- Modify `backend/src/routes/products.ts`

**Implementation:**

- Replace the `POST /api/products` 501 stub.
- Add small local route helpers for:
  - required non-empty strings
  - finite non-negative numbers
  - reading a product with variants after insert
- Validate:
  - product `name` is required
  - `variants` is required and non-empty
  - variant `sku` is required
  - variant `name` is required
  - `price_cents >= 0`
  - `inventory_count >= 0`
  - SKU is unique
- Insert product and variants inside a single `db.transaction`.
- Return `201` with the created product and variants.
- Reuse the product-with-variants helper in `GET /api/products/:id` so read and create responses stay aligned.

**Good-practice signal:**

- The transaction protects against partial product creation.
- Validation stays close to the route while there are only two write endpoints.

**Out of scope for this commit:**

- No new `validation/` directory.
- No generic schema system.
- No category-management changes beyond accepting the provided `category_id`.

**Verify:**

- Run `npm test --prefix backend -- -t "Task 1"`.
- Run `npm test --prefix backend -- -t "Input validation"`.
- Expected: Task 1 passes; create-product validation passes; variant update validation still fails until Task 4.

---

## Task 4: Update Variant API

**Commit:** `feat(variants): update price and inventory`

**Purpose:** Complete the backend half of README Task 2 and variant-update server validation from Task 5.

**Files:**

- Modify `backend/src/routes/variants.ts`

**Implementation:**

- Replace the `PUT /api/variants/:id` 501 stub.
- Check variant existence first.
- Return `404 { error: "Variant not found" }` for missing variants.
- Accept and update only:
  - `price_cents`
  - `inventory_count`
- Validate provided values are finite numbers and `>= 0`.
- Preserve existing values when a field is omitted.
- Update `updated_at`.
- Return the updated variant row.

**Good-practice signal:**

- The API implements the README-requested editable fields without expanding the product model.
- Omitted fields are handled intentionally, and valid zeroes are preserved.

**Out of scope for this commit:**

- No SKU editing.
- No variant name editing.
- No SKU collision UI or route behavior beyond what create-product needs.

**Verify:**

- Run `npm test --prefix backend -- -t "Task 2"`.
- Run `npm test`.
- Expected: all backend tests pass.

---

## Task 5: Products Page Loading and Error States

**Commit:** `feat(products): show loading and error states`

**Purpose:** Complete README Task 4.

**Files:**

- Modify `frontend/src/pages/ProductsPage.tsx`

**Implementation:**

- Add local `loading` state for product fetches.
- Add local `error` state for product fetch failures.
- Set loading before each product request.
- Check `response.ok` before treating the response as product data.
- Show:
  - spinner while loading
  - error message on failed product fetch
  - existing empty state when there are no matching products
  - existing grid when products load successfully
- Leave category fetching simple unless it breaks the product-list UX.

**Good-practice signal:**

- The page no longer silently swallows failed product requests.
- The solution is local and proportional to the one page named in the README.

**Out of scope for this commit:**

- No shared `useFetch` hook.
- No typed API-client rewrite.
- No loading/error rewrite for unrelated pages.

**Verify:**

- Run `npm run build --prefix frontend`.
- Manually verify loading, error, empty, and loaded states on `/products`.

---

## Task 6: Create Product Form

**Commit:** `feat(products): add create product form`

**Purpose:** Complete the frontend half of README Task 1 and create-product client validation from Task 5.

**Files:**

- Modify `frontend/src/pages/CreateProductPage.tsx`
- Modify `frontend/src/lib/api.ts` only if a tiny helper removes repeated response parsing
- Modify `frontend/src/types.ts` only if request types make the form easier to read

**Implementation:**

- Replace the placeholder with a working form for:
  - product name
  - description
  - category
  - status
  - variant SKU
  - variant name
  - price in dollars
  - inventory count
- Fetch categories for the category select.
- Validate on the client before submit:
  - product name required
  - SKU required
  - variant name required
  - price required and `>= 0`
  - inventory required and `>= 0`
- Submit to `POST /api/products`.
- Convert price dollars to `price_cents`.
- Show backend errors, including duplicate SKU.
- Disable submit while saving.
- Navigate to the created product detail page on success.

**Good-practice signal:**

- The form validates before sending bad requests but still trusts the server as the source of truth for uniqueness.
- The submit state prevents duplicate create requests.

**Scope choice:**

- Start with one variant row because the README requires at least one variant. If multiple variant rows are not implemented, mention that as a future improvement in final `SUBMISSION.md`.

**Verify:**

- Run `npm run build --prefix frontend`.
- Manually verify empty validation, valid zero values, duplicate SKU handling, and successful redirect.

---

## Task 7: Variant Edit UI and Delete In-Flight Guard

**Commit:** `feat(variants): edit price and inventory inline`

**Purpose:** Complete the frontend half of README Task 2 and Bonus A.

**Files:**

- Modify `frontend/src/pages/ProductDetailPage.tsx`

**Implementation:**

- Replace the current variant edit alert with inline editing.
- Keep SKU and variant name read-only.
- Edit only:
  - price
  - inventory count
- Validate on the client before save:
  - price required and `>= 0`
  - inventory required and `>= 0`
- Convert displayed dollars to `price_cents`.
- Send `PUT /api/variants/:id`.
- Show row-level save errors.
- Disable Save while the request is in flight.
- Patch the updated variant into local product state after success.
- Add `deleting` state to the product delete button.
- Ignore additional delete clicks while deletion is already in flight.
- Disable the delete button during deletion.

**Good-practice signal:**

- The UI matches the API scope exactly.
- In-flight guards prevent duplicate mutations without introducing a mutation framework.

**Verify:**

- Run `npm run build --prefix frontend`.
- Manually verify inline edit, validation, successful save, local row update, and delete double-click protection.

---

## Task 8: Final Verification and Submission Write-Up

**Commit:** `docs: summarize catalog manager implementation`

**Purpose:** Commit `SUBMISSION.md` only after the implementation is complete and verified.

**Files:**

- Modify `SUBMISSION.md`

**Implementation:**

- Run final verification before editing the write-up:
  - `npm test`
  - `npm run build --prefix frontend`
  - `git diff -- package.json backend/package.json frontend/package.json`
- Fill out `SUBMISSION.md` with:
  - completed README tasks
  - completed bonus tasks
  - a short implementation summary
  - good-practice choices made intentionally
  - trade-offs
  - future improvements
  - any known bugs or out-of-scope behavior discovered during implementation
- Keep the write-up factual and concise.

**Good-practice signal:**

- The submission explains judgment, not just output.
- Future improvements and known issues are documented at the end rather than scattered through implementation commits.

**Future improvements candidates for `SUBMISSION.md`:**

- Extract shared validation modules if more write routes are added.
- Add a typed API client if more screens need consistent response/error parsing.
- Add a reusable fetch hook if loading/error patterns spread beyond a few pages.
- Support multiple variant rows in the create-product form if not implemented.
- Add frontend tests for form validation and loading/error states.
- Add machine-readable error codes if clients need specific error branching.
- Audit product lifecycle behavior beyond the list page, such as direct access to soft-deleted product-related resources.

**Verify:**

- Backend tests pass.
- Frontend build passes.
- Dependency manifests are unchanged.
- `SUBMISSION.md` matches the implementation that actually landed.

---

## Coverage Check

| README Item | Covered By |
|---|---|
| Task 1: Create Product backend | Task 3 |
| Task 1: Create Product frontend | Task 6 |
| Task 2: Update Variant backend | Task 4 |
| Task 2: Update Variant frontend | Task 7 |
| Task 3: Soft-delete bug | Task 2 |
| Task 4: Loading/error states | Task 5 |
| Task 5: Server validation | Tasks 3 and 4 |
| Task 5: Client validation | Tasks 6 and 7 |
| Bonus A: Delete double-submit | Task 7 |
| Bonus B: Inconsistent error responses | Task 1 |

# Submission

**Candidate name:** _Your name_
**Date:** _Date_
**Time spent:** _Approximate hours_

---

## Completed Tasks

Check off what you finished:

- [x] Task 1 — Create Product
- [x] Task 2 — Update Variant
- [x] Task 3 — Fix soft-delete bug
- [x] Task 4 — Loading & error states
- [x] Task 5 — Input validation
- [x] Bonus A — Double-submit on Delete
- [x] Bonus B — Inconsistent error responses

---

## Approach & Decisions

_Briefly describe the approach you took for each task. Mention any trade-offs you made or alternative approaches you considered._

Overall, I tried to keep the solution close to the structure that was already in the app. The backend already had separate Express route files, and the frontend already used page-level React state, so I built on those patterns instead of adding a larger framework or new dependencies. I also added a small shared error handler on the backend so API errors come back in the same JSON format.

### Task 1

I built the create product flow end-to-end. On the backend, I added `POST /api/products` and made it create the product and its variants together in one database transaction. That way, if a variant insert fails, the product does not get left half-created.

On the frontend, I replaced the placeholder page with a real form for product details and variants. I decided to support multiple variants, since the backend tests covered that and it is a natural fit for catalog products. Prices are entered in dollars in the UI, then converted to cents before sending to the API so the database can keep using integer values.

### Task 2

I implemented variant editing through `PUT /api/variants/:id` and kept the editable fields limited to price and inventory count, which matched the task description. SKU and variant name stay read-only in the edit UI because the task only asked for price and inventory updates.

On the product detail page, I added a modal for editing a variant and updated the local product state after a successful save. I also disabled save actions while the request is running so the user does not accidentally send the same update more than once.

### Task 3

I fixed the soft-delete issue by filtering deleted products out of the product list query with `deleted_at IS NULL`. I kept this change focused on the list endpoint because that was the bug called out in the README.

I also updated the category product counts to ignore soft-deleted products, since those counts should match what users see in the active catalog.

### Task 4

I added loading and error states to the products page. Before this, a failed request could look like an empty catalog, which would be confusing. Now the page shows a spinner while products load, an error message if the request fails, the existing empty state when there are no matching products, and the grid when products load successfully.

I kept this state local to the products page instead of adding a shared fetch hook. Since only this page needed the new behavior for the task, a local solution felt simpler and easier to review.

### Task 5

I added validation on both the server and the client. The server checks required product names, required and unique SKUs, at least one variant, and non-negative price and inventory values. I made sure `0` is valid for both price and inventory because free items and out-of-stock items are still valid catalog cases.

The frontend performs the same basic checks before submitting so users get quick feedback. The server is still the final source of truth, especially for duplicate SKUs, because another request could create the same SKU before the form is submitted.

---

## What I'd improve with more time

_What would you add, refactor, or fix if you had another couple of hours?_

- Add pagination to the products list. Right now the list endpoint returns all matching products, which is okay for the seed data but would not scale well if the catalog grew.
- Add a toast library like `react-toastify` for frontend feedback. The current UI does show backend errors in the form or page, but toast messages would make success and error feedback feel more consistent across the app.
- Standardize in-flight protection for all mutation actions. Create product, variant save, and product delete already disable their main action while saving/deleting, but I would turn that into a consistent pattern for any future create, update, or delete flows.
- Add variant SKU and variant name editing as a future extension. The task only required editing price and inventory, so those fields are currently read-only in the edit modal. SKU editing would need duplicate-SKU validation on both the client and server so the database stays clean.
- Add a UI for deleting individual variants. The backend has a `DELETE /api/variants/:id` route, but the frontend does not expose it yet. I would keep the existing rule that prevents deleting the last variant for a product.

---

## Anything else?

_Optional — anything you want the reviewer to know (e.g. bugs you noticed, improvements you'd suggest to the existing code, etc.)._

One thing I noticed is that soft-delete behavior is only partly handled. The product list now hides soft-deleted products, and category counts ignore them too, but direct product detail/update/delete paths can still reach soft-deleted products. Variant endpoints can also still access variants that belong to a soft-deleted product. With more time, I would audit those routes and make the product lifecycle rules consistent everywhere.

The backend route files also contain some local types and helper functions. That is fine for a small take-home project, but if this app grew, I would move shared validation, data access, and route helper logic into separate folders so the route files stay easier to read.

On the frontend, most state is currently handled inside each page or component. That works for the current size of the app, but as more screens and workflows are added, I would consider using a state management library to make shared product, category, loading, and error state easier to manage.

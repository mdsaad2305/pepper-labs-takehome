import { Router } from "express";
import db from "../db.js";
import { HttpError } from "../errors.js";

const router = Router();

/**
 * GET /api/variants/:id
 * Get a single variant.
 */
router.get("/:id", (req, res) => {
  const variant = db
    .prepare("SELECT * FROM variants WHERE id = ?")
    .get(Number(req.params.id));

  if (!variant) {
    throw new HttpError(404, "Variant not found");
  }

  res.json(variant);
});

/**
 * PUT /api/variants/:id
 * Update a variant's price and/or inventory.
 *
 * Expected body (all fields optional):
 * {
 *   "name": "Updated Name",
 *   "sku": "NEW-SKU",
 *   "price_cents": 1999,
 *   "inventory_count": 50
 * }
 */
router.put("/:id", (_req, res) => {
  // TODO: Implement variant update
  // 1. Validate that the variant exists
  // 2. Validate: price_cents >= 0, inventory_count >= 0, sku is unique (if changed)
  // 3. Update the variant in the database
  // 4. Return the updated variant
  res.status(501).json({ error: "Not implemented" });
});

/**
 * DELETE /api/variants/:id
 * Delete a variant permanently.
 */
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);

  const variant = db
    .prepare("SELECT * FROM variants WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;

  if (!variant) {
    throw new HttpError(404, "Variant not found");
  }

  // Prevent deleting the last variant of a product
  const siblingCount = db
    .prepare(
      "SELECT COUNT(*) AS count FROM variants WHERE product_id = ?"
    )
    .get(variant.product_id as number) as { count: number };

  if (siblingCount.count <= 1) {
    return res
      .status(400)
      .json({ error: "Cannot delete the last variant of a product" });
  }

  db.prepare("DELETE FROM variants WHERE id = ?").run(id);
  res.json({ success: true });
});

export default router;

import { Router } from "express";
import db from "../db.js";
import { HttpError } from "../errors.js";

const router = Router();

type VariantRow = {
  id: number;
  product_id: number;
  sku: string;
  name: string;
  price_cents: number;
  inventory_count: number;
  created_at: string;
  updated_at: string;
};

function readVariant(id: number) {
  return db
    .prepare("SELECT * FROM variants WHERE id = ?")
    .get(id) as VariantRow | undefined;
}

function requireRequestBody(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "Variant request body is required");
  }

  return value as Record<string, unknown>;
}

function validateOptionalNonNegativeNumber(
  value: unknown,
  currentValue: number,
  fieldName: string
) {
  if (value === undefined) {
    return currentValue;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new HttpError(400, `${fieldName} must be a non-negative number`);
  }

  return value;
}

/**
 * GET /api/variants/:id
 * Get a single variant.
 */
router.get("/:id", (req, res) => {
  const variant = readVariant(Number(req.params.id));

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
 *   "price_cents": 1999,
 *   "inventory_count": 50
 * }
 */
router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = readVariant(id);

  if (!existing) {
    throw new HttpError(404, "Variant not found");
  }

  const body = requireRequestBody(req.body);
  const priceCents = validateOptionalNonNegativeNumber(
    body.price_cents,
    existing.price_cents,
    "price_cents"
  );
  const inventoryCount = validateOptionalNonNegativeNumber(
    body.inventory_count,
    existing.inventory_count,
    "inventory_count"
  );

  db.prepare(
    `UPDATE variants
     SET price_cents = ?,
         inventory_count = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(priceCents, inventoryCount, id);

  res.json(readVariant(id));
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

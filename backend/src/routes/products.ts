import { Router } from "express";
import db from "../db.js";
import { HttpError } from "../errors.js";

const router = Router();

type VariantInput = {
  sku: string;
  name: string;
  price_cents: number;
  inventory_count: number;
};

type ProductInput = {
  name: string;
  description: string | null;
  category_id: unknown;
  status: unknown;
  variants: VariantInput[];
};

function requireNonEmptyString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${fieldName} is required`);
  }

  return value.trim();
}

function requireNonNegativeNumber(value: unknown, fieldName: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new HttpError(400, `${fieldName} must be a non-negative number`);
  }

  return value;
}

function readProductWithVariants(id: number) {
  const product = db
    .prepare(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;

  if (!product) {
    return undefined;
  }

  const variants = db
    .prepare(
      `SELECT * FROM variants WHERE product_id = ? ORDER BY created_at ASC`
    )
    .all(id);

  return { ...product, variants };
}

function validateVariants(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpError(400, "At least one variant is required");
  }

  const skus = new Set<string>();

  return value.map((variant) => {
    if (typeof variant !== "object" || variant === null || Array.isArray(variant)) {
      throw new HttpError(400, "Variant must be an object");
    }

    const variantData = variant as Record<string, unknown>;
    const sku = requireNonEmptyString(variantData.sku, "Variant SKU");

    if (skus.has(sku)) {
      throw new HttpError(400, "Variant SKU must be unique");
    }
    skus.add(sku);

    const existingSku = db
      .prepare("SELECT id FROM variants WHERE sku = ?")
      .get(sku);

    if (existingSku) {
      throw new HttpError(400, "Variant SKU must be unique");
    }

    return {
      sku,
      name: requireNonEmptyString(variantData.name, "Variant name"),
      price_cents: requireNonNegativeNumber(
        variantData.price_cents,
        "Variant price_cents"
      ),
      inventory_count: requireNonNegativeNumber(
        variantData.inventory_count,
        "Variant inventory_count"
      ),
    };
  });
}

function validateProductBody(body: unknown): ProductInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "Product request body is required");
  }

  const productData = body as Record<string, unknown>;

  return {
    name: requireNonEmptyString(productData.name, "Product name"),
    description:
      typeof productData.description === "string"
        ? productData.description
        : null,
    category_id: productData.category_id ?? null,
    status: productData.status ?? "active",
    variants: validateVariants(productData.variants),
  };
}

/**
 * GET /api/products
 * List all products with category name, variant count, and price/inventory aggregates.
 * Supports optional query params: ?search=term&category_id=1
 */
router.get("/", (req, res) => {
  const { search, category_id } = req.query;

  let query = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.category_id,
        c.name AS category_name,
        p.status,
        p.deleted_at,
        p.created_at,
        p.updated_at,
        COUNT(v.id) AS variant_count,
        MIN(v.price_cents) AS min_price_cents,
        MAX(v.price_cents) AS max_price_cents,
        COALESCE(SUM(v.inventory_count), 0) AS total_inventory
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN variants v ON v.product_id = p.id
    `;

  const conditions: string[] = ["p.deleted_at IS NULL"];
  const params: unknown[] = [];

  if (search) {
    conditions.push("(p.name LIKE ? OR p.description LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  if (category_id) {
    conditions.push("p.category_id = ?");
    params.push(Number(category_id));
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " GROUP BY p.id ORDER BY p.created_at DESC";

  const products = db.prepare(query).all(...params);
  res.json(products);
});

/**
 * GET /api/products/:id
 * Get a single product with its variants.
 */
router.get("/:id", (req, res) => {
  const product = readProductWithVariants(Number(req.params.id));

  if (!product) {
    throw new HttpError(404, "Product not found");
  }

  res.json(product);
});

/**
 * POST /api/products
 * Create a new product with at least one variant.
 *
 * Expected body:
 * {
 *   "name": "Product Name",
 *   "description": "Optional description",
 *   "category_id": 1,
 *   "status": "active",
 *   "variants": [
 *     { "sku": "SKU-001", "name": "Default", "price_cents": 999, "inventory_count": 10 }
 *   ]
 * }
 */
router.post("/", (req, res) => {
  const productInput = validateProductBody(req.body);

  const createProduct = db.transaction((input: ProductInput) => {
    const result = db
      .prepare(
        `INSERT INTO products (name, description, category_id, status)
         VALUES (?, ?, ?, ?)`
      )
      .run(input.name, input.description, input.category_id, input.status);

    const productId = Number(result.lastInsertRowid);
    const insertVariant = db.prepare(
      `INSERT INTO variants (product_id, sku, name, price_cents, inventory_count)
       VALUES (?, ?, ?, ?, ?)`
    );

    for (const variant of input.variants) {
      insertVariant.run(
        productId,
        variant.sku,
        variant.name,
        variant.price_cents,
        variant.inventory_count
      );
    }

    const product = readProductWithVariants(productId);

    if (!product) {
      throw new Error("Created product could not be read");
    }

    return product;
  });

  res.status(201).json(createProduct(productInput));
});

/**
 * PUT /api/products/:id
 * Update a product's basic information.
 */
router.put("/:id", (req, res) => {
  const { name, description, category_id, status } = req.body;
  const id = Number(req.params.id);

  const existing = db
    .prepare("SELECT * FROM products WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;

  if (!existing) {
    throw new HttpError(404, "Product not found");
  }

  db.prepare(
    `UPDATE products
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           category_id = COALESCE(?, category_id),
           status = COALESCE(?, status),
           updated_at = datetime('now')
       WHERE id = ?`
  ).run(name ?? null, description ?? null, category_id ?? null, status ?? null, id);

  const updated = db
    .prepare(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`
    )
    .get(id);

  res.json(updated);
});

/**
 * DELETE /api/products/:id
 * Soft-delete a product (sets deleted_at timestamp).
 */
router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);

  const product = db
    .prepare("SELECT * FROM products WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;

  if (!product) {
    throw new HttpError(404, "Product not found");
  }

  db.prepare(
    `UPDATE products SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
  ).run(id);

  res.json({ success: true });
});

export default router;

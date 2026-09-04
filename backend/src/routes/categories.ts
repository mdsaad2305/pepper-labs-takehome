import { Router } from "express";
import db from "../db.js";
import { HttpError } from "../errors.js";

const router = Router();

/**
 * GET /api/categories
 * List all categories with their active product count.
 */
router.get("/", (_req, res) => {
  const categories = db
    .prepare(
      `SELECT c.*, COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.deleted_at IS NULL
       GROUP BY c.id
       ORDER BY c.name ASC`
    )
    .all();

  res.json(categories);
});

/**
 * GET /api/categories/:id
 * Get a single category.
 */
router.get("/:id", (req, res) => {
  const category = db
    .prepare("SELECT * FROM categories WHERE id = ?")
    .get(Number(req.params.id));

  if (!category) {
    throw new HttpError(404, "Category not found");
  }

  res.json(category);
});

export default router;

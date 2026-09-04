import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  PackagePlus,
  Plus,
  Trash2,
} from "lucide-react";
import { createProduct, fetchCategories } from "@/lib/api";
import type { Category, Product } from "@/types";

type VariantFormRow = {
  id: number;
  sku: string;
  name: string;
  price: string;
  inventory: string;
};

type VariantErrors = Partial<
  Record<"sku" | "name" | "price" | "inventory", string>
>;

type FormErrors = {
  name?: string;
  variants: Record<number, VariantErrors>;
};

function createVariantRow(id: number): VariantFormRow {
  return {
    id,
    sku: "",
    name: "",
    price: "",
    inventory: "",
  };
}

function parseError(responseBody: unknown) {
  if (
    typeof responseBody === "object" &&
    responseBody !== null &&
    "error" in responseBody &&
    typeof responseBody.error === "string"
  ) {
    return responseBody.error;
  }

  return "Unable to create product";
}

function readJson(response: Response) {
  return response.json().catch(() => null) as Promise<unknown>;
}

export default function CreateProductPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<Product["status"]>("active");
  const [variants, setVariants] = useState<VariantFormRow[]>([
    createVariantRow(1),
  ]);
  const [nextVariantId, setNextVariantId] = useState(2);
  const [errors, setErrors] = useState<FormErrors>({ variants: {} });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCategories()
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load categories");
        }

        return (await response.json()) as Category[];
      })
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const updateVariant = (
    id: number,
    field: keyof Omit<VariantFormRow, "id">,
    value: string
  ) => {
    setVariants((current) =>
      current.map((variant) =>
        variant.id === id ? { ...variant, [field]: value } : variant
      )
    );
  };

  const addVariant = () => {
    setVariants((current) => [...current, createVariantRow(nextVariantId)]);
    setNextVariantId((current) => current + 1);
  };

  const removeVariant = (id: number) => {
    setVariants((current) =>
      current.length > 1
        ? current.filter((variant) => variant.id !== id)
        : current
    );
    setErrors((current) => {
      const nextVariantErrors = { ...current.variants };
      delete nextVariantErrors[id];
      return { ...current, variants: nextVariantErrors };
    });
  };

  const validate = () => {
    const nextErrors: FormErrors = { variants: {} };
    const seenSkus = new Set<string>();

    if (name.trim() === "") {
      nextErrors.name = "Product name is required";
    }

    for (const variant of variants) {
      const variantErrors: VariantErrors = {};
      const trimmedSku = variant.sku.trim();
      const parsedPrice = Number(variant.price);
      const parsedInventory = Number(variant.inventory);

      if (trimmedSku === "") {
        variantErrors.sku = "SKU is required";
      } else if (seenSkus.has(trimmedSku)) {
        variantErrors.sku = "SKU must be unique";
      } else {
        seenSkus.add(trimmedSku);
      }

      if (variant.name.trim() === "") {
        variantErrors.name = "Variant name is required";
      }

      if (
        variant.price.trim() === "" ||
        !Number.isFinite(parsedPrice) ||
        parsedPrice < 0
      ) {
        variantErrors.price = "Price must be 0 or greater";
      }

      if (
        variant.inventory.trim() === "" ||
        !Number.isFinite(parsedInventory) ||
        parsedInventory < 0
      ) {
        variantErrors.inventory = "Inventory must be 0 or greater";
      }

      if (Object.keys(variantErrors).length > 0) {
        nextErrors.variants[variant.id] = variantErrors;
      }
    }

    setErrors(nextErrors);
    return !nextErrors.name && Object.keys(nextErrors.variants).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    if (!validate()) {
      return;
    }

    setSaving(true);

    try {
      const response = await createProduct({
        name: name.trim(),
        description: description.trim() || null,
        category_id: categoryId ? Number(categoryId) : null,
        status,
        variants: variants.map((variant) => ({
          sku: variant.sku.trim(),
          name: variant.name.trim(),
          price_cents: Math.round(Number(variant.price) * 100),
          inventory_count: Number(variant.inventory),
        })),
      });

      const responseBody = await readJson(response);

      if (!response.ok) {
        setSubmitError(parseError(responseBody));
        setSaving(false);
        return;
      }

      const createdProduct = responseBody as { id: number };
      navigate(`/products/${createdProduct.id}`);
    } catch {
      setSubmitError("Unable to create product");
      setSaving(false);
    }
  };

  return (
    <div>
      <Link
        to="/products"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to products
      </Link>

      <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
        Create New Product
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {submitError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{submitError}</p>
          </div>
        )}

        <section className="rounded-lg border bg-card p-6 shadow-card">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Product details
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">
                Product name
              </label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">
                Description
              </label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Status
              </label>
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as Product["status"])
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-6 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">
              Variants
            </h2>
          </div>

          <div className="space-y-5">
            {variants.map((variant, index) => {
              const variantErrors = errors.variants[variant.id] ?? {};

              return (
                <div
                  key={variant.id}
                  className="rounded-md border border-input bg-background p-4"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">
                      Variant {index + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeVariant(variant.id)}
                      disabled={variants.length === 1}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Remove variant ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">
                        SKU
                      </label>
                      <input
                        type="text"
                        value={variant.sku}
                        onChange={(event) =>
                          updateVariant(variant.id, "sku", event.target.value)
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                      {variantErrors.sku && (
                        <p className="mt-1 text-sm text-destructive">
                          {variantErrors.sku}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium">
                        Variant name
                      </label>
                      <input
                        type="text"
                        value={variant.name}
                        onChange={(event) =>
                          updateVariant(variant.id, "name", event.target.value)
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                      {variantErrors.name && (
                        <p className="mt-1 text-sm text-destructive">
                          {variantErrors.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium">
                        Price
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={variant.price}
                        onChange={(event) =>
                          updateVariant(variant.id, "price", event.target.value)
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm tabular-nums ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                      {variantErrors.price && (
                        <p className="mt-1 text-sm text-destructive">
                          {variantErrors.price}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium">
                        Inventory
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={variant.inventory}
                        onChange={(event) =>
                          updateVariant(
                            variant.id,
                            "inventory",
                            event.target.value
                          )
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm tabular-nums ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                      {variantErrors.inventory && (
                        <p className="mt-1 text-sm text-destructive">
                          {variantErrors.inventory}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addVariant}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-black shadow-sm transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Add Variant
            </button>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <Link
            to="/products"
            className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-[#2E3330] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#3a3f3c] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Product
          </button>
        </div>
      </form>
    </div>
  );
}

import { useState } from "react";
import { Check, X } from "lucide-react";
import { updateVariant } from "@/lib/api";
import type { Variant } from "@/types";

type VariantFormErrors = {
  price?: string;
  inventory?: string;
};

type VariantEditModalProps = {
  variant: Variant;
  onClose: () => void;
  onVariantUpdated: (variant: Variant) => void;
};

function readJson(response: Response) {
  return response.json().catch(() => null) as Promise<unknown>;
}

function parseError(responseBody: unknown, fallback: string) {
  if (
    typeof responseBody === "object" &&
    responseBody !== null &&
    "error" in responseBody &&
    typeof responseBody.error === "string"
  ) {
    return responseBody.error;
  }

  return fallback;
}

function centsToDollars(cents: number) {
  return (cents / 100).toFixed(2);
}

export function VariantEditModal({
  variant,
  onClose,
  onVariantUpdated,
}: VariantEditModalProps) {
  const [price, setPrice] = useState(centsToDollars(variant.price_cents));
  const [inventory, setInventory] = useState(String(variant.inventory_count));
  const [errors, setErrors] = useState<VariantFormErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const nextErrors: VariantFormErrors = {};
    const parsedPrice = Number(price);
    const parsedInventory = Number(inventory);

    if (
      price.trim() === "" ||
      !Number.isFinite(parsedPrice) ||
      parsedPrice < 0
    ) {
      nextErrors.price = "Price must be 0 or greater";
    }

    if (
      inventory.trim() === "" ||
      !Number.isFinite(parsedInventory) ||
      parsedInventory < 0
    ) {
      nextErrors.inventory = "Inventory must be 0 or greater";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    setSaveError(null);

    if (!validate()) {
      return;
    }

    setSaving(true);

    try {
      const response = await updateVariant(variant.id, {
        price_cents: Math.round(Number(price) * 100),
        inventory_count: Number(inventory),
      });
      const responseBody = await readJson(response);

      if (!response.ok) {
        setSaveError(parseError(responseBody, "Unable to update variant"));
        setSaving(false);
        return;
      }

      onVariantUpdated(responseBody as Variant);
      onClose();
    } catch {
      setSaveError("Unable to update variant");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="variant-edit-title"
    >
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-card">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2
              id="variant-edit-title"
              className="text-lg font-semibold text-foreground"
            >
              Edit Variant
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {variant.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close variant edit dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {saveError && (
          <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {saveError}
          </p>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">SKU</label>
            <input
              type="text"
              value={variant.sku}
              readOnly
              className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 font-mono text-sm text-muted-foreground"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Variant name
            </label>
            <input
              type="text"
              value={variant.name}
              readOnly
              className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              disabled={saving}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm tabular-nums ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            />
            {errors.price && (
              <p className="mt-1 text-sm text-destructive">{errors.price}</p>
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
              value={inventory}
              onChange={(event) => setInventory(event.target.value)}
              disabled={saving}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm tabular-nums ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            />
            {errors.inventory && (
              <p className="mt-1 text-sm text-destructive">
                {errors.inventory}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-[#2E3330] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#3a3f3c] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Check className="h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

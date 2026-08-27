import type { Translator } from "@/lib/i18n/messages";

const INVENTORY_CATEGORY_LABEL_KEYS: Record<
  string,
  Parameters<Translator>[0]
> = {
  food: "inventory.food",
  medication: "inventory.medication",
  preventive: "inventory.preventive",
  supplement: "inventory.supplement",
  supply: "inventory.supply",
};

/** Localizes known inventory categories without changing persisted values. */
export function getInventoryCategoryLabel(
  category: string | null | undefined,
  t: Translator,
): string {
  if (!category) return "—";

  const key = INVENTORY_CATEGORY_LABEL_KEYS[category.trim().toLowerCase()];
  return key ? t(key) : category;
}

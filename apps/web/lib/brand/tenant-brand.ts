import { platformBrand } from "@/lib/brand/platform-brand";

export type TenantBrandInput = {
  name?: string | null;
  logoUrl?: string | null;
  brandColor?: string | null;
};

/** Resolves visual priority without changing tenant records. */
export function resolveTenantBrand(tenant?: TenantBrandInput | null) {
  const name = tenant?.name?.trim();
  const logoUrl = tenant?.logoUrl?.trim();

  return {
    name: name || platformBrand.productName,
    logoUrl: logoUrl || null,
    brandColor: tenant?.brandColor?.trim() || null,
    isTenantBranded: Boolean(name || logoUrl),
    platformName: platformBrand.displayName,
  };
}

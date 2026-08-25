import { describe, expect, it } from "vitest";
import { platformBrand } from "../brand/platform-brand";
import { resolveTenantBrand } from "../brand/tenant-brand";

describe("Doctor Pet branding foundation", () => {
  it("defines the approved commercial identity and official asset paths", () => {
    expect(platformBrand.productName).toBe("Doctor Pet");
    expect(platformBrand.companyName).toBe("ResilIA");
    expect(platformBrand.displayName).toBe("Doctor Pet by ResilIA");
    expect(platformBrand.tagline).toBe("Llegá más lejos.");
    expect(platformBrand.assets.mark).toBe("/brand/doctor-pet-mark.png");
  });

  it("preserves tenant identity before platform fallback", () => {
    expect(
      resolveTenantBrand({
        name: "Agroveterinaria Dr. Cubillo",
        logoUrl: "https://example.test/clinic-logo.png",
        brandColor: "#123456",
      }),
    ).toMatchObject({
      name: "Agroveterinaria Dr. Cubillo",
      logoUrl: "https://example.test/clinic-logo.png",
      brandColor: "#123456",
      isTenantBranded: true,
    });
    expect(resolveTenantBrand()).toMatchObject({
      name: "Doctor Pet",
      logoUrl: null,
      isTenantBranded: false,
    });
  });
});

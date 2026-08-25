/** Commercial platform identity. Tenant identity stays in practice data. */
export const platformBrand = {
  productName: "Doctor Pet",
  companyName: "ResilIA",
  displayName: "Doctor Pet by ResilIA",
  tagline: "Llegá más lejos.",
  sourceProject: "OpenVPM",
  license: "AGPL-3.0",
  sourceUrl: "https://github.com/rayalah/doctorpet-openvpm",
  upstreamUrl: "https://github.com/evangauer/openvpm",
  licenseUrl: "https://www.gnu.org/licenses/agpl-3.0.html",
  assets: {
    horizontalLogo: "/brand/doctor-pet-logo-horizontal.png",
    verticalLogo: "/brand/doctor-pet-logo-vertical.png",
    mark: "/brand/doctor-pet-mark.png",
  },
} as const;

export type PlatformBrand = typeof platformBrand;

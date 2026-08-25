import { describe, expect, it } from "vitest";
import {
  regulatoryCapabilitiesForProfile,
  supportsRegulatoryCapability,
} from "../regulatory-capabilities";

describe("regulatory capabilities", () => {
  it("keeps CR_NEUTRAL and UNSPECIFIED neutral", () => {
    for (const profile of ["CR_NEUTRAL", "UNSPECIFIED"] as const) {
      expect(regulatoryCapabilitiesForProfile(profile)).toEqual({
        supportsDeaFeatures: false,
        supportsVmdFeatures: false,
        supportsControlledDrugCompliance: false,
      });
      expect(supportsRegulatoryCapability(profile, "US_DEA")).toBe(false);
      expect(supportsRegulatoryCapability(profile, "UK_VMD")).toBe(false);
    }
  });

  it("keeps the explicit US and UK profiles isolated", () => {
    expect(supportsRegulatoryCapability("US_DEA", "US_DEA")).toBe(true);
    expect(supportsRegulatoryCapability("US_DEA", "UK_VMD")).toBe(false);
    expect(supportsRegulatoryCapability("UK_VMD", "UK_VMD")).toBe(true);
    expect(supportsRegulatoryCapability("UK_VMD", "US_DEA")).toBe(false);
  });

  it("shows shared controlled-drug notices only for explicit foreign profiles", () => {
    expect(
      supportsRegulatoryCapability("US_DEA", "CONTROLLED_DRUG_COMPLIANCE"),
    ).toBe(true);
    expect(
      supportsRegulatoryCapability("UK_VMD", "CONTROLLED_DRUG_COMPLIANCE"),
    ).toBe(true);
    expect(
      supportsRegulatoryCapability("CR_NEUTRAL", "CONTROLLED_DRUG_COMPLIANCE"),
    ).toBe(false);
  });
});

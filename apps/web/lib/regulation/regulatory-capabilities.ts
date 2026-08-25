import type { RegulatoryProfile } from "@/lib/locale/regional-profile";

export const REGULATORY_CAPABILITIES = [
  "US_DEA",
  "UK_VMD",
  "CONTROLLED_DRUG_COMPLIANCE",
] as const;

export type RegulatoryCapability = (typeof REGULATORY_CAPABILITIES)[number];

export interface RegulatoryCapabilities {
  supportsDeaFeatures: boolean;
  supportsVmdFeatures: boolean;
  supportsControlledDrugCompliance: boolean;
}

const NEUTRAL_CAPABILITIES: RegulatoryCapabilities = {
  supportsDeaFeatures: false,
  supportsVmdFeatures: false,
  supportsControlledDrugCompliance: false,
};

export function regulatoryCapabilitiesForProfile(
  profile: RegulatoryProfile,
): RegulatoryCapabilities {
  switch (profile) {
    case "US_DEA":
      return {
        supportsDeaFeatures: true,
        supportsVmdFeatures: false,
        supportsControlledDrugCompliance: true,
      };
    case "UK_VMD":
      return {
        supportsDeaFeatures: false,
        supportsVmdFeatures: true,
        supportsControlledDrugCompliance: true,
      };
    case "CR_NEUTRAL":
    case "UNSPECIFIED":
      return { ...NEUTRAL_CAPABILITIES };
  }
}

export function supportsRegulatoryCapability(
  profile: RegulatoryProfile,
  capability: RegulatoryCapability,
): boolean {
  const capabilities = regulatoryCapabilitiesForProfile(profile);
  switch (capability) {
    case "US_DEA":
      return capabilities.supportsDeaFeatures;
    case "UK_VMD":
      return capabilities.supportsVmdFeatures;
    case "CONTROLLED_DRUG_COMPLIANCE":
      return capabilities.supportsControlledDrugCompliance;
  }
}

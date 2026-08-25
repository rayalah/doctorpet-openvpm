import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const controlledPage = readFileSync(
  "app/(dashboard)/controlled-substances/page.tsx",
  "utf8",
);
const sidebar = readFileSync("components/layout/sidebar.tsx", "utf8");
const topBar = readFileSync("components/layout/top-bar.tsx", "utf8");
const recordsPage = readFileSync("app/(dashboard)/records/page.tsx", "utf8");
const prescriptionLifecycle = readFileSync(
  "components/records/prescription-lifecycle-control.tsx",
  "utf8",
);
const recordsRouter = readFileSync("server/routers/records.ts", "utf8");

describe("CR neutral regulatory UI", () => {
  it("hides the DEA navigation item unless the tenant capability enables it", () => {
    expect(sidebar).toContain('regulatoryCapability: "US_DEA"');
    expect(sidebar).toContain("trpc.controlledSubstances.access.useQuery");
    expect(sidebar).toContain("regulatoryAccess?.supportsDeaFeatures === true");
    expect(topBar).toContain('basePath === "/controlled-substances" &&');
    expect(topBar).toContain(
      "regulatoryAccess?.supportsDeaFeatures !== true",
    );
  });

  it("gates a direct DEA route before rendering the operational module", () => {
    expect(controlledPage).toContain(
      "trpc.controlledSubstances.access.useQuery",
    );
    expect(controlledPage).toContain(
      "accessQuery.data.supportsDeaFeatures !== true",
    );
    expect(controlledPage).toContain('router.replace("/")');
    expect(controlledPage.indexOf("supportsDeaFeatures !== true")).toBeLessThan(
      controlledPage.indexOf("return <ControlledSubstancesLogPage />"),
    );
  });

  it("keeps general prescriptions available and gates only foreign compliance notices", () => {
    expect(recordsPage).toContain("createPrescription");
    expect(recordsRouter).toContain("createPrescription: protectedProcedure");
    expect(recordsRouter).not.toContain("assertPracticeRegulatoryCapability");
    expect(recordsPage).toContain(
      "regulatoryAccess?.supportsControlledDrugCompliance === true",
    );
    expect(recordsPage).toContain("{showControlledDrugComplianceNotice ? (");
    expect(prescriptionLifecycle).toContain(
      "showControlledDrugComplianceNotice ? (",
    );
  });

  it("does not use country checks to decide the modified regulatory surfaces", () => {
    for (const source of [controlledPage, sidebar, topBar, recordsPage]) {
      expect(source).not.toMatch(/country\s*[!=]==?\s*["'](?:CR|US|GB)["']/);
    }
  });
});

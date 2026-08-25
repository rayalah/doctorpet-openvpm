import { describe, expect, it } from "vitest";
import {
  PRACTICE_CURRENCY_OPTIONS,
  PRACTICE_TIMEZONES,
} from "../practice-region-options";

describe("active practice region options", () => {
  it("exposes Costa Rica timezone and CRC from the regional catalog", () => {
    expect(PRACTICE_TIMEZONES).toContain("America/Costa_Rica");
    expect(PRACTICE_TIMEZONES).toContain("America/Chicago");
    expect(PRACTICE_CURRENCY_OPTIONS).toContainEqual({
      code: "crc",
      label: "CRC — Colón costarricense",
    });
  });
});

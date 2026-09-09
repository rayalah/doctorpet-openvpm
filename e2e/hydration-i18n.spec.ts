import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop Chromium", width: 1440, height: 900 },
  { name: "tablet viewport", width: 834, height: 1112 },
  { name: "mobile viewport", width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test(`keeps the login React tree hydration-safe on ${viewport.name}`, async ({
    page,
  }) => {
    const reactFailures: string[] = [];

    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /hydration|insertBefore|removeChild|Minified React error #418/i.test(
          message.text(),
        )
      ) {
        reactFailures.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      if (/hydration|insertBefore|removeChild|Minified React error #418/i.test(error.message)) {
        reactFailures.push(error.message);
      }
    });

    await page.setViewportSize(viewport);
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("lang", /^(es|en)$/);
    await expect(page.locator("html")).toHaveAttribute("translate", "no");
    await expect(page.getByRole("textbox")).toBeVisible();
    await expect.poll(() => reactFailures).toEqual([]);
  });
}

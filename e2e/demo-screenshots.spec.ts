import { test, expect } from "@playwright/test";
import path from "path";

const BASE = process.env.DEMO_URL ?? "https://demo.doctorpetapp.com";
const OUT = path.resolve(__dirname, "../docs/screenshots");

test.use({
  baseURL: BASE,
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});

test.describe.configure({ mode: "serial" });

test.describe("Demo screenshots + audit", () => {
  test("capture dashboard / schedule / patient", async ({ page }) => {
    test.setTimeout(120_000);

    // Login
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.fill("#email", "admin@neighborhoodvet.example.com");
    await page.fill("#password", "password123");
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 }),
      page.click('button[type="submit"]'),
    ]);

    // Dashboard
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, "dashboard.png"), fullPage: false });

    // Schedule
    await page.goto("/schedule", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, "schedule.png"), fullPage: false });

    // Patient detail — click the first row in the patients list (rows use onClick not Link)
    await page.goto("/patients", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const firstRow = page.locator("table tbody tr").first();
    if (await firstRow.count() > 0) {
      await firstRow.click();
      await page.waitForURL(/\/patients\/[a-f0-9-]{8,}/, { timeout: 15_000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(OUT, "patient.png"), fullPage: false });
    }
  });

  test("audit each sidebar route for errors", async ({ page }) => {
    test.setTimeout(180_000);
    const errors: { route: string; msg: string }[] = [];
    page.on("pageerror", (err) => errors.push({ route: page.url(), msg: err.message }));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Filter out dev-noise
        if (!text.includes("Download the React DevTools") && !text.includes("Content-Security-Policy")) {
          errors.push({ route: page.url(), msg: text.slice(0, 200) });
        }
      }
    });
    const AUDIT_OUT = path.resolve(__dirname, "../docs/screenshots/audit");
    const fs = await import("fs");
    fs.mkdirSync(AUDIT_OUT, { recursive: true });

    // Login
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.fill("#email", "admin@neighborhoodvet.example.com");
    await page.fill("#password", "password123");
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 }),
      page.click('button[type="submit"]'),
    ]);

    const routes = [
      "/",
      "/patients",
      "/clients",
      "/schedule",
      "/records",
      "/billing",
      "/inventory",
      "/inbox",
      "/whiteboard",
      "/controlled-substances",
      "/reports",
      "/settings",
    ];

    const results: string[] = [];
    for (const route of routes) {
      const startErrors = errors.length;
      const response = await page.goto(route, { waitUntil: "networkidle", timeout: 20_000 }).catch((e) => {
        errors.push({ route, msg: `navigation error: ${e.message}` });
        return null;
      });
      await page.waitForTimeout(1500);
      const status = response?.status() ?? "nav-failed";
      // capture body text content length as a rough "empty state?" signal
      const bodyText = await page.locator("main, [role=main], body").first().textContent().catch(() => "");
      const fileSafe = route.replace(/\//g, "_") || "_root";
      await page.screenshot({ path: path.join(AUDIT_OUT, `${fileSafe}.png`) }).catch(() => {});
      const emptyStateWords = ["No upcoming", "No data", "No records", "No messages", "No patients found", "No clients", "No results"];
      const emptyHits = emptyStateWords.filter((w) => (bodyText ?? "").includes(w));
      const newErrors = errors.length - startErrors;
      results.push(
        `${route}: HTTP ${status}` +
          (newErrors > 0 ? ` ⚠️ ${newErrors} error(s)` : "") +
          (emptyHits.length > 0 ? ` · empty: ${emptyHits.join(", ")}` : "")
      );
    }

    console.log("\n=== Route audit ===");
    for (const line of results) console.log(line);
    if (errors.length > 0) {
      console.log("\n=== Errors ===");
      for (const e of errors) console.log(`  [${e.route}] ${e.msg}`);
    } else {
      console.log("\nNo errors detected.");
    }
    expect(errors.length).toBeLessThan(99); // soft — we want to see the report
  });
});

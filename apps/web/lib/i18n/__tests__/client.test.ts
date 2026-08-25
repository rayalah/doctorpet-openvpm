import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider, useTranslations } from "../client";

function TranslationProbe() {
  const t = useTranslations();

  return createElement("span", null, t("auth.login.submit"));
}

describe("i18n client entry point", () => {
  it("provides translated copy to client components", () => {
    const output = renderToStaticMarkup(
      createElement(
        I18nProvider,
        { language: "es", children: createElement(TranslationProbe) },
      ),
    );

    expect(output).toContain("Iniciar sesión");
  });

  it("uses the platform fallback when no client language is supplied", () => {
    const output = renderToStaticMarkup(
      createElement(I18nProvider, {
        children: createElement(TranslationProbe),
      }),
    );

    expect(output).toContain("Sign in");
  });
});

import { platformBrand } from "@/lib/brand/platform-brand";

export const metadata = {
  title: `Open source | ${platformBrand.productName}`,
  description: "Open-source and license information for Doctor Pet by ResilIA.",
};

export default function OpenSourcePage() {
  return (
    <>
      <h1>Open-source software</h1>
      <p>
        {platformBrand.displayName} is a product of {platformBrand.companyName}
        {" "}based on {platformBrand.sourceProject}, and is distributed under
        the GNU Affero General Public License, version 3.
      </p>

      <h2>Source code</h2>
      <p>
        The corresponding source code for this product is available at{" "}
        <a href={platformBrand.sourceUrl}>{platformBrand.sourceUrl}</a>. The
        upstream {platformBrand.sourceProject} project is available at{" "}
        <a href={platformBrand.upstreamUrl}>{platformBrand.upstreamUrl}</a>.
      </p>

      <h2>License and attribution</h2>
      <p>
        Doctor Pet by ResilIA preserves the applicable {platformBrand.sourceProject}
        {" "}attribution and the {platformBrand.license} license terms. Read the
        full license at <a href={platformBrand.licenseUrl}>GNU AGPLv3</a>.
      </p>

      <p>This page provides software-license information only; it is not legal advice.</p>
    </>
  );
}

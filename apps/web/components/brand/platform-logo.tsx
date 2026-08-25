import { platformBrand } from "@/lib/brand/platform-brand";

type PlatformLogoProps = {
  variant?: "horizontal" | "vertical" | "mark";
  className?: string;
  alt?: string;
};

export function PlatformLogo({
  variant = "horizontal",
  className,
  alt = platformBrand.displayName,
}: PlatformLogoProps) {
  const src =
    variant === "vertical"
      ? platformBrand.assets.verticalLogo
      : variant === "mark"
        ? platformBrand.assets.mark
        : platformBrand.assets.horizontalLogo;

  // Official assets are rendered at their original ratio.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
}

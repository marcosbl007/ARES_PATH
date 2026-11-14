import Image from "next/image";

type BrandLoadingScreenProps = {
  visible: boolean;
};

export function BrandLoadingScreen({ visible }: BrandLoadingScreenProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="brand-loader" role="status" aria-live="polite" aria-label="Loading ARES PATH">
      <div className="brand-loader__content">
        <div className="brand-loader__logo-shell">
          <Image
            src="/brand/ares-path-logo.png"
            alt="ARES PATH startup logo"
            width={480}
            height={320}
            priority
            className="brand-loader__logo"
          />
        </div>
        <p className="brand-loader__eyebrow">ARES PATH / FOUNDATION</p>
        <p className="brand-loader__status">INITIALIZING MISSION WORKSPACE</p>
        <div className="brand-loader__progress" aria-hidden="true">
          <span />
        </div>
        <p className="brand-loader__meta">PROTOTYPE / NOT OPERATIONAL</p>
      </div>
    </div>
  );
}

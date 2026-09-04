import { SettingsNav } from "@/components/layout/settings-nav";

// No top-level "Ayarlar" heading here — the breadcrumb already shows
// "Ayarlar / <section>" and every settings sub-page renders its own single
// PageHeader (via ModulePlaceholder), matching the one-heading-per-page rule
// every other module follows.
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-8">
      <SettingsNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

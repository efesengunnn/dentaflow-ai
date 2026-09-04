import { LayoutDashboard } from "lucide-react";

import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function DashboardPage() {
  return (
    <ModulePlaceholder
      title="Panel"
      description="Klinik özeti, günlük randevular ve bekleyen işler."
      icon={LayoutDashboard}
      emptyTitle="Panel henüz hazır değil"
      emptyDescription="Tedavi ve randevu modülleri tamamlandığında bu ekran klinik özetini gösterecek."
    />
  );
}

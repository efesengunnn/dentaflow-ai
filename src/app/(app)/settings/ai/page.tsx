import { Sparkles } from "lucide-react";

import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function AISettingsPage() {
  return (
    <ModulePlaceholder
      icon={Sparkles}
      title="Yapay Zeka"
      description="AI Assistant davranışlarını ve tercihlerini yönetin."
      emptyTitle="Yapay zeka ayarları henüz aktif değil"
      emptyDescription="Yapay zeka destekli öneriler ve otomasyonlar yakında buradan yönetilebilecek."
    />
  );
}

import { Plug } from "lucide-react";

import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function IntegrationsSettingsPage() {
  return (
    <ModulePlaceholder
      icon={Plug}
      title="Entegrasyonlar"
      description="WhatsApp, e-posta ve diğer harici bağlantıları yönetin."
      emptyTitle="Entegrasyonlar henüz aktif değil"
      emptyDescription="WhatsApp, SMS ve diğer entegrasyonlar yakında buradan yönetilebilecek."
    />
  );
}

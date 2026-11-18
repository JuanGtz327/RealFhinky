import { PreferencesForm } from "@/components/settings/PreferencesForm";
import { ExportImportSection } from "@/components/settings/ExportImportSection";
import { DangerZone } from "@/components/settings/DangerZone";
import { PageHeader } from "@/components/ui/page-header";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Preferencias" title="Configuración" />

      <PreferencesForm />
      <ExportImportSection />
      <DangerZone />
    </div>
  );
}

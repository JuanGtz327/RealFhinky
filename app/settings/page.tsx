import { FadeIn } from "@/components/ui/animated";
import { PreferencesForm } from "@/components/settings/PreferencesForm";
import { ExportImportSection } from "@/components/settings/ExportImportSection";
import { DangerZone } from "@/components/settings/DangerZone";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <FadeIn>
        <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">
          Configuración
        </h1>
      </FadeIn>

      <PreferencesForm />
      <ExportImportSection />
      <DangerZone />
    </div>
  );
}

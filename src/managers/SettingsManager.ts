import { StorageService } from "@/storage/StorageService";
import { type BusinessSettings, type UUID } from "@/types/business";
import { settingsSchema } from "@/types/business";

function nowISO() { return new Date().toISOString(); }
function uuid(): UUID { return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as UUID; }

export class SettingsManager {
  constructor(private storage: StorageService) {}

  async get(id: UUID) {
    return this.storage.findById<BusinessSettings>("business_settings", id);
  }

  async upsert(input: Omit<BusinessSettings, "created_at" | "updated_at">) {
    const existing = await this.get(input.id);
    const base = existing.success && existing.data ? existing.data : ({
      id: input.id ?? uuid(),
      created_at: nowISO(),
    } as Partial<BusinessSettings>);

    const settings: BusinessSettings = {
      id: (base.id as UUID) ?? input.id,
      business_name: input.business_name,
      default_currency: input.default_currency,
      timezone: input.timezone,
      backup: input.backup,
      reversal_window_hours: input.reversal_window_hours || 24,
      created_at: (base.created_at as string) ?? nowISO(),
      updated_at: nowISO(),
    };

    const parse = settingsSchema.safeParse(settings);
    if (!parse.success) return { success: false, error: parse.error.message } as const;

    return this.storage.save<BusinessSettings>("business_settings", settings);
  }

  async setBackupPreferences(id: UUID, backup: BusinessSettings["backup"]) {
    const existing = await this.get(id);
    if (!existing.success || !existing.data) return { success: false, error: "Settings not found" } as const;
    existing.data.backup = backup;
    existing.data.updated_at = nowISO();
    return this.storage.save<BusinessSettings>("business_settings", existing.data);
  }
}

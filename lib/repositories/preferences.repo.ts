import { IDatabase } from "@/lib/db/adapter";

export const DEFAULT_PREFERENCES: Record<string, string> = {
  currency_locale: "es-MX",
  currency_code: "MXN",
  date_locale: "es-MX",
  theme: "light",
};

export class PreferencesRepository {
  constructor(private db: IDatabase) {}

  getAll(): Record<string, string> {
    const rows = this.db.query<{ key: string; value: string }>(
      "SELECT key, value FROM user_preferences"
    );
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  getWithDefaults(): Record<string, string> {
    return { ...DEFAULT_PREFERENCES, ...this.getAll() };
  }

  get(key: string): string | null {
    const rows = this.db.query<{ value: string }>(
      "SELECT value FROM user_preferences WHERE key = ?",
      [key]
    );
    return rows[0]?.value ?? null;
  }

  set(key: string, value: string): void {
    this.db.execute(
      "INSERT OR REPLACE INTO user_preferences (key, value) VALUES (?, ?)",
      [key, value]
    );
  }

  setMany(entries: Record<string, string>): void {
    this.db.transaction(() => {
      for (const [key, value] of Object.entries(entries)) {
        this.set(key, value);
      }
    });
  }

  clear(): void {
    this.db.execute("DELETE FROM user_preferences");
  }
}

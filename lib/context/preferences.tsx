"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface PreferencesContextValue {
  preferences: Record<string, string>;
  updatePreferences: (updates: Record<string, string>) => Promise<void>;
  isLoading: boolean;
}

const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: {},
  updatePreferences: async () => {},
  isLoading: true,
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/preferences")
      .then((r) => r.json())
      .then((d) => setPreferences(d.preferences))
      .finally(() => setIsLoading(false));
  }, []);

  const updatePreferences = useCallback(async (updates: Record<string, string>) => {
    const res = await fetch("/api/settings/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const data = await res.json();
      setPreferences(data.preferences);
    }
  }, []);

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreferences, isLoading }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}

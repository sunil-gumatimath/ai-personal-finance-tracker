import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  type Preferences,
  PREFERENCES_KEY,
  defaultPreferences,
  currencySymbols,
  currencyLocales,
} from "@/types/preferences";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api-client";
import { normalizePreferences } from "@/lib/preferences-storage";
import type { ProviderApiKeyUpdate } from "@/types/api";

interface PreferencesContextType {
  preferences: Preferences;
  setPreferences: React.Dispatch<React.SetStateAction<Preferences>>;
  savePreferences: (
    newPreferences: Partial<Preferences>,
    apiKeys?: ProviderApiKeyUpdate,
  ) => Promise<void>;
  formatCurrency: (amount: number) => string;
  getCurrencySymbol: () => string;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(
  undefined,
);

const loadInitialPreferences = (): Preferences => {
  try {
    const saved = localStorage.getItem(PREFERENCES_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const normalized = normalizePreferences(parsed);
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(normalized));
      return normalized;
    }
  } catch {
    // Failed to parse preferences, using defaults
  }
  return defaultPreferences;
};

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<Preferences>(
    loadInitialPreferences,
  );

  // Sync from Database on Load
  useEffect(() => {
    const fetchPreferences = async () => {
      if (!user) {
        localStorage.removeItem(PREFERENCES_KEY);
        setPreferences(defaultPreferences);
        return;
      }
      try {
        const res = await api.profile.get();
        const dbPrefs = normalizePreferences(res.preferences);
        if (res.currency && res.currency !== dbPrefs.currency) {
          dbPrefs.currency = res.currency;
        }
        const merged = normalizePreferences(dbPrefs);
        setPreferences(merged);
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(merged));
      } catch (error) {
        console.error("Failed to fetch preferences:", error);
      }
    };
    fetchPreferences();
  }, [user]);

  // Sync preferences across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === PREFERENCES_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setPreferences(normalizePreferences(parsed));
        } catch {
          // Ignore parse errors
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Save preferences to localStorage and Database
  const savePreferences = useCallback(
    async (
      newPreferences: Partial<Preferences>,
      apiKeys?: ProviderApiKeyUpdate,
    ) => {
      const currentState = normalizePreferences({ ...preferences, ...newPreferences });
      setPreferences((prev) => {
        const updated = normalizePreferences({ ...prev, ...newPreferences });
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
        return updated;
      });

      if (user) {
        try {
          const response = await api.profile.update({
            preferences: currentState,
            apiKeys,
            currency: newPreferences.currency,
          });
          const serverState = normalizePreferences(response.preferences);
          setPreferences(serverState);
          localStorage.setItem(PREFERENCES_KEY, JSON.stringify(serverState));
        } catch (error) {
          console.error("Failed to save preferences to DB:", error);
          throw error;
        }
      }
    },
    [user, preferences],
  );

  // Format currency based on user preference
  const formatCurrency = useCallback(
    (amount: number) => {
      const locale = currencyLocales[preferences.currency] || "en-US";
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: preferences.currency,
      }).format(amount);
    },
    [preferences.currency],
  );

  // Get currency symbol
  const getCurrencySymbol = useCallback(() => {
    return currencySymbols[preferences.currency] || "$";
  }, [preferences.currency]);

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        setPreferences,
        savePreferences,
        formatCurrency,
        getCurrencySymbol,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return context;
}

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  type Preferences,
  PREFERENCES_KEY,
  defaultPreferences,
  currencySymbols,
  currencyLocales,
  isSupportedCurrency,
} from "@/types/preferences";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api-client";
import { normalizePreferences } from "@/lib/preferences-storage";
import {
  getCurrencySymbol as getCurrencySymbolFor,
  HIDDEN_AMOUNT,
} from "@/lib/number";
import type { ProviderApiKeyUpdate } from "@/types/api";

/** Currency used as the last-resort formatter fallback. */
const DEFAULT_CURRENCY = "INR";

interface PreferencesContextType {
  preferences: Preferences;
  savePreferences: (
    newPreferences: Partial<Preferences>,
    apiKeys?: ProviderApiKeyUpdate,
  ) => Promise<void>;
  /**
   * Format a monetary amount, honouring the `hideBalances` privacy switch.
   * Pass `{ reveal: true }` only where showing the value is the point (e.g. the
   * reveal affordance itself).
   */
  formatCurrency: (amount: number, options?: { reveal?: boolean }) => string;
  getCurrencySymbol: () => string;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(
  undefined,
);

const PREFERENCES_MISSING = "__preferences_unavailable__";

/**
 * Every `localStorage` touchpoint goes through these helpers.
 *
 * Storage access throws in more situations than it looks: Safari Private
 * Browsing, `dom.storage.enabled=false`, enterprise policy, and sandboxed
 * iframes all raise `SecurityError`, and a full quota raises
 * `QuotaExceededError`. An unguarded call used to abort the effect that owned
 * it — `localStorage.removeItem` in the fetch effect threw *synchronously*,
 * which escalated to the app-level ErrorBoundary and blanked the whole app.
 * A failed write must degrade to "not persisted", never to "app broken".
 */
function readPreferencesFromStorage(): string | typeof PREFERENCES_MISSING {
  try {
    return localStorage.getItem(PREFERENCES_KEY) ?? PREFERENCES_MISSING;
  } catch {
    return PREFERENCES_MISSING;
  }
}

function writePreferencesToStorage(prefs: Preferences): boolean {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}

function clearPreferencesFromStorage(): void {
  try {
    localStorage.removeItem(PREFERENCES_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

const loadInitialPreferences = (): Preferences => {
  try {
    const saved = readPreferencesFromStorage();
    if (saved !== PREFERENCES_MISSING) {
      const parsed = JSON.parse(saved);
      const normalized = normalizePreferences(parsed);
      writePreferencesToStorage(normalized);
      return normalized;
    }
  } catch {
    // Failed to parse preferences, or storage is unavailable. Either way the
    // defaults are a safe, renderable answer.
  }
  return defaultPreferences;
};

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<Preferences>(
    loadInitialPreferences,
  );

  // Latest preferences for callbacks that must not re-create on every state
  // change (avoids both stale closures and unstable identities).
  const preferencesRef = useRef(preferences);
  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  // Monotonic save counter. `savePreferences` is called from five independent,
  // unthrottled controls (accent, currency, date format, hide-balances, AI
  // key). Without sequencing, a slow PATCH resolving after a newer one would
  // rewind the UI to the older server echo even though the database already
  // holds the newer value, and a failure would roll back over a success.
  const saveSeqRef = useRef(0);

  // Sync from Database on Load
  useEffect(() => {
    let cancelled = false;
    const fetchPreferences = async () => {
      if (!user) {
        clearPreferencesFromStorage();
        setPreferences(defaultPreferences);
        preferencesRef.current = defaultPreferences;
        return;
      }
      try {
        const res = await api.profile.get();
        if (cancelled) return;
        // The normalised `profiles.currency` column is authoritative over the
        // raw JSONB blob (which is unvalidated), so it wins when the two
        // disagree. `normalizePreferences` already rejects unsupported codes,
        // so this cannot reintroduce an invalid currency.
        const serverPrefs = normalizePreferences({
          ...(res.preferences ?? {}),
          ...(isSupportedCurrency(res.currency)
            ? { currency: res.currency }
            : {}),
        });
        setPreferences(serverPrefs);
        preferencesRef.current = serverPrefs;
        writePreferencesToStorage(serverPrefs);
      } catch (error) {
        if (!cancelled) console.error("Failed to fetch preferences:", error);
      }
    };
    void fetchPreferences();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Sync preferences across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== PREFERENCES_KEY) return;
      // `newValue === null` means another tab removed the key — which is
      // exactly what sign-out does. Ignoring it left this tab rendering the
      // previous user's currency and hide-balances.
      if (e.newValue === null) {
        setPreferences(defaultPreferences);
        preferencesRef.current = defaultPreferences;
        return;
      }
      try {
        const next = normalizePreferences(JSON.parse(e.newValue));
        setPreferences(next);
        preferencesRef.current = next;
      } catch {
        // Ignore parse errors
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Save preferences to localStorage and Database.
  // Optimistic with rollback: apply immediately (state + storage), then on API
  // failure restore the snapshot and rethrow so callers can surface the failure
  // — a failed save never silently sticks.
  //
  // Two correctness details that the previous version got wrong:
  //  1. `preferencesRef.current` is updated *at the write site*, not in an
  //     effect. An effect runs after commit, so two saves dispatched in the
  //     same tick both read the same pre-save snapshot and the second silently
  //     discarded the first's field.
  //  2. Responses and rollbacks are gated on a monotonic sequence number, so a
  //     slow PATCH can no longer rewind the UI, and a late failure can no
  //     longer roll back over a newer successful save.
  const savePreferences = useCallback(
    async (
      newPreferences: Partial<Preferences>,
      apiKeys?: ProviderApiKeyUpdate,
    ) => {
      const previous = preferencesRef.current;
      // Compute the next state from the latest preferences (ref, not closure)
      // and persist OUTSIDE any setState updater — updaters must stay pure
      // because React may invoke them twice (e.g. StrictMode).
      const merged = normalizePreferences({
        ...previous,
        ...newPreferences,
      });
      const seq = ++saveSeqRef.current;

      setPreferences(merged);
      preferencesRef.current = merged;
      writePreferencesToStorage(merged);

      if (!user) return;

      try {
        const response = await api.profile.update({
          preferences: merged,
          apiKeys,
          currency: newPreferences.currency,
        });
        // A newer save has already been issued and owns the state.
        if (seq !== saveSeqRef.current) return;
        // `preferences.currency` is the value this client persists alongside
        // the `profiles.currency` column, so prefer the echo we sent over a
        // partial response rather than letting a missing field reset it.
        const serverState = normalizePreferences({
          ...(response.preferences ?? {}),
          ...(merged.currency ? { currency: merged.currency } : {}),
        });
        setPreferences(serverState);
        preferencesRef.current = serverState;
        writePreferencesToStorage(serverState);
      } catch (error) {
        console.error("Failed to save preferences to DB:", error);
        // Only roll back if no newer save has been issued. Restoring
        // unconditionally would let a late failure wipe a newer save that
        // already succeeded.
        if (seq === saveSeqRef.current) {
          setPreferences(previous);
          preferencesRef.current = previous;
          writePreferencesToStorage(previous);
        }
        throw error;
      }
    },
    [user],
  );

  // Format currency based on user preference.
  //
  // Two guarantees live here rather than in each call site:
  //
  // 1. **Balance privacy.** `hideBalances` is applied inside the formatter, so
  //    every monetary figure in the app is masked by construction. It used to
  //    be a file-local `showBalances` in `Accounts.tsx` applied at 5 of 81
  //    render sites, so every other page — and every chart, whose compact
  //    formatter took no visibility argument at all — showed real balances
  //    regardless of the toggle. Pass `{ reveal: true }` to deliberately show
  //    a value (used by the balance-reveal affordance itself).
  //
  // 2. **Never throw.** `Intl.NumberFormat` raises `RangeError` on an invalid
  //    currency code, and this runs during render, so a single bad persisted
  //    value blanked the whole authenticated area via the ErrorBoundary. The
  //    sibling `getCurrencySymbol` below already had this guard; the two are
  //    now consistent.
  const formatCurrency = useCallback(
    (amount: number, options?: { reveal?: boolean }) => {
      if (preferences.hideBalances && !options?.reveal) {
        return HIDDEN_AMOUNT;
      }
      const locale = currencyLocales[preferences.currency] || "en-US";
      try {
        return new Intl.NumberFormat(locale, {
          style: "currency",
          currency: preferences.currency,
        }).format(amount);
      } catch {
        // Unrecognised currency code: fall back to the app default rather than
        // throwing mid-render.
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: DEFAULT_CURRENCY,
        }).format(amount);
      }
    },
    [preferences.currency, preferences.hideBalances],
  );

  // Get currency symbol
  const getCurrencySymbol = useCallback(() => {
    // Derive from the active currency rather than falling back to "$" — an
    // unrecognised code used to render as dollars, which is wrong for any
    // non-USD user whose preference slipped through validation.
    return (
      currencySymbols[preferences.currency] ||
      getCurrencySymbolFor(preferences.currency)
    );
  }, [preferences.currency]);

  const contextValue = useMemo(
    () => ({
      preferences,
      savePreferences,
      formatCurrency,
      getCurrencySymbol,
    }),
    [preferences, savePreferences, formatCurrency, getCurrencySymbol],
  );

  return (
    <PreferencesContext.Provider value={contextValue}>
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

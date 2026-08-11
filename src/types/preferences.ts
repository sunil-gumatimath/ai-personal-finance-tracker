import { DEFAULT_AI_MODEL } from "@/lib/ai-models";

export interface Preferences {
	currency: string;
	dateFormat: string;
	notifications: boolean;
	emailAlerts: boolean;
	budgetAlerts: boolean;
	aiProvider?: "kilocode";
	kilocodeApiKeyConfigured: boolean;
	kilocodeModel?: string;
}

export const PREFERENCES_KEY = "financetrack_preferences";

export const defaultPreferences: Preferences = {
	currency: "INR",
	dateFormat: "MM/dd/yyyy",
	notifications: true,
	emailAlerts: true,
	budgetAlerts: true,
	aiProvider: "kilocode",
	kilocodeApiKeyConfigured: false,
	kilocodeModel: DEFAULT_AI_MODEL,
};

export const currencySymbols: Record<string, string> = {
	USD: "$",
	EUR: "€",
	GBP: "£",
	INR: "₹",
	JPY: "¥",
};

export const currencyLocales: Record<string, string> = {
	USD: "en-US",
	EUR: "de-DE",
	GBP: "en-GB",
	INR: "en-IN",
	JPY: "ja-JP",
};

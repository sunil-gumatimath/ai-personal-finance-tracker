import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
	User,
	Bell,
	Shield,
	Palette,
	LogOut,
	Brain,
	ChevronRight,
	Globe,
	Sparkles,
	Key,
	Layout,
	Save,
	AlertTriangle,
	Eye,
	EyeOff,
	Loader2,
	Check,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences } from "@/hooks/usePreferences";
import {
	FREE_AI_MODELS,
	DEFAULT_AI_MODEL,
	resolveAllowedModel,
} from "@/lib/ai-models";

import { cn } from "@/lib/utils";
import { ACCENT_OPTIONS, THEME_OPTIONS } from "@/components/system/themes";
import { useAccent } from "@/components/system/theme-provider";
import type { LucideIcon } from "lucide-react";
import type { Preferences } from "@/types/preferences";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Transient inline "Saved ✓" feedback for instantly-applied preferences.
 * Appears on success beside a section header, then fades out (motion-safe).
 */
function SavedIndicator({ visible }: { visible: boolean }) {
	return (
		<span
			aria-live="polite"
			className={cn(
				"inline-flex items-center gap-1 text-xs font-medium text-emerald-600 transition-opacity duration-200 ease-out",
				visible ? "opacity-100" : "opacity-0",
			)}
		>
			<Check className="h-3 w-3" aria-hidden="true" />
			Saved
		</span>
	);
}

function ThemeTile({
	selected,
	onClick,
	icon: Icon,
	label,
	swatch,
}: {
	selected: boolean;
	onClick: () => void;
	icon: LucideIcon;
	label: string;
	swatch?: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={selected}
			className={cn(
				"flex flex-col items-center gap-1.5 rounded-lg border p-3 cursor-pointer",
				"transition-[border-color,background-color,color] duration-150 hover:bg-muted/50",
				"focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
				selected
					? "border-primary bg-primary/5 text-primary"
					: "border-border/50 text-muted-foreground",
			)}
		>
			{swatch ? (
				<span
					className="h-4 w-4 rounded-full border border-border/60"
					style={{ backgroundColor: swatch }}
					aria-hidden="true"
				/>
			) : (
				<Icon className={cn("h-4 w-4", selected ? "text-primary" : "text-muted-foreground")} />
			)}
			<span className={cn("text-xs", selected ? "text-primary font-medium" : "text-muted-foreground")}>
				{label}
			</span>
		</button>
	);
}

function ThemeSelector() {
	const { theme, setTheme } = useTheme();
	const { accent, setAccent } = useAccent();

	return (
		<div className="space-y-3">
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Appearance mode">
				{THEME_OPTIONS.map(({ value, label, icon }) => (
					<ThemeTile
						key={value}
						selected={theme === value}
						onClick={() => setTheme(value)}
						icon={icon}
						label={label}
					/>
				))}
			</div>
			<div className="grid grid-cols-2 gap-2" role="group" aria-label="Accent color">
				{ACCENT_OPTIONS.map(({ value, label, icon }) => (
					<ThemeTile
						key={value}
						selected={accent === value}
						onClick={() => setAccent(value)}
						icon={icon}
						label={label}
						swatch={value === "emerald" ? "#10b981" : undefined}
					/>
				))}
			</div>
			<p className="text-xs text-muted-foreground">
				Accent works with both light and dark mode.
			</p>
		</div>
	);
}

export function Settings() {
	const { user, signOut, updateProfile, resetPassword, deleteAccount } =
		useAuth();
	const { preferences, savePreferences } = usePreferences();
	const navigate = useNavigate();
	const [isSavingProfile, setIsSavingProfile] = useState(false);
	const [isSendingReset, setIsSendingReset] = useState(false);
	const [isDeletingAccount, setIsDeletingAccount] = useState(false);
	const [aiSaving, setAiSaving] = useState(false);
	const [showKey, setShowKey] = useState(false);
	// Section whose instant-applied changes just saved ("Saved ✓" feedback).
	const [savedSection, setSavedSection] = useState<
		"interface" | "notifications" | null
	>(null);
	const savedTimeoutRef = useRef<number | null>(null);
	const [profileData, setProfileData] = useState({
		fullName: user?.user_metadata?.full_name || "",
		email: user?.email || "",
	});

	const getInitials = () => {
		const fullName = user?.user_metadata?.full_name || user?.email || "";
		const parts = fullName.trim().split(/\s+/).filter(Boolean);
		if (parts.length === 0) return "U";
		if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
		return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
	};

	useEffect(() => {
		setProfileData({
			fullName: user?.user_metadata?.full_name || "",
			email: user?.email || "",
		});
	}, [user?.user_metadata?.full_name, user?.email]);

	const [aiSettings, setAiSettings] = useState({
		kilocodeApiKey: "",
		kilocodeModel: resolveAllowedModel(preferences.kilocodeModel),
	});

	// Sync AI settings when preferences load from DB
	useEffect(() => {
		setAiSettings((prev) => ({
			kilocodeApiKey: prev.kilocodeApiKey,
			kilocodeModel: resolveAllowedModel(preferences.kilocodeModel),
		}));
	}, [preferences.kilocodeModel]);

	const handleProfileUpdate = async () => {
		setIsSavingProfile(true);
		try {
			const { error } = await updateProfile({
				full_name: profileData.fullName,
			});

			if (error) throw error;
			toast.success("Profile updated successfully");
		} catch (error) {
			console.error("Error updating profile:", error);
			toast.error("Failed to update profile");
		} finally {
			setIsSavingProfile(false);
		}
	};

	/**
	 * Instant-apply preference save: the provider applies optimistically and
	 * rolls back on failure, so here we only surface the outcome — a transient
	 * "Saved ✓" beside the section header on success, a toast on failure.
	 */
	const handleInstantPreferenceSave = async (
		section: "interface" | "notifications",
		patch: Partial<Preferences>,
	) => {
		try {
			await savePreferences(patch);
			setSavedSection(section);
			if (savedTimeoutRef.current !== null) {
				window.clearTimeout(savedTimeoutRef.current);
			}
			savedTimeoutRef.current = window.setTimeout(() => {
				setSavedSection(null);
				savedTimeoutRef.current = null;
			}, 2000);
		} catch (error) {
			console.error("Failed to save preference:", error);
			toast.error("Couldn't save preference");
		}
	};

	const handleAiSave = async () => {
		const activeKey = aiSettings.kilocodeApiKey;
		const activeKeyConfigured = preferences.kilocodeApiKeyConfigured;

		if (!activeKey?.trim() && !activeKeyConfigured) {
			toast.error("KiloCode API key is required");
			return;
		}

		setAiSaving(true);
		try {
			const apiKeys: {
				kilocodeApiKey?: string;
			} = {};
			const kiloKey = aiSettings.kilocodeApiKey.trim();
			if (kiloKey) apiKeys.kilocodeApiKey = kiloKey;

			await savePreferences(
				{
					aiProvider: "kilocode",
					kilocodeModel: aiSettings.kilocodeModel.trim() || DEFAULT_AI_MODEL,
				},
				apiKeys,
			);
			setAiSettings((prev) => ({
				...prev,
				kilocodeApiKey: "",
			}));
			toast.success("AI settings saved successfully");
		} catch (error) {
			console.error("Failed to save AI settings:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to save AI settings",
			);
		} finally {
			setAiSaving(false);
		}
	};

	const handlePasswordReset = async () => {
		if (!user?.email || isSendingReset) return;

		setIsSendingReset(true);
		try {
			const { error } = await resetPassword(user.email);
			if (error) throw error;
			toast.success("Password reset email sent");
		} catch (error) {
			console.error("Error sending reset email:", error);
			toast.error("Failed to send password reset email");
		} finally {
			setIsSendingReset(false);
		}
	};

	const handleDeleteAccount = async () => {
		if (isDeletingAccount) return;
		setIsDeletingAccount(true);
		try {
			await deleteAccount();
			toast.success("Goodbye! We'll miss you. 👋", {
				description:
					"Your account and all associated data have been permanently deleted.",
			});
			navigate("/login", { replace: true });
		} catch (error) {
			console.error("Error deleting account:", error);
			toast.error("Failed to delete account");
			setIsDeletingAccount(false);
		}
	};

	return (
		<div className="max-w-3xl space-y-5">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold tracking-tight">Settings</h1>
				<p className="text-sm text-muted-foreground">
					Manage your account and preferences
				</p>
			</div>

			<Tabs defaultValue="profile" className="space-y-4">
				<TabsList className="max-w-full min-h-9 overflow-x-auto rounded-lg bg-muted/50 p-1">
					<TabsTrigger
						value="profile"
						className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium gap-1.5 cursor-pointer"
					>
						<User className="h-3.5 w-3.5" /> Profile
					</TabsTrigger>
					<TabsTrigger
						value="preferences"
						className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium gap-1.5 cursor-pointer"
					>
						<Palette className="h-3.5 w-3.5" /> Preferences
					</TabsTrigger>
					<TabsTrigger
						value="notifications"
						className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium gap-1.5 cursor-pointer"
					>
						<Bell className="h-3.5 w-3.5" /> Alerts
					</TabsTrigger>
					<TabsTrigger
						value="security"
						className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium gap-1.5 cursor-pointer"
					>
						<Shield className="h-3.5 w-3.5" /> Security
					</TabsTrigger>
				</TabsList>

				{/* Profile Tab */}
				<TabsContent value="profile" className="space-y-4">
					<div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
						<div className="px-4 py-3 border-b border-border/50">
							<h2 className="text-sm font-medium">Account Details</h2>
						</div>
						<div className="p-4 space-y-4">
							<div className="flex items-center gap-4 mb-4">
								<Avatar className="h-16 w-16">
									<AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
										{getInitials()}
									</AvatarFallback>
								</Avatar>
								<div>
									<p className="text-sm font-medium">
										{user?.user_metadata?.full_name || "User"}
									</p>
									<p className="text-xs text-muted-foreground">{user?.email}</p>
								</div>
							</div>
							<div className="grid sm:grid-cols-2 gap-4">
								<div className="space-y-1.5">
									<Label htmlFor="fullName" className="text-xs">
										Full Name
									</Label>
									<Input
										id="fullName"
										value={profileData.fullName}
										onChange={(e) =>
											setProfileData({
												...profileData,
												fullName: e.target.value,
											})
										}
										className="h-9 text-sm"
										placeholder="Enter your name"
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="email" className="text-xs">
										Email
									</Label>
									<Input
										id="email"
										type="email"
										value={profileData.email}
										disabled
										className="h-9 text-sm bg-muted/30"
									/>
								</div>
							</div>
							<Button
								onClick={handleProfileUpdate}
								disabled={isSavingProfile}
								size="sm"
								className="h-8 cursor-pointer"
							>
								{isSavingProfile ? (
									<>
										<Loader2 className="mr-1.5 h-3.5 w-3.5 motion-safe:animate-spin" />
										Saving...
									</>
								) : (
									"Save Changes"
								)}
							</Button>
						</div>
					</div>
				</TabsContent>

				{/* Preferences Tab */}
				<TabsContent value="preferences" className="space-y-4">
					{/* Interface */}
					<div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
						<div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/50">
							<h2 className="text-sm font-medium">Interface</h2>
							<SavedIndicator visible={savedSection === "interface"} />
						</div>
						<div className="p-4 space-y-4">
							<div className="space-y-2">
								<Label className="text-xs text-muted-foreground">Theme</Label>
								<ThemeSelector />
							</div>

							<div className="grid sm:grid-cols-2 gap-4">
								<div className="space-y-1.5">
									<Label className="text-xs" htmlFor="currency-select">
										Currency
									</Label>
									<Select
										value={preferences.currency}
										onValueChange={(v) =>
											void handleInstantPreferenceSave(
												"interface",
												{ currency: v },
											)
										}
									>
										<SelectTrigger
											id="currency-select"
											className="h-9 text-sm cursor-pointer"
										>
											<Globe className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="USD">USD ($)</SelectItem>
											<SelectItem value="EUR">EUR (€)</SelectItem>
											<SelectItem value="GBP">GBP (£)</SelectItem>
											<SelectItem value="INR">INR (₹)</SelectItem>
											<SelectItem value="JPY">JPY (¥)</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-1.5">
									<Label className="text-xs" htmlFor="date-format-select">
										Date Format
									</Label>
									<Select
										value={preferences.dateFormat}
										onValueChange={(v) =>
											void handleInstantPreferenceSave(
												"interface",
												{ dateFormat: v },
											)
										}
									>
										<SelectTrigger
											id="date-format-select"
											className="h-9 text-sm cursor-pointer"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="MM/dd/yyyy">MM/DD/YYYY</SelectItem>
											<SelectItem value="dd/MM/yyyy">DD/MM/YYYY</SelectItem>
											<SelectItem value="yyyy-MM-dd">YYYY-MM-DD</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
						</div>
					</div>

					{/* AI Integration */}
					<div className="group relative overflow-hidden rounded-xl border border-primary/20 bg-primary/[0.02] backdrop-blur-sm">
						<div className="px-4 py-3 border-b border-primary/10 flex items-center gap-2">
							<Brain className="h-4 w-4 text-primary" />
							<h2 className="text-sm font-medium">AI Integration</h2>
						</div>
						<div className="p-4 space-y-4">
							{/* Provider */}
							<div className="space-y-1.5">
								<Label className="text-xs flex items-center gap-1.5">
									<Sparkles className="h-3 w-3" /> AI Provider
								</Label>
								<p className="text-sm font-medium">KiloCode</p>
								<p className="text-xs text-muted-foreground">
									Use your Kilo Gateway API key from{" "}
									<a
										href="https://app.kilo.ai"
										target="_blank"
										rel="noopener noreferrer"
										className="underline underline-offset-2 hover:text-primary"
									>
										app.kilo.ai
									</a>{" "}
									(Your Profile → API key at the bottom of the page). KiloCode
									powers financial coaching and AI chat insights.
								</p>
								<p className="text-[11px] text-muted-foreground/80 leading-normal">
									Privacy: to answer your questions, your financial data
									(balances, transactions, budgets, goals, debts) is sent to the
									KiloCode API. Only free Kilo Gateway models can be selected.
								</p>
							</div>

							{/* API Key */}
							<div className="grid sm:grid-cols-2 gap-4">
								<div className="space-y-1.5">
									<Label
										htmlFor="aiApiKey"
										className="text-xs flex items-center gap-1.5"
									>
										<Key className="h-3 w-3" /> API Key
									</Label>
									<div className="relative flex items-center">
										<Input
											id="aiApiKey"
											type={showKey ? "text" : "password"}
											placeholder={
												preferences.kilocodeApiKeyConfigured
													? "Configured — enter a new key to replace"
													: "Kilo Gateway API key..."
											}
											value={aiSettings.kilocodeApiKey}
											onChange={(e) =>
												setAiSettings((prev) => ({
													...prev,
													kilocodeApiKey: e.target.value,
												}))
											}
											className="h-9 text-sm font-mono pr-10"
										/>
										<button
											type="button"
											onClick={() => setShowKey((current) => !current)}
											aria-label={showKey ? "Hide API key" : "Show API key"}
											aria-pressed={showKey}
											className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer flex items-center justify-center"
										>
											{showKey ? (
												<EyeOff className="h-4 w-4" />
											) : (
												<Eye className="h-4 w-4" />
											)}
										</button>
									</div>
									<p className="text-[10px] text-muted-foreground leading-normal">
										{preferences.kilocodeApiKeyConfigured
											? "A key is saved server-side. This field stays empty so the key is not stored in your browser."
											: "No key saved yet. It will be encrypted and stored server-side."}
									</p>
								</div>

								{/* Model — only free Kilo Gateway models */}
								<div className="space-y-1.5">
									<Label
										htmlFor="kilocodeModel"
										className="text-xs flex items-center gap-1.5"
									>
										<Layout className="h-3 w-3" /> Model
									</Label>
									<Select
										value={aiSettings.kilocodeModel}
										onValueChange={(v) =>
											setAiSettings((prev) => ({ ...prev, kilocodeModel: v }))
										}
									>
										<SelectTrigger
											id="kilocodeModel"
											className="h-9 text-sm w-full"
										>
											<SelectValue placeholder="Select a free model" />
										</SelectTrigger>
										<SelectContent>
											{FREE_AI_MODELS.map((m) => (
												<SelectItem key={m.id} value={m.id} className="py-2">
													<span className="flex flex-col">
														<span>{m.label}</span>
														<span className="text-[10px] text-muted-foreground">
															{m.context} context — {m.description}
														</span>
													</span>
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<p className="text-[10px] text-muted-foreground leading-normal mt-1">
										Only free Kilo Gateway models are listed and accepted — the
										server rejects anything else. The free catalog changes
										occasionally; models here reflect Kilo's current free list.
									</p>
								</div>
							</div>

							{/* Save Button */}
							<div className="flex justify-end pt-1">
								<Button
									onClick={handleAiSave}
									disabled={aiSaving}
									size="sm"
									className="h-8 gap-1.5 cursor-pointer"
								>
									{aiSaving ? (
										<Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" />
									) : (
										<Save className="h-3.5 w-3.5" />
									)}
									{aiSaving ? "Saving..." : "Save AI Settings"}
								</Button>
							</div>
						</div>
					</div>
				</TabsContent>

				{/* Notifications Tab */}
				<TabsContent value="notifications" className="space-y-4">
					<div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
						<div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/50">
							<h2 className="text-sm font-medium">
								Notification Preferences
							</h2>
							<SavedIndicator visible={savedSection === "notifications"} />
						</div>
						<div>
							{[
								{
									id: "notifications",
									label: "Push Notifications",
									desc: "Real-time alerts for important events",
								},
								{
									id: "emailAlerts",
									label: "Email Summaries",
									desc: "Weekly digest emails",
								},
								{
									id: "budgetAlerts",
									label: "Budget Alerts",
									desc: "Alerts when spending exceeds limits",
								},
							].map((item, i, arr) => (
								<div
									key={item.id}
									className={cn(
										"flex items-center justify-between px-4 py-3",
										i !== arr.length - 1 && "border-b border-border/30",
									)}
								>
									<div className="space-y-0.5">
										<Label
											htmlFor={`switch-${item.id}`}
											className="text-sm cursor-pointer"
										>
											{item.label}
										</Label>
										<p className="text-xs text-muted-foreground">{item.desc}</p>
									</div>
									<Switch
										id={`switch-${item.id}`}
										checked={
											preferences[
												item.id as keyof typeof preferences
											] as boolean
										}
										onCheckedChange={(checked) =>
											void handleInstantPreferenceSave("notifications", {
												[item.id]: checked,
											})
										}
										className="cursor-pointer"
									/>
								</div>
							))}
						</div>
					</div>
				</TabsContent>

				{/* Security Tab */}
				<TabsContent value="security" className="space-y-4">
					<div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
						<div className="px-4 py-3 border-b border-border/50">
							<h2 className="text-sm font-medium">Password</h2>
						</div>
						<div className="p-4">
							<div className="flex items-center justify-between gap-4">
								<div>
									<p className="text-sm font-medium">Reset Password</p>
									<p className="text-xs text-muted-foreground">
										Send a reset link to your email
									</p>
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={handlePasswordReset}
									disabled={isSendingReset}
									className="h-8 cursor-pointer"
								>
									{isSendingReset ? (
										<>
											<Loader2 className="mr-1.5 h-3.5 w-3.5 motion-safe:animate-spin" />
											Sending...
										</>
									) : (
										<>
											Send Link
											<ChevronRight className="ml-1 h-3.5 w-3.5" />
										</>
									)}
								</Button>
							</div>
						</div>
					</div>

					<div className="group relative overflow-hidden rounded-xl border border-destructive/20 bg-destructive/[0.02] backdrop-blur-sm">
						<div className="px-4 py-3 border-b border-destructive/10">
							<h2 className="text-xs font-medium text-destructive uppercase tracking-wide">
								Danger Zone
							</h2>
						</div>
						<div className="p-4">
							<div className="flex items-center justify-between gap-4">
								<div>
									<p className="text-sm font-medium">Sign Out</p>
									<p className="text-xs text-muted-foreground">
										End your current session
									</p>
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={signOut}
									className="h-8 border-destructive/30 text-destructive hover:bg-destructive hover:text-white cursor-pointer"
								>
									<LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign Out
								</Button>
							</div>

							<div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t border-destructive/10">
								<div>
									<p className="text-sm font-medium">Delete Account</p>
									<p className="text-xs text-muted-foreground">
										Permanently delete your account and all data
									</p>
								</div>

								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button
											variant="destructive"
											size="sm"
											className="h-8 bg-destructive hover:bg-destructive/90 cursor-pointer"
											disabled={isDeletingAccount}
										>
											{isDeletingAccount ? (
												<>
													<Loader2 className="mr-1.5 h-3.5 w-3.5 motion-safe:animate-spin" />
													Deleting...
												</>
											) : (
												<>
													<AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
													Delete Account
												</>
											)}
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent className="rounded-xl">
										<AlertDialogHeader>
											<AlertDialogTitle>
												Are you absolutely sure?
											</AlertDialogTitle>
											<AlertDialogDescription>
												This action cannot be undone. This will permanently
												delete your account and completely wipe all of your
												financial data, including accounts, transactions,
												budgets, goals, and debts from our servers.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel className="rounded-lg">
												Cancel
											</AlertDialogCancel>
											<AlertDialogAction
												onClick={handleDeleteAccount}
												className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg"
											>
												Yes, delete my account
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</div>
						</div>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}

import { useState, useEffect } from "react";
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

import { cn } from "@/lib/utils";
import { THEME_OPTIONS } from "@/components/system/themes";
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

function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      role="group"
      aria-label="Theme"
    >
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={theme === value}
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all hover:bg-muted/50 cursor-pointer",
            theme === value
              ? "border-primary bg-primary/5 text-primary"
              : "border-border/50 text-muted-foreground",
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4",
              theme === value ? "text-primary" : "text-muted-foreground",
            )}
          />
          <span
            className={cn(
              "text-xs",
              theme === value
                ? "text-primary font-medium"
                : "text-muted-foreground",
            )}
          >
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}

export function Settings() {
  const { user, signOut, updateProfile, resetPassword, deleteAccount } = useAuth();
  const { preferences, savePreferences } = usePreferences();
  const [loading, setLoading] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
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
    })
  }, [user?.user_metadata?.full_name, user?.email])

  const [aiSettings, setAiSettings] = useState({
    aiProvider: preferences.aiProvider || ("gemini" as "gemini" | "openrouter"),
    geminiApiKey: "",
    geminiModel: preferences.geminiModel || "gemini-3.5-flash",
    openrouterApiKey: "",
    openrouterModel: preferences.openrouterModel || "openrouter/free",
  });

  // Sync AI settings when preferences load from DB
  useEffect(() => {
    setAiSettings((prev) => ({
      aiProvider: preferences.aiProvider || "gemini",
      geminiApiKey: prev.geminiApiKey,
      geminiModel: preferences.geminiModel || "gemini-3.5-flash",
      openrouterApiKey: prev.openrouterApiKey,
      openrouterModel: preferences.openrouterModel || "openrouter/free",
    }));
  }, [
    preferences.aiProvider,
    preferences.geminiModel,
    preferences.openrouterModel,
  ]);

  const handleProfileUpdate = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  const handleAiSave = async () => {
    const provider = aiSettings.aiProvider || "gemini";
    const activeKey =
      provider === "openrouter"
        ? aiSettings.openrouterApiKey
        : aiSettings.geminiApiKey;
    const activeKeyConfigured =
      provider === "openrouter"
        ? preferences.openrouterApiKeyConfigured
        : preferences.geminiApiKeyConfigured;

    if (!activeKey?.trim() && !activeKeyConfigured) {
      toast.error(
        `${provider === "openrouter" ? "OpenRouter" : "Gemini"} API key is required`,
      );
      return;
    }

    if (provider === "openrouter" && activeKey.trim() && !activeKey.trim().startsWith("sk-or-")) {
      toast.error(
        "OpenRouter API keys usually start with sk-or-. Please paste your OpenRouter key, not a Gemini key.",
      );
      return;
    }

    if (provider === "gemini" && activeKey.trim() && !activeKey.trim().startsWith("AIza")) {
      toast.error(
        "Gemini API keys usually start with AIza. Please paste your Gemini key, not an OpenRouter key.",
      );
      return;
    }

    setAiSaving(true);
    try {
      const apiKeys: {
        geminiApiKey?: string;
        openrouterApiKey?: string;
      } = {};
      const geminiKey = aiSettings.geminiApiKey.trim();
      const openrouterKey = aiSettings.openrouterApiKey.trim();
      if (geminiKey) apiKeys.geminiApiKey = geminiKey;
      if (openrouterKey) apiKeys.openrouterApiKey = openrouterKey;

      await savePreferences({
        aiProvider: provider,
        geminiModel: aiSettings.geminiModel.trim() || "gemini-3.5-flash",
        openrouterModel: aiSettings.openrouterModel.trim() || "openrouter/free",
      }, apiKeys);
      setAiSettings((prev) => ({
        ...prev,
        geminiApiKey: "",
        openrouterApiKey: "",
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
    if (!user?.email) return;

    try {
      const { error } = await resetPassword(user.email);
      if (error) throw error;
      toast.success("Password reset email sent");
    } catch (error) {
      console.error("Error sending reset email:", error);
      toast.error("Failed to send password reset email");
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      const { error } = await deleteAccount();
      if (error) throw error;
      toast.success("Goodbye! We'll miss you. 👋", {
        description: "Your account and all associated data have been permanently deleted.",
      });
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
        <TabsList className="h-9 rounded-lg bg-muted/50 p-1">
          <TabsTrigger
            value="profile"
            className="rounded-md px-3 py-1.5 text-xs font-medium gap-1.5 cursor-pointer"
          >
            <User className="h-3.5 w-3.5" /> Profile
          </TabsTrigger>
          <TabsTrigger
            value="preferences"
            className="rounded-md px-3 py-1.5 text-xs font-medium gap-1.5 cursor-pointer"
          >
            <Palette className="h-3.5 w-3.5" /> Preferences
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="rounded-md px-3 py-1.5 text-xs font-medium gap-1.5 cursor-pointer"
          >
            <Bell className="h-3.5 w-3.5" /> Alerts
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="rounded-md px-3 py-1.5 text-xs font-medium gap-1.5 cursor-pointer"
          >
            <Shield className="h-3.5 w-3.5" /> Security
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
            <div className="px-4 py-3 border-b border-border/50">
              <h3 className="text-sm font-medium">Account Details</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-4 mb-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{user?.user_metadata?.full_name || 'User'}</p>
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
                disabled={loading}
                size="sm"
                className="h-8 cursor-pointer"
              >
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-4">
          {/* Interface */}
          <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
            <div className="px-4 py-3 border-b border-border/50">
              <h3 className="text-sm font-medium">Interface</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Theme</Label>
                <ThemeSelector />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Currency</Label>
                  <Select
                    value={preferences.currency}
                    onValueChange={(v) => savePreferences({ currency: v })}
                  >
                    <SelectTrigger className="h-9 text-sm cursor-pointer">
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
                  <Label className="text-xs">Date Format</Label>
                  <Select
                    value={preferences.dateFormat}
                    onValueChange={(v) => savePreferences({ dateFormat: v })}
                  >
                    <SelectTrigger className="h-9 text-sm cursor-pointer">
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
              <h3 className="text-sm font-medium">AI Integration</h3>
            </div>
            <div className="p-4 space-y-4">
              {/* Provider Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> AI Provider
                </Label>
                <Select
                  value={aiSettings.aiProvider}
                  onValueChange={(v) => {
                    const newProvider = v as "gemini" | "openrouter";
                    setAiSettings((prev) => ({
                      ...prev,
                      aiProvider: newProvider,
                    }));
                  }}
                >
                  <SelectTrigger className="h-9 text-sm cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">Gemini (Google)</SelectItem>
                    <SelectItem value="openrouter">
                      OpenRouter (Multi-Model)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {aiSettings.aiProvider === "openrouter"
                    ? "Use an OpenRouter API key that starts with sk-or-. The default openrouter/free router will fall back to a concrete free model if routing fails."
                    : "Use a Gemini API key that starts with AIza. Gemini powers financial coaching and AI chat insights."}
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
                        (
                          aiSettings.aiProvider === "openrouter"
                            ? preferences.openrouterApiKeyConfigured
                            : preferences.geminiApiKeyConfigured
                        )
                          ? "Configured — enter a new key to replace"
                          : aiSettings.aiProvider === "openrouter"
                            ? "sk-or-v1-..."
                            : "AIza..."
                      }
                      value={
                        aiSettings.aiProvider === "openrouter"
                          ? aiSettings.openrouterApiKey
                          : aiSettings.geminiApiKey
                      }
                      onChange={(e) => {
                        const key = e.target.value;
                        if (aiSettings.aiProvider === "openrouter") {
                          setAiSettings((prev) => ({
                            ...prev,
                            openrouterApiKey: key,
                          }));
                        } else {
                          setAiSettings((prev) => ({
                            ...prev,
                            geminiApiKey: key,
                          }));
                        }
                      }}
                      className="h-9 text-sm font-mono pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center"
                    >
                      {showKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    {(
                      aiSettings.aiProvider === "openrouter"
                        ? preferences.openrouterApiKeyConfigured
                        : preferences.geminiApiKeyConfigured
                    )
                      ? "A key is saved server-side. This field stays empty so the key is not stored in your browser."
                      : "No key saved yet. It will be encrypted and stored server-side."}
                  </p>
                </div>

                {/* Model — switches based on provider */}
                {(!aiSettings.aiProvider ||
                  aiSettings.aiProvider === "gemini") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Layout className="h-3 w-3" /> Model
                    </Label>
                    <Select
                      value={aiSettings.geminiModel || "gemini-3.5-flash"}
                      onValueChange={(v) =>
                        setAiSettings((prev) => ({ ...prev, geminiModel: v }))
                      }
                    >
                      <SelectTrigger className="h-9 text-sm cursor-pointer">
                        <Sparkles className="mr-2 h-3.5 w-3.5 text-primary" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini-3.5-flash">
                          Gemini 3.5 Flash (Latest)
                        </SelectItem>
                        <SelectItem value="gemini-3.1-pro">
                          Gemini 3.1 Pro
                        </SelectItem>
                        <SelectItem value="gemini-3.1-flash-lite">
                          Gemini 3.1 Flash-Lite
                        </SelectItem>
                        <SelectItem value="gemini-3.0-pro">
                          Gemini 3.0 Pro
                        </SelectItem>
                        <SelectItem value="gemini-3.0-flash">
                          Gemini 3.0 Flash
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {aiSettings.aiProvider === "openrouter" && (
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="openrouterModel"
                      className="text-xs flex items-center gap-1.5"
                    >
                      <Layout className="h-3 w-3" /> Model
                    </Label>
                    <Input
                      id="openrouterModel"
                      type="text"
                      placeholder="openrouter/free"
                      value={aiSettings.openrouterModel}
                      onChange={(e) =>
                        setAiSettings((prev) => ({
                          ...prev,
                          openrouterModel: e.target.value,
                        }))
                      }
                      className="h-9 text-sm font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground leading-normal mt-1">
                      Default: openrouter/free. You can also try{" "}
                      <code className="text-purple-400">meta-llama/llama-3.3-70b-instruct:free</code>. Use any model slug from{" "}
                      <a
                        href="https://openrouter.ai/models"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:text-primary"
                      >
                        openrouter.ai/models
                      </a>
                    </p>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-1">
                <Button
                  onClick={handleAiSave}
                  disabled={aiSaving}
                  size="sm"
                  className="h-8 gap-1.5 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  {aiSaving ? "Saving..." : "Save AI Settings"}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
            <div className="px-4 py-3 border-b border-border/50">
              <h3 className="text-sm font-medium">Notification Preferences</h3>
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
                      className="text-sm cursor-pointer"
                      onClick={() =>
                        savePreferences({
                          [item.id]:
                            !preferences[item.id as keyof typeof preferences],
                        })
                      }
                    >
                      {item.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={
                      preferences[
                        item.id as keyof typeof preferences
                      ] as boolean
                    }
                    onCheckedChange={(checked) =>
                      savePreferences({ [item.id]: checked })
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
              <h3 className="text-sm font-medium">Password</h3>
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
                  className="h-8 cursor-pointer"
                >
                  Send Link <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-xl border border-destructive/20 bg-destructive/[0.02] backdrop-blur-sm">
            <div className="px-4 py-3 border-b border-destructive/10">
              <h3 className="text-xs font-medium text-destructive uppercase tracking-wide">
                Danger Zone
              </h3>
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
                      <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> 
                      {isDeletingAccount ? "Deleting..." : "Delete Account"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your
                        account and completely wipe all of your financial data, including accounts,
                        transactions, budgets, goals, and debts from our servers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
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

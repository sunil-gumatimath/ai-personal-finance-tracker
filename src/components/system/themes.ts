import { Anchor, Compass, Flame, Heart, Leaf, Monitor, Moon, Palette, Sparkles, Sun, type LucideIcon } from "lucide-react"

export type ThemeName = "light" | "dark" | "system"
export type AccentName = "default" | "emerald" | "navy" | "violet" | "cyan" | "rose" | "amber"

export interface ThemeOption {
    value: ThemeName
    label: string
    icon: LucideIcon
}

export const THEME_OPTIONS: readonly ThemeOption[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
]

export interface AccentOption {
    value: AccentName
    label: string
    icon: LucideIcon
}

/**
 * The persisted `value` is an internal id, not a colour name — `amber` is
 * labelled "Sunset" in the UI. Read the label from here rather than inferring a
 * colour name from the value.
 */
export const ACCENT_OPTIONS: readonly AccentOption[] = [
    { value: "default", label: "Default", icon: Palette },
    { value: "emerald", label: "Emerald", icon: Leaf },
    { value: "navy", label: "Navy", icon: Anchor },
    { value: "violet", label: "Violet", icon: Sparkles },
    { value: "cyan", label: "Cyan", icon: Compass },
    { value: "rose", label: "Rose", icon: Heart },
    { value: "amber", label: "Sunset", icon: Flame },
]

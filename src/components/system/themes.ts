import { Leaf, Monitor, Moon, Sun, type LucideIcon } from "lucide-react"

export type ThemeName = "light" | "dark" | "system" | "emerald"

export interface ThemeOption {
    value: ThemeName
    label: string
    icon: LucideIcon
}

export const THEME_OPTIONS: readonly ThemeOption[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
    { value: "emerald", label: "Emerald", icon: Leaf },
]

export const COLOR_THEMES = THEME_OPTIONS
    .filter(({ value }) => value !== "system")
    .map(({ value }) => value)

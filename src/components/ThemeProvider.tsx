import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react"
import {
  APP_THEME_STORAGE_KEY,
  LANDING_THEME_STORAGE_KEY,
  normalizeLandingTheme,
  parseStoredAppTheme,
  parseStoredLandingTheme,
  resolveEffectiveTheme,
  type ResolvedTheme,
  type Theme,
  type ThemeScope,
} from "@/utils/theme"

type ThemeProviderProps = {
  children: React.ReactNode
  scope?: ThemeScope
  defaultTheme?: Theme
  storageKey?: string
  landingStorageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light"
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function readStorage(storage: "local" | "session", key: string): string | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    return storage === "local" ? window.localStorage.getItem(key) : window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(storage: "local" | "session", key: string, value: string): void {
  if (typeof window === "undefined") {
    return
  }
  try {
    if (storage === "local") {
      window.localStorage.setItem(key, value)
    } else {
      window.sessionStorage.setItem(key, value)
    }
  } catch {
    // Ignore storage write failures in restricted browsing contexts
  }
}

const initialState: ThemeProviderState = {
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  scope = "app",
  defaultTheme = "system",
  storageKey = APP_THEME_STORAGE_KEY,
  landingStorageKey = LANDING_THEME_STORAGE_KEY,
  ...props
}: ThemeProviderProps) {
  const [appTheme, setAppTheme] = useState<Theme>(() =>
    parseStoredAppTheme(readStorage("local", storageKey), defaultTheme)
  )
  const [landingTheme, setLandingTheme] = useState<ResolvedTheme>(() =>
    parseStoredLandingTheme(readStorage("session", landingStorageKey))
  )
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme())

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return
    }
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const syncSystemTheme = () => {
      const next = mediaQuery.matches ? "dark" : "light"
      setSystemTheme((prev) => (prev === next ? prev : next))
    }
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncSystemTheme()
      }
    }

    mediaQuery.addEventListener("change", syncSystemTheme)
    window.addEventListener("pageshow", syncSystemTheme)
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      mediaQuery.removeEventListener("change", syncSystemTheme)
      window.removeEventListener("pageshow", syncSystemTheme)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [])

  const theme: Theme = scope === "landing" ? landingTheme : appTheme
  const resolvedTheme = resolveEffectiveTheme({
    scope,
    appTheme,
    landingTheme,
    systemTheme,
  })

  useLayoutEffect(() => {
    const root = window.document.documentElement
    const themeColor = resolvedTheme === "dark" ? "#000000" : "#ffffff"

    root.classList.remove("light", "dark")
    root.classList.add(resolvedTheme)
    root.style.colorScheme = resolvedTheme
    root.style.backgroundColor = themeColor

    // Synchronize single <meta name="theme-color"> with active theme
    const themeColorMeta = document.querySelector('meta[name="theme-color"]')
    if (themeColorMeta) {
      themeColorMeta.removeAttribute("media")
      themeColorMeta.setAttribute("content", themeColor)
    }
  }, [resolvedTheme])

  const value: ThemeProviderState = {
    theme,
    resolvedTheme,
    setTheme: (nextTheme: Theme) => {
      if (scope === "landing") {
        const normalized = normalizeLandingTheme(nextTheme)
        writeStorage("session", landingStorageKey, normalized)
        setLandingTheme(normalized)
        return
      }
      writeStorage("local", storageKey, nextTheme)
      setAppTheme(nextTheme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}

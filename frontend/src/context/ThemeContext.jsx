/**
 * Theme Context
 *
 * Manages light/dark theme state across the application.
 * - Reads initial preference from localStorage
 * - Persists theme changes to localStorage
 * - Applies theme attribute to the document root element
 */
import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = localStorage.getItem("pp_theme");
      return stored === "dark";
    } catch {
      return false;
    }
  });

  // Sync theme attribute and localStorage whenever the theme changes
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.setAttribute("data-theme", "dark");
      localStorage.setItem("pp_theme", "dark");
    } else {
      root.setAttribute("data-theme", "light");
      localStorage.setItem("pp_theme", "light");
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  return (
    // Provide theme state and toggle to all child components
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

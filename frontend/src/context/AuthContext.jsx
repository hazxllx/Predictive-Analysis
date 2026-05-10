import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import api from "../api/axios";
import { clearAllCachedQueries } from "../api/queryCache";

const AuthContext = createContext();

export const getRoleHome = (role) => {
  if (role === "admin") return "/admin-dashboard";
  return "/my-dashboard";
};

const isDev = import.meta.env.DEV;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // `loading` === auth hydration in progress (restoreSession)
  const [loading, setLoading] = useState(true);
  // Distinguish "hydration complete" from "authenticated"
  const [authReady, setAuthReady] = useState(false);

  const persistUser = useCallback((nextUser) => {
    if (nextUser) {
      localStorage.setItem("pp_user", JSON.stringify(nextUser));
    } else {
      localStorage.removeItem("pp_user");
    }
    setUser(nextUser);
  }, []);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      const storedUser = localStorage.getItem("pp_user");
      const token = localStorage.getItem("pp_token");

      if (!token) {
        localStorage.removeItem("pp_user");
        if (active) {
          setUser(null);
          setLoading(false);
          setAuthReady(true);
        }
        if (isDev) console.log(`[AUTH] Hydration complete (no token)`);
        return;
      }

      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (active) setUser(parsedUser);
        } catch {
          localStorage.removeItem("pp_user");
        }
      }

      try {
        const { data } = await api.get("/auth/me", { skipAbort: true });
        if (isDev) console.log("[AUTH] Session restored:", data?.user?.email);
        if (active) persistUser(data?.user || null);
      } catch (error) {
        if (isDev) console.warn("[AUTH] Session restore failed:", error.response?.status);
        localStorage.removeItem("pp_token");
        localStorage.removeItem("pp_user");
        if (active) setUser(null);
      } finally {
        if (active) {
          setLoading(false);
          setAuthReady(true);
          const startedAt =
            typeof window !== "undefined" ? window.__pp_auth_hydration_startedAt : undefined;
          if (isDev && typeof startedAt === "number") {
            console.log(`[AUTH] Hydration complete in ${Date.now() - startedAt}ms`);
          } else if (isDev) {
            console.log(`[AUTH] Hydration complete`);
          }
        }
      }
    };

    restoreSession();
    return () => {
      active = false;
    };
  }, [persistUser]);

  const login = useCallback(
    async (identifier, password) => {
      const payload = { identifier: identifier.trim(), password };

      if (isDev) console.log("[AUTH] Login request payload:", { identifier: payload.identifier });

      const { data } = await api.post("/auth/login", payload);

      if (isDev) console.log("[AUTH] Login response success:", data.success);

      if (!data.success) {
        throw new Error(data.message || "Login failed");
      }

      clearAllCachedQueries();
      localStorage.setItem("pp_token", data.token);
      persistUser(data.user);
      return data.user;
    },
    [persistUser]
  );

  const register = useCallback(
    async (name, username, email, password, role, patient_id) => {
      const { data } = await api.post("/auth/register", {
        name,
        username,
        email,
        password,
        role,
        patient_id,
      });

      if (!data.success) {
        throw new Error(data.message || "Registration failed");
      }

      clearAllCachedQueries();
      localStorage.setItem("pp_token", data.token);
      persistUser(data.user);
      return data.user;
    },
    [persistUser]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("pp_token");
    clearAllCachedQueries();
    persistUser(null);
  }, [persistUser]);

  const updateProfile = useCallback(
    async (updates) => {
      const { data } = await api.patch("/auth/me", updates);
      if (data?.user) persistUser(data.user);
      return data;
    },
    [persistUser]
  );

  const changePassword = useCallback(async ({ currentPassword, newPassword, confirmPassword }) => {
    const { data } = await api.post("/auth/change-password", {
      currentPassword,
      newPassword,
      confirmPassword,
    });
    return data;
  }, []);

  const contextValue = useMemo(
    () => ({
      user,
      login,
      register,
      logout,
      updateProfile,
      changePassword,
      loading, // auth hydration in progress
      authReady, // hydration complete (token checked / /auth/me attempted)
      syncUser: persistUser,
    }),
    [user, login, register, logout, updateProfile, changePassword, loading, authReady, persistUser]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

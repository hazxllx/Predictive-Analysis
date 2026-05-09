import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";
import { clearAllCachedQueries } from "../api/queryCache";

const AuthContext = createContext();

export const getRoleHome = (role) => {
  if (role === "admin") return "/admin-dashboard";
  return "/my-dashboard"; // patient
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const persistUser = (nextUser) => {
    if (nextUser) {
      localStorage.setItem("pp_user", JSON.stringify(nextUser));
    } else {
      localStorage.removeItem("pp_user");
    }

    setUser(nextUser);
  };

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
        }
        return;
      }

      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (active) {
            setUser(parsedUser);
          }
        } catch {
          localStorage.removeItem("pp_user");
        }
      }

      try {
        const { data } = await api.get("/auth/me");
        if (active) {
          persistUser(data?.user || null);
        }
      } catch (error) {
        localStorage.removeItem("pp_token");
        localStorage.removeItem("pp_user");
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      active = false;
    };
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    clearAllCachedQueries();
    localStorage.setItem("pp_token", data.token);
    persistUser(data.user);
    return data.user;
  };

  const register = async (name, email, password, role, patient_id) => {
    const { data } = await api.post("/auth/register", { name, email, password, role, patient_id });
    clearAllCachedQueries();
    localStorage.setItem("pp_token", data.token);
    persistUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("pp_token");
    clearAllCachedQueries();
    persistUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, syncUser: persistUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

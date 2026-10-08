import { useCallback, useEffect, useMemo, useState } from "react";

import apiRequest from "../api/client";
import AuthContext from "./auth.context";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let isActive = true;

    apiRequest("/api/auth/me")
      .then((data) => {
        if (!isActive) return;
        setUser(data.user);
        setStatus("authenticated");
      })
      .catch(() => {
        if (!isActive) return;
        setUser(null);
        setStatus("unauthenticated");
      });

    return () => {
      isActive = false;
    };
  }, []);

  const login = useCallback(async (email, password, rememberMe) => {
    const data = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, rememberMe: rememberMe }),
    });

    setUser(data.user);
    setStatus("authenticated");

    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const value = useMemo(
    () => ({ user, status, login, logout }),
    [user, status, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;

import { useCallback, useEffect, useMemo, useState } from "react";

import apiRequest from "../api/client";
import AuthContext from "./auth.context";
import { createPermissionChecker } from "../utils/permissions";

function normalizeUser(raw) {
  if (!raw) return null;

  const employee = raw.employee ?? {};
  const roles = raw.roles ?? employee.roles ?? [];
  const permissions = raw.permissions ?? employee.permissions ?? [];
  const isSuperadmin =
    raw.isSuperadmin ??
    raw.isGlobalSuperadmin ??
    employee.isSuperadmin ??
    roles.includes("superadmin");

  return {
    ...raw,
    roles,
    permissions,
    isSuperadmin,
    employee: {
      ...employee,
      roles,
      permissions,
    },
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let isActive = true;

    apiRequest("/api/auth/me")
      .then((data) => {
        if (!isActive) return;
        setUser(normalizeUser(data.user));
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

    const normalized = normalizeUser(data.user);
    setUser(normalized);
    setStatus("authenticated");

    return normalized;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const refresh = useCallback(async () => {
    setStatus((current) => (current === "authenticated" ? current : "loading"));

    try {
      const data = await apiRequest("/api/auth/me");
      const normalized = normalizeUser(data.user);
      setUser(normalized);
      setStatus("authenticated");
      return normalized;
    } catch (err) {
      setUser(null);
      setStatus("unauthenticated");
      throw err;
    }
  }, []);

  const hasPermission = useCallback(
    (permission) => {
      if (!permission) return true;
      if (!user) return false;

      const isSuperadmin =
        user.isSuperadmin ||
        user.isGlobalSuperadmin ||
        (user.roles ?? []).includes("superadmin");

      return createPermissionChecker(
        user.permissions ?? user.employee?.permissions,
        isSuperadmin
      )(permission);
    },
    [user]
  );

  const hasAnyPermission = useCallback(
    (permissions) => {
      if (!permissions || permissions.length === 0) return true;
      return permissions.some((name) => hasPermission(name));
    },
    [hasPermission]
  );

  const isSuperadmin = user?.isSuperadmin || user?.isGlobalSuperadmin || (user?.roles ?? []).includes("superadmin") || false;

  const value = useMemo(
    () => ({ user, status, login, logout, refresh, hasPermission, hasAnyPermission, isSuperadmin }),
    [user, status, login, logout, refresh, hasPermission, hasAnyPermission, isSuperadmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;

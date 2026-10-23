import { Navigate, Outlet, useLocation } from "react-router-dom";

import useAuth from "../contexts/useAuth";
import { getDefaultRouteForUser } from "../utils/permissions";

export default function ProtectedRoute() {
  const { status } = useAuth();

  if (status === "loading") {
    return null;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function RequireAccountType({ accountType, children }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return null;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const currentAccountType =
    user?.accountType ?? (user?.resident ? "resident" : "employee");

  if (currentAccountType !== accountType) {
    return <Navigate to={getDefaultRouteForUser(user)} replace />;
  }

  if (children) return children;

  return <Outlet />;
}

export function RequirePermission({ permission, children }) {
  const { status, hasPermission } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return null;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/unauthorized" replace state={{ from: location.pathname }} />;
  }

  if (children) return children;

  return <Outlet />;
}

import { Navigate, Outlet } from "react-router-dom";

import useAuth from "../contexts/useAuth";

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

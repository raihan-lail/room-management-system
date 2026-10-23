import { useNavigate } from "react-router-dom";

import useAuth from "../contexts/useAuth";
import { getDefaultRouteForUser } from "../utils/permissions";

export default function Unauthorized() {
  const navigate = useNavigate();
  const { status, user } = useAuth();

  if (status === "loading") {
    return null;
  }

  const homeRoute = getDefaultRouteForUser(user);

  return (
    <div>
      <div className="not-found">
        <div className="not-found__card">
          <span className="not-found__code">403</span>

          <h1 className="not-found__title">Access denied</h1>

          <p className="not-found__description">
            You do not have permission to view this page. Contact your
            administrator if you need access.
          </p>

          <div className="not-found__actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(homeRoute, { replace: true })}
            >
              <i className="bi bi-house" aria-hidden="true" />
              Go to home page
            </button>

            <button
              type="button"
              className="btn btn-neutral"
              onClick={() => navigate(-1)}
            >
              <i className="bi bi-arrow-left" aria-hidden="true" />
              Go back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

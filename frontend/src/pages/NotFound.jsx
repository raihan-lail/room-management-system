import { useLocation, useNavigate } from "react-router-dom";


export default function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div>
      <div className="not-found">
        <div className="not-found__card">
          <span className="not-found__code">404</span>

          <h1 className="not-found__title">Page not found</h1>

          <p className="not-found__description">
            The page you are looking for does not exist or may have been moved.
          </p>

          <p className="not-found__path">
            {location.pathname}
          </p>

          <div className="not-found__actions">
           

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

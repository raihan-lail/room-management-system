import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import useAuth from "../../contexts/useAuth";
import {
  getDefaultRoute,
  getDefaultRouteForUser,
} from "../../utils/permissions";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { status, login, hasPermission } = useAuth();
  const navigate = useNavigate();

  if (status === "loading") {
    return null;
  }

  if (status === "authenticated") {
    return <Navigate to={getDefaultRoute(hasPermission)} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const loggedInUser = await login(email, password, rememberMe);
      navigate(getDefaultRouteForUser(loggedInUser), { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-wrapper">
        <div className="login-card login-card-branded">
          <p className="app-title">
            INTERACTIVE MOCKUP DESIGN FOR ROOM/CAMP MANAGEMENT SYSTEMS
          </p>
          <h1 className="login-title">LOGIN</h1>

          <form className="login-form" onSubmit={handleSubmit}>
            <p>Enter your email and password to login.</p>
            <label className="form-field">
              <span>Email</span>
              <input
                type="email"
                required
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Password</span>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="********"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  <i
                    className={`bi ${
                      showPassword ? "bi-eye-slash-fill" : "bi-eye-fill"
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </label>

            {error ? <p className="error-text">{error}</p> : null}

            <div className="auth-links">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>

              <a href="/forgot-password" className="forgot-password-link">
                Forgot Password?
              </a>
            </div>

            <button type="submit" disabled={submitting}>
              {submitting ? "logging in..." : "login"}
            </button>
          </form>
        </div>

        <div className="login-image-wrapper">
          <img src="/logo.png" alt="" className="login-image" />
        </div>
      </div>
    </div>
  );
}

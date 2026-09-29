import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    // Add your auth/API logic here if needed
    navigate("/dashboard");
  };

  return (
    <div className="login-page">
      <div className="login-wrapper">

      <div className="login-card login-card-branded">
       
        <p className="app-title">INTERACTIVE MOCKUP DESIGN FOR ROOM/CAMP MANAGEMENT SYSTEMS</p>
        <h1 className="login-title">LOGIN</h1>

        <form className="login-form" onSubmit={handleSubmit}>
          <p>Enter random email and password for login.</p>
          <label className="form-field">
            <span>Email</span>
            <input
              type="email"
              required
              placeholder="you@example.com"
            />
          </label>

          <label className="form-field">
            <span>Password</span>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="********"
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

          <div className="auth-links">
            <label className="remember-me">
              <input type="checkbox" />
              <span>Remember me</span>
            </label>

            <a href="/forgot-password" className="forgot-password-link">
              Forgot Password?
            </a>
          </div>

          <button type="submit">login</button>
        </form>
       

       
      </div>

      <div className="login-image-wrapper">
        <img src="/logo.png" alt="" className="login-image" />
      </div>
      </div>
    </div>
  );
}
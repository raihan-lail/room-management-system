import { useState } from "react";


export default function ForgotPassword() {
 
  const [email, setEmail] = useState("");
 
  return (
    <div className="login-page">
      <div className="login-wrapper">
        <div className="login-card login-card-branded">
          <div className="login-heading">
            <h1 className="login-title">Forgot Password</h1>
            <p className="login-subtitle">
              Enter your email so we can send verification email to you.
            </p>
          </div>

          <form className="login-form" >
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

            <div className="auth-links">
            

              <a href="/login" className="forgot-password-link">
                Back to login page
              </a>
            </div>

            <button type="submit" >
              send verification email
            </button>
          </form>
       
        </div>

        <aside className="login-brand-panel">
          <img
            src="/logo-white.png"
            alt="Room Management System"
            className="login-brand-logo"
          />
          <p className="login-brand-text">Camp Management System</p>
        </aside>
      </div>
    </div>
  );
}

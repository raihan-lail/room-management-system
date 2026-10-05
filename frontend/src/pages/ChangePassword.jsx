import { useState } from "react";
import MainLayout from "../components/MainLayout";

const PASSWORD_RULES = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (value) => value.length >= 8,
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    test: (value) => /[a-z]/.test(value),
  },
  {
    id: "number",
    label: "One number",
    test: (value) => /[0-9]/.test(value),
  },
];

export default function ChangePassword() {
  const [values, setValues] = useState({
    current: "",
    new: "",
    confirm: "",
  });

  const [visible, setVisible] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [errors, setErrors] = useState({});
  const [isDone, setIsDone] = useState(false);

  const ruleResults = PASSWORD_RULES.map((rule) => ({
    ...rule,
    isMet: rule.test(values.new),
  }));

  const isNewValid = ruleResults.every((rule) => rule.isMet);

  const handleChange = (field) => (event) => {
    const { value } = event.target;

    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined, form: undefined }));
  };

  const handleToggle = (field) => () => {
    setVisible((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleCancel = () => {
    setValues({ current: "", new: "", confirm: "" });
    setVisible({ current: false, new: false, confirm: false });
    setErrors({});
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextErrors = {};

    if (!values.current) {
      nextErrors.current = "Enter your current password.";
    }

    if (!values.new) {
      nextErrors.new = "Enter a new password.";
    } else if (!isNewValid) {
      nextErrors.new = "Password does not meet all the requirements.";
    } else if (values.new === values.current) {
      nextErrors.new = "New password must be different from the current one.";
    }

    if (!values.confirm) {
      nextErrors.confirm = "Confirm your new password.";
    } else if (values.confirm !== values.new) {
      nextErrors.confirm = "Passwords do not match.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length === 0) {
      // Add your auth/API logic here if needed
      setIsDone(true);
    }
  };

  const renderField = (field, label, placeholder, autoComplete) => (
    <label className="form-field">
      <span>{label}</span>

      <div className="password-input-wrapper">
        <input
          type={visible[field] ? "text" : "password"}
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={values[field]}
          onChange={handleChange(field)}
          aria-invalid={Boolean(errors[field])}
        />

        <button
          type="button"
          className="password-toggle"
          onClick={handleToggle(field)}
          aria-label={visible[field] ? `Hide ${label}` : `Show ${label}`}
          aria-pressed={visible[field]}
        >
          <i
            className={`bi ${
              visible[field] ? "bi-eye-slash-fill" : "bi-eye-fill"
            }`}
            aria-hidden="true"
          />
        </button>
      </div>

      {errors[field] && <p className="error-text">{errors[field]}</p>}
    </label>
  );

  return (
    <MainLayout>
      <div className="dashboard">
        {/* HEADER */}
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Change Password</h1>

            <p className="dashboard-header__subtitle">
              Change your current password with a new one.
            </p>
          </div>
        </div>

        {isDone ? (
          <section className="table-card content">
            <div className="form-done">
              <i
                className="bi bi-check-circle form-done__icon"
                aria-hidden="true"
              />

              <p className="form-done__title">Password updated</p>

              <p className="form-done__caption">
                Your password has been changed. Use the new password the next
                time you sign in.
              </p>

              <div className="form-done__actions">
                <button
                  type="button"
                  className="btn btn-neutral"
                  onClick={() => {
                    setIsDone(false);
                    handleCancel();
                  }}
                >
                  Change Again
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="table-card content">
            <div className="detail-card__head">
              <h2 className="detail-card__title">Account Security</h2>

              <p className="detail-card__caption">
                Pick a password you do not use anywhere else
              </p>
            </div>

            <form className="form-stack password-form" onSubmit={handleSubmit}>
              {renderField(
                "current",
                "Current Password",
                "Enter current password",
                "current-password",
              )}

              {renderField(
                "new",
                "New Password",
                "Enter new password",
                "new-password",
              )}

              {/* PASSWORD REQUIREMENTS */}
              <ul className="password-rules">
                {ruleResults.map((rule) => (
                  <li
                    key={rule.id}
                    className={`password-rule ${
                      rule.isMet ? "is-met" : ""
                    }`}
                  >
                    <i
                      className={`bi ${
                        rule.isMet ? "bi-check-circle-fill" : "bi-circle"
                      }`}
                      aria-hidden="true"
                    />

                    <span>{rule.label}</span>
                  </li>
                ))}
              </ul>

              {renderField(
                "confirm",
                "Confirm New Password",
                "Repeat new password",
                "new-password",
              )}

              {errors.form && <p className="error-text">{errors.form}</p>}

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-neutral"
                  onClick={handleCancel}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!values.current || !isNewValid || !values.confirm}
                >
                  <i className="bi bi-check-lg" aria-hidden="true" />
                  Update Password
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </MainLayout>
  );
}
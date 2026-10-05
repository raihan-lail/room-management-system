import { useState } from "react";

const DEFAULT_TEXTAREA_ROWS = 3;

function normalizeOption(option) {
  if (option && typeof option === "object") {
    return { value: option.value, label: option.label ?? option.value };
  }

  return { value: option, label: option };
}


function buildInitialValues(fields, initialValues) {
  return fields.reduce((values, field) => {
    const provided = initialValues?.[field.name];

    if (provided !== undefined) {
      values[field.name] = provided;

      return values;
    }

    if (field.defaultValue !== undefined) {
      values[field.name] = field.defaultValue;

      return values;
    }

    if (field.type === "select") {
      const [first] = field.options ?? [];

      values[field.name] = normalizeOption(first).value ?? "";

      return values;
    }

    values[field.name] = "";

    return values;
  }, {});
}

function ModalField({ field, value, onChange }) {
  const handleChange = (event) => {
    onChange(field.name, event.target.value);
  };

  let control;

  if (field.type === "select") {
    control = (
      <select
        value={value}
        onChange={handleChange}
        required={field.required}
      >
        {(field.options ?? []).map((option) => {
          const { value: optionValue, label } = normalizeOption(option);

          return (
            <option key={optionValue} value={optionValue}>
              {label}
            </option>
          );
        })}
      </select>
    );
  } else if (field.type === "textarea") {
    control = (
      <textarea
        rows={field.rows ?? DEFAULT_TEXTAREA_ROWS}
        value={value}
        onChange={handleChange}
        placeholder={field.placeholder}
        required={field.required}
      />
    );
  } else {
    control = (
      <input
        type={field.type ?? "text"}
        value={value}
        onChange={handleChange}
        placeholder={field.placeholder}
        readOnly={field.readOnly}
        required={field.required}
      />
    );
  }

  return (
    <label className="form-field">
      <span>{field.label}</span>

      {control}
    </label>
  );
}

export default function AddModal({
  title,
  submitLabel = "Save",
  fields = [],
  initialValues,
  onClose,
  onSubmit,
}) {
  const [values, setValues] = useState(() =>
    buildInitialValues(fields, initialValues),
  );

  const handleChange = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    onSubmit({ ...values });

    onClose();
  };

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>

          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        <form className="modal__form" onSubmit={handleSubmit}>
          {fields.map((field) => (
            <ModalField
              key={field.name}
              field={field}
              value={values[field.name] ?? ""}
              onChange={handleChange}
            />
          ))}

          <div className="modal__actions">
            <button
              type="button"
              className="btn btn-neutral"
              onClick={onClose}
            >
              Cancel
            </button>

            <button type="submit" className="btn btn-primary">
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

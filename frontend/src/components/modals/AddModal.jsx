import { useState } from "react";
import { toFormValues } from "./addFormSchemas";

const DEFAULT_TEXTAREA_ROWS = 3;

const EDIT_SUBMIT_LABEL = "Save Changes";

function normalizeOption(option) {
  if (option && typeof option === "object") {
    return { value: option.value, label: option.label ?? option.value };
  }

  return { value: option, label: option };
}

/*
 * Options can be a plain list or a function of the
 * current form values, so a field such as Floor can
 * depend on a field such as Location.
 */
function resolveOptions(field, values = {}) {
  if (typeof field.options === "function") {
    return field.options(values) ?? [];
  }

  return field.options ?? [];
}

/*
 * Every add and edit form is described by a plain
 * field list, so this modal only has to render inputs
 * and hand the raw values back to the page that
 * opened it.
 */
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
      const [first] = resolveOptions(field, values);

      values[field.name] = normalizeOption(first).value ?? "";

      return values;
    }

    values[field.name] = "";

    return values;
  }, {});
}

function SearchableSelect({ field, value, values, onChange }) {
  const [query, setQuery] = useState("");

  const options = resolveOptions(field, values).map(normalizeOption);
  const search = query.trim().toLowerCase();

  const filteredOptions = search
    ? options.filter(
        (option) =>
          option.label.toLowerCase().includes(search) ||
          String(option.value).toLowerCase().includes(search),
      )
    : options;

  const selectedOption = options.find(
    (option) => option.value === value,
  );

  // Keep the current selection visible even when the
  // search text filters every other option out.
  const visibleOptions =
    selectedOption &&
    !filteredOptions.some((option) => option.value === value)
      ? [selectedOption, ...filteredOptions]
      : filteredOptions;

  return (
    <>
      <div className="form-field__search">
        <i className="bi bi-search" aria-hidden="true" />

        <input
          type="search"
          value={query}
          placeholder={field.searchPlaceholder ?? "Search..."}
          aria-label={`Search ${field.label}`}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <select
        value={value}
        onChange={(event) => onChange(field.name, event.target.value)}
        required={field.required}
      >
        <option value="">
          {field.placeholderOption ?? "Select..."}
        </option>

        {visibleOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );
}

export function ModalField({ field, value, values = {}, onChange }) {
  const handleChange = (event) => {
    onChange(field.name, event.target.value);
  };

  let control;

  if (field.type === "select" && field.searchable) {
    control = (
      <SearchableSelect
        field={field}
        value={value}
        values={values}
        onChange={onChange}
      />
    );
  } else if (field.type === "select") {
    control = (
      <select
        value={value}
        onChange={handleChange}
        required={field.required}
      >
        {resolveOptions(field, values).map((option) => {
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

  const content = (
    <>
      <span>{field.label}</span>

      {control}
    </>
  );

  if (field.type === "select" && field.searchable) {
    return <div className="form-field">{content}</div>;
  }

  return <label className="form-field">{content}</label>;
}

export default function AddModal({
  schema,
  mode = "add",
  initialValues,
  onClose,
  onSubmit,
}) {
  const isEdit = mode === "edit";

  const title = isEdit ? `Edit ${schema.entity}` : schema.title;
  const submitLabel = isEdit ? EDIT_SUBMIT_LABEL : schema.submitLabel;

  const [values, setValues] = useState(() =>
    buildInitialValues(
      schema.fields,
      initialValues ? toFormValues(schema, initialValues) : undefined,
    ),
  );

  const handleChange = (name, value) => {
    setValues((prev) => {
      const next = { ...prev, [name]: value };

      // Keep dependent selects valid when their source changes.
      schema.fields.forEach((field) => {
        if (field.type !== "select" || typeof field.options !== "function") {
          return;
        }

        if (field.name === name) return;

        const allowed = resolveOptions(field, next).map(
          (option) => normalizeOption(option).value,
        );

        if (!allowed.includes(next[field.name])) {
          next[field.name] = allowed[0] ?? "";
        }
      });

      return next;
    });
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
          {schema.fields.map((field) => (
            <ModalField
              key={field.name}
              field={field}
              value={values[field.name] ?? ""}
              values={values}
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

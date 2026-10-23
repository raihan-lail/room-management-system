import { useMemo, useState } from "react";
import apiRequest from "../../api/client";

const MODES = [
  { id: "all", label: "All data" },
  { id: "filtered", label: "Filtered data" },
];

function buildInitialFilters(filterFields, initialFilters) {
  return filterFields.reduce((values, field) => {
    const provided = initialFilters?.[field.name];

    values[field.name] =
      provided !== undefined ? provided : (field.defaultValue ?? "");

    return values;
  }, {});
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function ExportModal({
  title = "Export Data",
  endpoint,
  filename = "export.xlsx",
  entityLabel = "records",
  filterFields = [],
  initialFilters = {},
  onClose,
  onExported,
}) {
  const [mode, setMode] = useState("all");
  const [filters, setFilters] = useState(() =>
    buildInitialFilters(filterFields, initialFilters)
  );
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const activeFilterCount = useMemo(
    () =>
      filterFields.filter((field) => {
        const value = filters[field.name];

        return value !== undefined && value !== null && String(value).trim() !== "";
      }).length,
    [filterFields, filters]
  );

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setError("");
    setDone(false);
  };

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
    setError("");
    setDone(false);
  };

  const handleExport = async (event) => {
    event.preventDefault();

    if (exporting) return;

    if (mode === "filtered" && activeFilterCount === 0) {
      setError("Set at least one filter or choose all data.");
      return;
    }

    const params = new URLSearchParams();

    if (mode === "filtered") {
      for (const field of filterFields) {
        const value = filters[field.name];

        if (value === undefined || value === null) continue;

        const text = String(value).trim();

        if (text) {
          params.set(field.name, text);
        }
      }
    }

    const query = params.toString();

    setExporting(true);
    setError("");
    setDone(false);

    try {
      const blob = await apiRequest(
        `${endpoint}${query ? `?${query}` : ""}`,
        {
          method: "GET",
          responseType: "blob",
        }
      );

      downloadBlob(
        blob,
        typeof filename === "function" ? filename() : filename
      );

      setDone(true);
      onExported?.(mode);
    } catch (err) {
      setError(err.message || "Failed to export records.");
    } finally {
      setExporting(false);
    }
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

        <form className="modal__form" onSubmit={handleExport}>
          <div className="modal__section">
            <p className="modal__section-title">Export range</p>

            <div
              className="modal__options"
              role="group"
              aria-label="Export range"
            >
              {MODES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={mode === option.id}
                  className={`modal__option ${mode === option.id ? "is-active" : ""}`}
                  onClick={() => handleModeChange(option.id)}
                  disabled={exporting}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <span className="import-template__hint">
              {mode === "all"
                ? `Export every ${entityLabel} you can access.`
                : "Export only records matching the filters below."}
            </span>
          </div>

          {mode === "filtered" && (
            <div className="modal__section">
              <p className="modal__section-title">Filters</p>

              {filterFields.map((field) => (
                <label key={field.name} className="form-field">
                  <span>{field.label}</span>

                  {field.type === "select" ? (
                    <select
                      value={filters[field.name] ?? ""}
                      onChange={(event) =>
                        handleFilterChange(field.name, event.target.value)
                      }
                      disabled={exporting}
                    >
                      {field.placeholderOption && (
                        <option value="">{field.placeholderOption}</option>
                      )}

                      {(field.options ?? []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type ?? "text"}
                      value={filters[field.name] ?? ""}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        handleFilterChange(field.name, event.target.value)
                      }
                      disabled={exporting}
                    />
                  )}
                </label>
              ))}
            </div>
          )}

          {error && (
            <div className="import-message import-message--error" role="alert">
              {error}
            </div>
          )}

          {done && (
            <div className="import-message import-message--success" role="status">
              Export downloaded successfully.
            </div>
          )}

          <div className="modal__actions">
            <button
              type="button"
              className="btn btn-neutral"
              onClick={onClose}
              disabled={exporting}
            >
              Close
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={exporting}
            >
              {exporting ? "Exporting..." : "Export Excel"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

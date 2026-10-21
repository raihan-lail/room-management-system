import { useState } from "react";
import apiRequest from "../../api/client";

const TEMPLATE_PATH = "/excel/room_import_template.xlsx";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function ImportRoomsModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [rowErrors, setRowErrors] = useState([]);
  const [result, setResult] = useState(null);

  const handleFileChange = (event) => {
    setFile(event.target.files?.[0] ?? null);
    setError("");
    setRowErrors([]);
    setResult(null);
  };

  const handleImport = async (event) => {
    event.preventDefault();

    if (!file || importing) return;

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("Only .xlsx files are supported.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("The file must be 5 MB or smaller.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setImporting(true);
    setError("");
    setRowErrors([]);
    setResult(null);

    try {
      const response = await apiRequest("/api/rooms/import", {
        method: "POST",
        body: formData,
      });

      setResult(response);
      setFile(null);
      onImported();
    } catch (err) {
      setError(err.message || "Failed to import rooms.");
      setRowErrors(Array.isArray(err.data?.errors) ? err.data.errors : []);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Bulk Import Rooms"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <h2 className="modal__title">Bulk Import Rooms</h2>

          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        <form className="modal__form" onSubmit={handleImport}>
          <div className="import-template">
            <div className="import-template__text">
              <span className="import-template__title">Excel template</span>
              <span className="import-template__hint">
                Download the template, add your rooms, then upload the
                completed .xlsx file.
              </span>
            </div>

            <a
              className="btn btn-neutral"
              href={TEMPLATE_PATH}
              download
            >
              <i className="bi bi-download" aria-hidden="true" />
              Download Template
            </a>
          </div>

          <label className="form-field">
            <span>Excel file (.xlsx)</span>
            <input
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              disabled={importing}
            />
          </label>

          {file && (
            <p className="import-file">
              <i className="bi bi-file-earmark-excel" aria-hidden="true" />
              {file.name}
            </p>
          )}

          {error && (
            <div className="import-message import-message--error" role="alert">
              {error}
            </div>
          )}

          {rowErrors.length > 0 && (
            <div className="import-errors">
              <p className="import-errors__title">
                {rowErrors.length} row error(s)
              </p>

              <ul className="import-errors__list">
                {rowErrors.map((rowError, index) => (
                  <li key={`${rowError.row}-${index}`}>
                    Row {rowError.row}
                    {rowError.roomName ? ` (${rowError.roomName})` : ""}:{" "}
                    {rowError.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result && (
            <div className="import-message import-message--success" role="status">
              {result.importedRooms} room(s) and {result.importedBeds} bed(s)
              imported successfully.
            </div>
          )}

          <div className="modal__actions">
            <button
              type="button"
              className="btn btn-neutral"
              onClick={onClose}
              disabled={importing}
            >
              Close
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={!file || importing}
            >
              {importing ? "Importing..." : "Import Rooms"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

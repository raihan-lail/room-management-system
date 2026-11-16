import { useState } from "react";
import ImportModal from "./ImportModal";

const IMPORT_OPTIONS = {
  existing: {
    title: "Import bookings for existing residents",
    templatePath: "/excel/booking_import_template.xlsx",
    templateTitle: "Existing resident template",
    templateHint: "Use an active resident’s email. Status defaults to CONFIRMED when left blank.",
    endpoint: "/api/booking/import/existing-residents",
  },
  addResidents: {
    title: "Import bookings and add new residents",
    templatePath: "/excel/resident_booking_template.xlsx",
    templateTitle: "Resident and booking template",
    templateHint: "Rows can match existing residents or create new resident accounts. Status defaults to CONFIRMED when left blank.",
    endpoint: "/api/booking/import",
  },
};

export default function BookingImportModal({ onClose, onImported }) {
  const [option, setOption] = useState("");

  if (option) {
    const selected = IMPORT_OPTIONS[option];
    return (
      <ImportModal
        title={selected.title}
        templatePath={selected.templatePath}
        templateTitle={selected.templateTitle}
        templateHint={selected.templateHint}
        endpoint={selected.endpoint}
        entityLabel="bookings"
        onClose={onClose}
        onImported={onImported}
      />
    );
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-import-options-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <h2 className="modal__title" id="booking-import-options-title">Bulk Import Bookings</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
        <div className="modal__form">
          <p className="modal__message">Choose how this import should handle resident accounts.</p>
          <div className="modal__actions">
            <button type="button" className="btn btn-neutral" onClick={() => setOption("existing")}>
              Existing residents
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setOption("addResidents")}>
              Add new residents
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

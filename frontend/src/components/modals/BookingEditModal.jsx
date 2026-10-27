import { useEffect, useMemo, useState } from "react";
import apiRequest from "../../api/client";
import { ModalField } from "./AddModal";

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export default function BookingEditModal({ booking, onClose, onUpdated }) {
  const [residents, setResidents] = useState([]);
  const [beds, setBeds] = useState([]);
  const [values, setValues] = useState({
    residentId: booking.residentId ?? booking.resident?.id ?? "",
    bedId: booking.bedId ?? booking.bed?.id ?? "",
    startedAt: toDateInput(booking.startedAt),
    endedAt: toDateInput(booking.endedAt),
    notes: booking.notes ?? "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest("/api/resident?pageSize=100"),
      apiRequest("/api/bed?pageSize=100"),
    ])
      .then(([residentResponse, bedResponse]) => {
        if (!active) return;
        setResidents(Array.isArray(residentResponse?.residents) ? residentResponse.residents : []);
        setBeds(Array.isArray(bedResponse?.beds) ? bedResponse.beds : []);
      })
      .catch((err) => {
        if (active) setError(err.message || "Failed to load booking options.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const residentOptions = useMemo(() => {
    const list = [...residents];
    const currentResident = booking.resident;
    if (currentResident?.id && !list.some((resident) => resident.id === currentResident.id)) {
      list.push(currentResident);
    }
    return list.map((resident) => ({
      value: resident.id,
      label: resident.user?.email
        ? `${resident.fullName} · ${resident.user.email}`
        : resident.fullName,
    }));
  }, [booking.resident, residents]);

  const bedOptions = useMemo(() => {
    const list = beds.filter((bed) => bed.isActive !== false && bed.room?.isBookable !== false);
    const currentBed = booking.bed;
    if (currentBed?.id && !list.some((bed) => bed.id === currentBed.id)) list.push(currentBed);
    return list.map((bed) => ({
      value: bed.id,
      label: `${bed.room?.name ?? "Room"} · ${bed.name}`,
    }));
  }, [beds, booking.bed]);

  const handleChange = (name, value) => setValues((current) => ({ ...current, [name]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!values.residentId || !values.bedId || !values.startedAt || !values.endedAt) {
      setError("Complete all required booking fields.");
      return;
    }
    if (values.startedAt >= values.endedAt) {
      setError("The end date must be after the start date.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      await apiRequest(`/api/booking/${booking.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          residentId: values.residentId,
          bedId: values.bedId,
          startedAt: new Date(`${values.startedAt}T00:00:00.000Z`).toISOString(),
          endedAt: new Date(`${values.endedAt}T00:00:00.000Z`).toISOString(),
          notes: values.notes,
        }),
      });
      await onUpdated();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to update booking.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={() => !isSaving && onClose()}>
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-booking-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <h2 className="modal__title" id="edit-booking-title">Edit Booking</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close" disabled={isSaving}>
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>
        <form className="modal__form" onSubmit={handleSubmit}>
          {isLoading ? (
            <p className="muted">Loading booking options...</p>
          ) : (
            <div className="modal__grid">
              <ModalField
                field={{ name: "residentId", label: "Resident", type: "select", options: residentOptions, required: true }}
                value={values.residentId}
                onChange={handleChange}
              />
              <ModalField
                field={{ name: "bedId", label: "Bed", type: "select", options: bedOptions, required: true }}
                value={values.bedId}
                onChange={handleChange}
              />
              <ModalField field={{ name: "startedAt", label: "Start Date", type: "date", required: true }} value={values.startedAt} onChange={handleChange} />
              <ModalField field={{ name: "endedAt", label: "End Date", type: "date", required: true }} value={values.endedAt} onChange={handleChange} />
              <ModalField field={{ name: "notes", label: "Notes", type: "textarea" }} value={values.notes} onChange={handleChange} />
            </div>
          )}
          {error && <p className="error-message" role="alert">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn-neutral" onClick={onClose} disabled={isSaving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isLoading || isSaving}>{isSaving ? "Saving..." : "Save Changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

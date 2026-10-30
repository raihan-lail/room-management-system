import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../components/MainLayout";
import apiRequest from "../../api/client";
import { submitResidentComplaint } from "../../api/complaints";

const COMPLAINT_TYPES = [
  "Cleaning", "Air Conditioning", "Plumbing", "Electrical", "Wi-Fi & Network",
  "Amenities", "Noise Complaint", "Maintenance", "Pest Control",
];

export default function BookingComplaints() {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest(`/api/resident-portal/bookings/${encodeURIComponent(bookingId)}`)
      .then((response) => { if (active) setBooking(response?.data ?? null); })
      .catch((requestError) => { if (active) setError(requestError.message || "Failed to load booking."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookingId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!category || !description.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await submitResidentComplaint(bookingId, {
        title: `${category} complaint`,
        category,
        description: description.trim(),
      });
      navigate(`/resident/complaints/${response?.data?.id}`, { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Failed to submit complaint.");
    } finally {
      setSubmitting(false);
    }
  };

  const room = booking?.bed?.room?.name;
  const isActive = booking?.status === "IN_HOUSE" || booking?.status === "HOME_LEAVE";

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Submit a complaint</h1>
            <p className="dashboard-header__subtitle">Booking {booking?.bookingNumber || ""}</p>
          </div>
          <button type="button" className="btn btn-neutral" onClick={() => navigate("/resident/history")}>
            <i className="bi bi-arrow-left" aria-hidden="true" /> Back to History
          </button>
        </div>

        {error && <p className="muted" role="alert">{error}</p>}
        {loading ? <section className="table-card content">Loading booking...</section> : !booking ? (
          <section className="table-card content">Booking not found.</section>
        ) : !isActive ? (
          <section className="table-card content">
            <p>Complaints can be submitted for a current stay.</p>
            <button type="button" className="btn btn-neutral" onClick={() => navigate("/resident/complaints")}>View my complaints</button>
          </section>
        ) : (
          <>
            <section className="room-summary">
              <div className="room-summary__text">
                <p className="room-summary__label">Room</p>
                <h2 className="room-summary__name">{room || "-"}</h2>
                <p className="room-summary__location">{booking.bed?.name || ""} · {booking.bookingNumber}</p>
              </div>
              <span className="booking-status booking-status--in-house">{booking.status.replaceAll("_", " ")}</span>
            </section>

            <section className="table-card content">
              <div className="detail-card__head">
                <h2 className="detail-card__title">Complaint details</h2>
                <p className="detail-card__caption">Choose a category and describe the issue. You can continue the conversation after submitting.</p>
              </div>
              <form className="form-stack" onSubmit={handleSubmit}>
                <label className="form-field">
                  <span>Category</span>
                  <select value={category} onChange={(event) => setCategory(event.target.value)} required>
                    <option value="">Select a category</option>
                    {COMPLAINT_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label className="form-field">
                  <span>Description</span>
                  <textarea rows="5" placeholder="Describe the issue and where or when it happens..." value={description} onChange={(event) => setDescription(event.target.value)} required />
                </label>
                <div className="form-actions">
                  <button type="button" className="btn btn-neutral" onClick={() => navigate("/resident/history")}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting || !category || !description.trim()}>
                    {submitting ? "Submitting..." : "Submit complaint"}
                  </button>
                </div>
              </form>
            </section>
          </>
        )}
      </div>
    </MainLayout>
  );
}

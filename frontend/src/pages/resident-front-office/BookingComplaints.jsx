import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchComplaintFeedback, submitComplaintFeedback } from "../../api/complaints";

const COMPLAINT_TYPES = [
  "Cleaning", "Air Conditioning", "Plumbing", "Electrical", "Wi-Fi & Network",
  "Amenities", "Noise Complaint", "Maintenance", "Pest Control",
];

export default function BookingComplaints() {
  const { bookingId, token } = useParams();
  const [booking, setBooking] = useState(null);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchComplaintFeedback(bookingId, token)
      .then((response) => { if (active) setBooking(response?.data ?? null); })
      .catch((requestError) => { if (active) setError(requestError.message || "Failed to load booking."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookingId, token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!category || !description.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await submitComplaintFeedback(bookingId, token, {
        title: `${category} complaint`,
        category,
        description: description.trim(),
      });
      setCategory("");
      setDescription("");
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError.message || "Failed to submit complaint.");
    } finally {
      setSubmitting(false);
    }
  };

  const startAnother = () => {
    setError("");
    setSubmitted(false);
  };

  return (
    <div className="complaint-feedback-page">
      <div className="complaint-feedback-container">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Submit a complaint</h1>
            <p className="dashboard-header__subtitle">Booking {booking?.bookingNumber || ""}</p>
          </div>
        </div>

        {error && <p className="muted" role="alert">{error}</p>}
        {loading ? <section className="table-card content">Loading booking...</section> : !booking ? (
          <section className="table-card content">Complaint link not found.</section>
        ) : submitted ? (
          <section className="table-card content">
            <div className="detail-card__head"><h2 className="detail-card__title">Complaint submitted</h2></div>
            <p className="muted">Your complaint has been sent to the care team. You can submit another complaint from this link while your stay is active.</p>
            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={startAnother}>Submit another complaint</button>
            </div>
          </section>
        ) : !booking.acceptsComplaints ? (
          <section className="table-card content">
            <p>Complaints can only be submitted for a current stay.</p>
          </section>
        ) : (
          <>
            <section className="room-summary">
              <div className="room-summary__text">
                <p className="room-summary__label">Room</p>
                <h2 className="room-summary__name">{booking.roomName || "-"}</h2>
                <p className="room-summary__location">{booking.bedName || ""} · {booking.bookingNumber}</p>
              </div>
              <span className="booking-status booking-status--in-house">{booking.status.replaceAll("_", " ")}</span>
            </section>

            <section className="table-card content">
              <div className="detail-card__head">
                <h2 className="detail-card__title">Complaint details</h2>
                <p className="detail-card__caption">Choose a category and describe the issue.</p>
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
                  <button type="submit" className="btn btn-primary" disabled={submitting || !category || !description.trim()}>
                    {submitting ? "Submitting..." : "Submit complaint"}
                  </button>
                </div>
              </form>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

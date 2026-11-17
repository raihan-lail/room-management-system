import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchRatingFeedback, submitRatingFeedback } from "../../api/ratings";

const SCORE_OPTIONS = [
  { value: 1, label: "Bad" },
  { value: 2, label: "Poor" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Excellent" },
];

export default function BookingRating() {
  const { bookingId, token } = useParams();
  const [booking, setBooking] = useState(null);
  const [score, setScore] = useState(0);
  const [details, setDetails] = useState("");
  const [submittedScore, setSubmittedScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchRatingFeedback(bookingId, token)
      .then((response) => { if (active) setBooking(response?.data ?? null); })
      .catch((requestError) => { if (active) setError(requestError.message || "Failed to load rating link."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookingId, token]);

  const submitRating = async (event) => {
    event.preventDefault();
    if (!score) return;
    setSubmitting(true);
    setError("");
    try {
      await submitRatingFeedback(bookingId, token, { score, details });
      setSubmittedScore(score);
      setBooking((current) => (current ? { ...current, alreadyRated: true } : current));
    } catch (requestError) {
      setError(requestError.message || "Failed to submit your rating.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="complaint-feedback-page">
      <div className="complaint-feedback-container">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Rate your stay</h1>
            <p className="dashboard-header__subtitle">Booking {booking?.bookingNumber || ""}</p>
          </div>
        </div>

        {error && <p className="muted" role="alert">{error}</p>}
        {loading ? <section className="table-card content">Loading booking...</section> : !booking ? (
          <section className="table-card content">Rating link not found.</section>
        ) : booking.alreadyRated ? (
          <section className="table-card content">
            <div className="form-done">
              <i className="bi bi-check-circle form-done__icon" aria-hidden="true" />
              <p className="form-done__title">{submittedScore ? "Thank you for your feedback" : "Booking already rated"}</p>
              <p className="form-done__caption">
                {submittedScore
                  ? `Your ${submittedScore} of 5 rating for room ${booking.roomName || "-"} has been recorded.`
                  : "This rating link has already been used."}
              </p>
            </div>
          </section>
        ) : !booking.canRate ? (
          <section className="table-card content">
            <p>You can rate this booking after checking out.</p>
          </section>
        ) : (
          <>
            <section className="room-summary">
              <div className="room-summary__text">
                <p className="room-summary__label">Room</p>
                <h2 className="room-summary__name">{booking.roomName || "-"}</h2>
                <p className="room-summary__location">{booking.bedName || ""} · {booking.bookingNumber}</p>
              </div>
              <span className={`booking-status booking-status--${String(booking.status).toLowerCase()}`}>{booking.status.replaceAll("_", " ")}</span>
            </section>

            <section className="table-card content">
              <div className="detail-card__head">
                <h2 className="detail-card__title">How Was Your Experience?</h2>
                <p className="detail-card__caption">Choose a rating from 1 to 5 stars. This link can be used once.</p>
              </div>
              <form className="form-stack" onSubmit={submitRating}>
                <fieldset className="rating-likert">
                  <legend>Your rating</legend>
                  <div className="rating-likert__options">
                    {SCORE_OPTIONS.map((option) => (
                      <label key={option.value} className={`rating-likert__option ${score === option.value ? "is-active" : ""}`}>
                        <input type="radio" name="score" className="choice-input" value={option.value} checked={score === option.value} onChange={() => setScore(option.value)} />
                        <i className={`bi ${score >= option.value ? "bi-star-fill" : "bi-star"} rating-likert__star`} aria-hidden="true" />
                        <span className="rating-likert__label">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="form-field">
                  <span>Anything you wanted to tell us?</span>
                  <textarea rows="4" maxLength={2000} placeholder="Tell us what went well or what we should improve..." value={details} onChange={(event) => setDetails(event.target.value)} />
                </label>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={score === 0 || submitting}>
                    {submitting ? "Submitting..." : "Submit Rating"}
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

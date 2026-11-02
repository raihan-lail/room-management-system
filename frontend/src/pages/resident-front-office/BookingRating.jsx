import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../components/MainLayout";
import apiRequest from "../../api/client";

const SCORE_OPTIONS = [
  { value: 1, label: "Bad" },
  { value: 2, label: "Poor" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Excellent" },
];

const getResponseData = (response) => response?.data ?? response;
const canRateBooking = (status) => ["CHECKED_OUT", "ARCHIVED"].includes(status);

export default function BookingRating() {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [existingRating, setExistingRating] = useState(null);
  const [score, setScore] = useState(0);
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const loadRatingData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [bookingResponse, ratingsResponse] = await Promise.all([
        apiRequest(`/api/resident-portal/bookings/${bookingId}`),
        apiRequest("/api/resident-portal/ratings"),
      ]);
      const bookingData = getResponseData(bookingResponse);
      const ratingRows = getResponseData(ratingsResponse);
      const foundRating = (Array.isArray(ratingRows) ? ratingRows : [])
        .find((rating) => rating.bookingId === bookingId);
      setBooking(bookingData);
      setExistingRating(foundRating ?? null);
    } catch (err) {
      setError(err?.message || "Failed to load booking rating.");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
  const timer = window.setTimeout(() => {
    loadRatingData();
  }, 0);

  return () => window.clearTimeout(timer);
}, [loadRatingData]);

  const submitRating = async () => {
    setSubmitting(true);
    setError("");
    try {
      await apiRequest(`/api/resident-portal/bookings/${bookingId}/rating`, {
        method: "POST",
        body: JSON.stringify({ score, details }),
      });
      setIsSubmitted(true);
    } catch (err) {
      setError(err?.message || "Failed to submit your rating.");
    } finally {
      setSubmitting(false);
    }
  };

  const room = booking?.bed?.room?.name || "-";
  const location = [
    booking?.bed?.room?.floor?.location?.site?.name,
    booking?.bed?.room?.floor?.location?.name,
    booking?.bed?.room?.floor?.name,
  ].filter(Boolean).join(" · ") || "-";

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">
              Booking {booking?.bookingNumber || "Rating"}
            </h1>
            <p className="dashboard-header__subtitle">Rate your experience</p>
          </div>
          <button type="button" className="btn btn-neutral" onClick={() => navigate("/resident/history")}>
            <i className="bi bi-arrow-left" aria-hidden="true" /> Back to History
          </button>
        </div>

        {loading ? (
          <section className="table-card content"><p className="table-empty">Loading booking...</p></section>
        ) : error && !booking ? (
          <section className="table-card content">
            <p role="alert">{error}</p>
            <button type="button" className="btn btn-primary" onClick={loadRatingData}>Try Again</button>
          </section>
        ) : (
          <>
            <section className="room-summary">
              <div className="room-summary__text">
                <p className="room-summary__label">Room</p>
                <h2 className="room-summary__name">{room}</h2>
                <p className="room-summary__location"><i className="bi bi-geo-alt" aria-hidden="true" />{location}</p>
              </div>
              <span className={`booking-status booking-status--${String(booking?.status || "unknown").toLowerCase()}`}>
                {String(booking?.status || "-").replace(/_/g, " ")}
              </span>
            </section>

            <section className="table-card content">
              {isSubmitted || existingRating ? (
                <div className="form-done">
                  <i className="bi bi-check-circle form-done__icon" aria-hidden="true" />
                  <p className="form-done__title">{isSubmitted ? "Thank you for your feedback" : "Booking already rated"}</p>
                  <p className="form-done__caption">
                    Your {isSubmitted ? score : existingRating.score} of 5 rating for room {room} has been recorded.
                  </p>
                  <div className="form-done__actions">
                    <button type="button" className="btn btn-primary" onClick={() => navigate("/resident/history")}>
                      <i className="bi bi-clock-history" aria-hidden="true" /> Back to History
                    </button>
                  </div>
                </div>
              ) : !canRateBooking(booking?.status) ? (
                <p className="table-empty">You can rate this booking after checking out.</p>
              ) : (
                <>
                  <div className="detail-card__head">
                    <h2 className="detail-card__title">How Was Your Experience?</h2>
                    <p className="detail-card__caption">Choose a rating from 1 to 5 stars</p>
                  </div>
                  <div className="form-stack">
                    {error && <p role="alert">{error}</p>}
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
                      <button type="button" className="btn btn-neutral" onClick={() => navigate("/resident/history")}>Cancel</button>
                      <button type="button" className="btn btn-primary" disabled={score === 0 || submitting} onClick={submitRating}>
                        {submitting ? "Submitting..." : "Submit Rating"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </MainLayout>
  );
}

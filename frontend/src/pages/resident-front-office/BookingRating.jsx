import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../components/MainLayout";
import { residentBookings } from "../../data/residentBookings";

const SCORE_OPTIONS = [
  { value: 1, label: "Bad" },
  { value: 2, label: "Poor" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Excellent" },
];

export default function BookingRating() {
  const navigate = useNavigate();
  const { bookingId } = useParams();

  const booking =
    residentBookings.find(
      (item) => item.booking_id === bookingId
    ) ?? residentBookings[0];

  const [score, setScore] = useState(0);
  const [details, setDetails] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">
              Booking {booking?.booking_id || "-"}
            </h1>

            <p className="dashboard-header__subtitle">
              Rate your experience
            </p>
          </div>

          <button
            type="button"
            className="btn btn-neutral"
            onClick={() =>
              navigate("/resident/history")
            }
          >
            <i
              className="bi bi-arrow-left"
              aria-hidden="true"
            />
            Back to History
          </button>
        </div>

        {isSubmitted ? (
          <section className="table-card content">
            <div className="form-done">
              <i
                className="bi bi-check-circle form-done__icon"
                aria-hidden="true"
              />

              <p className="form-done__title">
                Thank you for your feedback
              </p>

              <p className="form-done__caption">
                Your {score} of 5 rating for room{" "}
                {booking?.room || "-"} has been recorded.
              </p>

              <div className="form-done__actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    navigate("/resident/history")
                  }
                >
                  <i
                    className="bi bi-clock-history"
                    aria-hidden="true"
                  />
                  Back to History
                </button>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="room-summary">
              <div className="room-summary__text">
                <p className="room-summary__label">
                  Room
                </p>

                <h2 className="room-summary__name">
                  {booking?.room || "-"}
                </h2>

                <p className="room-summary__location">
                  <i
                    className="bi bi-geo-alt"
                    aria-hidden="true"
                  />
                  {booking?.location || "-"}
                </p>
              </div>

              <span
                className={`booking-status booking-status--${booking?.status.toLowerCase()}`}
              >
                {booking?.status || "-"}
              </span>
            </section>

            <section className="table-card content">
              <div className="detail-card__head">
                <h2 className="detail-card__title">
                  How Was Your Experience?
                </h2>

                <p className="detail-card__caption">
                  Pick one score, from bad to good
                </p>
              </div>

              <div className="form-stack">
                <fieldset className="rating-likert">
                  

                  <div className="rating-likert__options">
                    {SCORE_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`rating-likert__option ${
                          score === option.value
                            ? "is-active"
                            : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="score"
                          className="choice-input"
                          value={option.value}
                          checked={
                            score === option.value
                          }
                          onChange={() =>
                            setScore(option.value)
                          }
                        />

                        <i
                          className={`bi ${
                            score >= option.value
                              ? "bi-star-fill"
                              : "bi-star"
                          } rating-likert__star`}
                          aria-hidden="true"
                        />

                        <span className="rating-likert__label">
                          {option.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="form-field">
                  <span>
                    Anything you wanted to tell us?
                  </span>

                  <textarea
                    rows="4"
                    placeholder="Tell us what went well or what we should improve..."
                    value={details}
                    onChange={(event) =>
                      setDetails(event.target.value)
                    }
                  />
                </label>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-neutral"
                    onClick={() =>
                      navigate("/resident/history")
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={score === 0}
                    onClick={() =>
                      setIsSubmitted(true)
                    }
                  >
                   
                    Submit Rating
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </MainLayout>
  );
}

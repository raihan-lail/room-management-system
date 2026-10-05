import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../components/MainLayout";
import { complainsData } from "../../data/complains";
import { residentBookings } from "../../data/residentBookings";

const COMPLAINT_TYPES = [
  { value: "Cleaning", icon: "bi-broom" },
  { value: "Air Conditioning", icon: "bi-snow" },
  { value: "Plumbing", icon: "bi-droplet" },
  { value: "Electrical", icon: "bi-lightning-charge" },
  { value: "Wi-Fi & Network", icon: "bi-wifi" },
  { value: "Amenities", icon: "bi-box-seam" },
  { value: "Noise Complaint", icon: "bi-volume-up" },
  { value: "Maintenance", icon: "bi-tools" },
  { value: "Pest Control", icon: "bi-bug" },
];

export default function BookingComplaints() {
  const navigate = useNavigate();
  const { bookingId } = useParams();

  const booking =
    residentBookings.find(
      (item) => item.booking_id === bookingId
    ) ?? residentBookings[0];

  const [type, setType] = useState("");
  const [details, setDetails] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const complainId = `SD${String(
    complainsData.length + 1
  ).padStart(5, "0")}`;

  const canSubmit =
    type !== "" && details.trim() !== "";

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">
              Booking {booking?.booking_id || "-"}
            </h1>

            <p className="dashboard-header__subtitle">
              Let us know your complaint
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
                Complaint submitted
              </p>

              <p className="form-done__caption">
                Reference {complainId} for {type} in
                room {booking?.room || "-"}. Our team will
                follow up on this report.
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
                  Complaint Details
                </h2>

                <p className="detail-card__caption">
                  Pick the closest type, then describe
                  the problem
                </p>
              </div>

              <div className="form-stack">
                <fieldset className="complaint-types-field">
                  <p className="complaint-types-field__label">
                    Complaint Type
                  </p>

                  <div className="complaint-types">
                    {COMPLAINT_TYPES.map((option) => (
                      <label
                        key={option.value}
                        className={`complaint-type-option ${
                          type === option.value
                            ? "is-active"
                            : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="complain_type"
                          className="choice-input"
                          value={option.value}
                          checked={
                            type === option.value
                          }
                          onChange={() =>
                            setType(option.value)
                          }
                        />

                        <i
                          className={`bi ${option.icon} complaint-type-option__icon`}
                          aria-hidden="true"
                        />

                        <span className="complaint-type-option__label">
                          {option.value}
                        </span>

                        {type === option.value && (
                          <i
                            className="bi bi-check-lg complaint-type-option__check"
                            aria-hidden="true"
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="form-field">
                  <span>
                    Anything you wanted to tell us?
                  </span>

                  <textarea
                    rows="5"
                    placeholder="Describe the problem in detail, for example where it is and since when it happens..."
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
                    disabled={!canSubmit}
                    onClick={() =>
                      setIsSubmitted(true)
                    }
                  >
                    
                    Submit Complaint
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

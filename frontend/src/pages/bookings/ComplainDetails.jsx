import MainLayout from "../../components/MainLayout";
import { useNavigate, useParams } from "react-router-dom";
import { complainsData } from "../../data/complains";

export default function ComplainDetails() {
  const navigate = useNavigate();
  const { complainId } = useParams();

  const complain =
    complainsData.find((c) => c.complain_id === complainId) ?? null;

  if (!complain) {
    return (
      <MainLayout>
        <div className="dashboard">
          <div className="dashboard-header">
            <div className="dashboard-header__text">
              <h1 className="dashboard-header__title">Complain Not Found</h1>
              <p className="dashboard-header__subtitle">
                No complain matches the reference {complainId || "-"}
              </p>
            </div>

            <button
              type="button"
              className="btn btn-neutral"
              onClick={() => navigate("/bookings/complains")}
            >
              <i className="bi bi-arrow-left" aria-hidden="true" />
              Back to Complains
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const details = [
    { label: "Complain ID", value: complain.complain_id },
    { label: "Room", value: complain.room },
    { label: "Resident", value: complain.name },
    { label: "Type", value: complain.type, isType: true },
    { label: "Submitted Date", value: complain.submitted_date },
  ];

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Complain Details</h1>
            <p className="dashboard-header__subtitle">
              Full report submitted by the resident
            </p>
          </div>

          <button
            type="button"
            className="btn btn-neutral"
            onClick={() => navigate("/bookings/complains")}
          >
            <i className="bi bi-arrow-left" aria-hidden="true" />
            Back to Complains
          </button>
        </div>

        {/* COMPLAIN SUMMARY */}
        <section className="room-summary">
          <div className="room-summary__text">
            <p className="room-summary__label">Complain ID</p>
            <h2 className="room-summary__name">
              {complain.complain_id || "-"}
            </h2>
            <p className="room-summary__location">
              <i className="bi bi-door-closed" aria-hidden="true" />
              Room {complain.room || "-"}
            </p>
          </div>

          <span className="complain-type">{complain.type || "-"}</span>
        </section>

        {/* COMPLAIN INFORMATION */}
        <section className="table-card content">
          <div className="detail-card__head">
            <h2 className="detail-card__title">Complain Information</h2>
            <p className="detail-card__caption">
              Static sample data, will be dynamic later
            </p>
          </div>

          <div className="detail-grid">
            {details.map((detail) => (
              <div className="detail-grid__item" key={detail.label}>
                <p className="detail-grid__label">{detail.label}</p>

                {detail.isType ? (
                  <span className="complain-type">
                    {detail.value || "-"}
                  </span>
                ) : (
                  <p className="detail-grid__value">{detail.value || "-"}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* COMPLAIN DESCRIPTION */}
        <section className="table-card content">
          <div className="detail-card__head">
            <h2 className="detail-card__title">Details</h2>
            <p className="detail-card__caption">
              Submitted {complain.submitted_date || "-"}
            </p>
          </div>

          <div className="complain-notes">
            <p className="complain-notes__text">
              {complain.details || "-"}
            </p>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}

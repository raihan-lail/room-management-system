import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../components/MainLayout";
import { fetchComplaint, markComplaintNotificationsAsRead, updateComplaintPriority, updateComplaintStatus } from "../../api/complaints";

const STATUS_OPTIONS = {
  OPEN: ["IN_PROGRESS", "RESOLVED", "CLOSED", "REJECTED"],
  IN_PROGRESS: ["RESOLVED", "CLOSED", "REJECTED"],
  RESOLVED: ["CLOSED"],
};

const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const formatDate = (value) => value
  ? new Date(value).toLocaleString("en-GB")
  : "-";

export default function ComplainDetails() {
  const navigate = useNavigate();
  const { complainId } = useParams();
  const [complaint, setComplaint] = useState(null);
  const [nextStatus, setNextStatus] = useState("");
  const [resolution, setResolution] = useState("");
  const [nextPriority, setNextPriority] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingPriority, setSavingPriority] = useState(false);
  const [error, setError] = useState("");

  const loadComplaint = useCallback(async () => {
    setError("");
    try {
      const response = await fetchComplaint(complainId);
      setComplaint(response?.data ?? null);
    } catch (requestError) {
      setError(requestError.message || "Failed to load complaint.");
    } finally {
      setLoading(false);
    }
  }, [complainId]);

  useEffect(() => {
  const timer = window.setTimeout(() => {
    loadComplaint();
  }, 0);

  return () => window.clearTimeout(timer);
}, [loadComplaint]);

  useEffect(() => {
    markComplaintNotificationsAsRead(complainId)
      .then(() => window.dispatchEvent(new Event("notifications:updated")))
      .catch((requestError) => {
        console.error("Failed to mark complaint conversation as read:", requestError);
      });
  }, [complainId]);

  const changeStatus = async (event) => {
    event.preventDefault();
    if (!nextStatus) return;
    setSending(true);
    setError("");
    try {
      await updateComplaintStatus(complainId, nextStatus, resolution);
      window.dispatchEvent(new Event("notifications:updated"));
      setNextStatus("");
      setResolution("");
      await loadComplaint();
    } catch (requestError) {
      setError(requestError.message || "Failed to update complaint status.");
    } finally {
      setSending(false);
    }
  };

  const room = complaint?.booking?.bed?.room?.name;

  const selectedPriority = nextPriority || complaint?.priority || "";

  const changePriority = async (event) => {
    event.preventDefault();
    if (!selectedPriority || selectedPriority === complaint.priority) return;
    setSavingPriority(true);
    setError("");
    try {
      await updateComplaintPriority(complainId, selectedPriority);
      setNextPriority("");
      await loadComplaint();
    } catch (requestError) {
      setError(requestError.message || "Failed to update complaint priority.");
    } finally {
      setSavingPriority(false);
    }
  };

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Complaint Details</h1>
            <p className="dashboard-header__subtitle">Review and update the resident complaint</p>
          </div>
          <button type="button" className="btn btn-neutral" onClick={() => navigate("/bookings/complains")}>
            <i className="bi bi-arrow-left" aria-hidden="true" /> Back to Complaints
          </button>
        </div>

        {error && <p className="muted" role="alert">{error}</p>}
        {loading ? <section className="table-card content">Loading complaint...</section> : !complaint ? (
          <section className="table-card content">Complaint not found.</section>
        ) : (
          <>
            <section className="room-summary">
              <div className="room-summary__text">
                <p className="room-summary__label">{complaint.category || "Complaint"} · {complaint.status}</p>
                <h2 className="room-summary__name">{complaint.title}</h2>
                <p className="room-summary__location">
                  {complaint.booking?.resident?.fullName || "Resident"} · Room {room || "-"} · {formatDate(complaint.createdAt)}
                </p>
              </div>
              <span className="complain-type">{complaint.priority}</span>
            </section>

            <section className="table-card content">
              <div className="detail-card__head"><h2 className="detail-card__title">Description</h2></div>
              <div className="complain-notes"><p className="complain-notes__text">{complaint.description}</p></div>
              {complaint.resolution && <p className="detail-grid__value">Resolution: {complaint.resolution}</p>}
            </section>

            <section className="table-card content">
              <div className="detail-card__head"><h2 className="detail-card__title">Update priority</h2></div>
              <form className="form-stack" onSubmit={changePriority}>
                <label className="form-field">
                  <span>Complaint priority</span>
                  <select value={selectedPriority} onChange={(event) => setNextPriority(event.target.value)}>
                    {PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                  </select>
                </label>
                <div className="form-actions">
                  <button className="btn btn-primary" type="submit" disabled={savingPriority || selectedPriority === complaint.priority}>
                    Update priority
                  </button>
                </div>
              </form>
            </section>

            {(STATUS_OPTIONS[complaint.status] || []).length > 0 && (
              <section className="table-card content">
                <div className="detail-card__head"><h2 className="detail-card__title">Update status</h2></div>
                <form className="form-stack" onSubmit={changeStatus}>
                  <label className="form-field">
                    <span>New status</span>
                    <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} required>
                      <option value="">Choose status</option>
                      {(STATUS_OPTIONS[complaint.status] || []).map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                    </select>
                  </label>
                  {nextStatus === "RESOLVED" && (
                    <label className="form-field"><span>Resolution</span><textarea rows="3" value={resolution} onChange={(event) => setResolution(event.target.value)} required /></label>
                  )}
                  <div className="form-actions"><button className="btn btn-primary" type="submit" disabled={sending || !nextStatus}>Update status</button></div>
                </form>
              </section>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}

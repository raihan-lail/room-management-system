import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../components/MainLayout";
import { fetchComplaint, markComplaintNotificationsAsRead, sendStaffComplaintMessage, updateComplaintStatus } from "../../api/complaints";

const STATUS_OPTIONS = {
  OPEN: ["IN_PROGRESS", "RESOLVED", "CLOSED", "REJECTED"],
  IN_PROGRESS: ["RESOLVED", "CLOSED", "REJECTED"],
  RESOLVED: ["CLOSED"],
};

const formatDate = (value) => value
  ? new Date(value).toLocaleString("en-GB")
  : "-";

export default function ComplainDetails() {
  const navigate = useNavigate();
  const { complainId } = useParams();
  const [complaint, setComplaint] = useState(null);
  const [message, setMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [nextStatus, setNextStatus] = useState("");
  const [resolution, setResolution] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
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

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setError("");
    try {
      await sendStaffComplaintMessage(complainId, message.trim(), isInternal);
      setMessage("");
      setIsInternal(false);
      await loadComplaint();
    } catch (requestError) {
      setError(requestError.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (event) => {
    event.preventDefault();
    if (!nextStatus) return;
    setSending(true);
    setError("");
    try {
      await updateComplaintStatus(complainId, nextStatus, resolution);
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

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Complaint Details</h1>
            <p className="dashboard-header__subtitle">Review and respond to the resident</p>
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
              <div className="detail-card__head"><h2 className="detail-card__title">Conversation</h2></div>
              <div className="form-stack">
                {(complaint.messages || []).length === 0 ? <p className="muted">No messages yet.</p> : complaint.messages.map((item) => (
                  <article className="complain-notes" key={item.id}>
                    <p className="detail-grid__label">
                      {item.user?.employee?.name || item.user?.resident?.fullName || "User"} · {formatDate(item.createdAt)}
                      {item.isInternal ? " · Internal note" : ""}
                    </p>
                    <p className="complain-notes__text">{item.message}</p>
                  </article>
                ))}
                <form className="form-stack" onSubmit={sendMessage}>
                  <label className="form-field">
                    <span>Reply</span>
                    <textarea rows="3" value={message} onChange={(event) => setMessage(event.target.value)} required />
                  </label>
                  <label className="form-check">
                    <input type="checkbox" checked={isInternal} onChange={(event) => setIsInternal(event.target.checked)} />
                    Internal note (visible to staff only)
                  </label>
                  <div className="form-actions">
                    <button className="btn btn-primary" type="submit" disabled={sending || !message.trim()}>Send message</button>
                  </div>
                </form>
              </div>
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

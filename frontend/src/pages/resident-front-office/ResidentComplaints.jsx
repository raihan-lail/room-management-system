import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MainLayout from "../../components/MainLayout";
import { fetchMyComplaint, fetchMyComplaints, markComplaintNotificationsAsRead } from "../../api/complaints";
import { fetchNotifications } from "../../api/notifications";

const formatDate = (value) => value ? new Date(value).toLocaleString("en-GB") : "-";

export default function ResidentComplaints() {
  const navigate = useNavigate();
  const { complaintId } = useParams();
  const [complaints, setComplaints] = useState([]);
  const [unreadComplaintIds, setUnreadComplaintIds] = useState([]);
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (complaintId) {
        const response = await fetchMyComplaint(complaintId);
        setComplaint(response?.data ?? null);
      } else {
        const [complaintsResult, notificationsResult] = await Promise.allSettled([
          fetchMyComplaints(),
          fetchNotifications(),
        ]);
        if (complaintsResult.status === "rejected") throw complaintsResult.reason;
        setComplaints(complaintsResult.value?.data ?? []);
        if (notificationsResult.status === "fulfilled") {
          setUnreadComplaintIds(notificationsResult.value?.unreadComplaintIds ?? []);
        }
      }
    } catch (requestError) {
      setError(requestError.message || "Failed to load complaints.");
    } finally {
      setLoading(false);
    }
  }, [complaintId]);

 useEffect(() => {
  const timer = window.setTimeout(() => {
    load();
  }, 0);

  return () => window.clearTimeout(timer);
}, [load]);

  useEffect(() => {
    if (!complaintId) return;
    markComplaintNotificationsAsRead(complaintId)
      .then(() => window.dispatchEvent(new Event("notifications:updated")))
      .catch((requestError) => {
        console.error("Failed to mark complaint conversation as read:", requestError);
      });
  }, [complaintId]);

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">{complaintId ? "Complaint details" : "My complaints"}</h1>
            <p className="dashboard-header__subtitle">Review your complaint and its updates</p>
          </div>
          <button type="button" className="btn btn-neutral" onClick={() => navigate(complaintId ? "/resident/complaints" : "/resident/history")}>
            <i className="bi bi-arrow-left" aria-hidden="true" /> {complaintId ? "All complaints" : "Booking history"}
          </button>
        </div>

        {error && <p className="muted" role="alert">{error}</p>}
        {loading ? <section className="table-card content">Loading complaints...</section> : complaintId ? (
          !complaint ? <section className="table-card content">Complaint not found.</section> : <>
            <section className="room-summary">
              <div className="room-summary__text">
                <p className="room-summary__label">{complaint.category} · {complaint.status?.replaceAll("_", " ")}</p>
                <h2 className="room-summary__name">{complaint.title}</h2>
                <p className="room-summary__location">Room {complaint.booking?.bed?.room?.name || "-"} · {formatDate(complaint.createdAt)}</p>
              </div>
              <span className="complain-type">{complaint.priority}</span>
            </section>
            <section className="table-card content">
              <div className="detail-card__head"><h2 className="detail-card__title">Description</h2></div>
              <div className="complain-notes"><p className="complain-notes__text">{complaint.description}</p></div>
              {complaint.resolution && <p className="detail-grid__value">Resolution: {complaint.resolution}</p>}
            </section>
          </>
        ) : complaints.length === 0 ? (
          <section className="table-card content">
            <p>You have not submitted any complaints yet.</p>
            <button type="button" className="btn btn-neutral" onClick={() => navigate("/resident/history")}>View bookings</button>
          </section>
        ) : (
          <section className="table-card content">
            <div className="office-table-wrapper">
              <table className="office-table">
                <thead><tr><th>Category</th><th>Room</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>{complaints.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.title}</strong><br />{item.category}</td>
                    <td>{item.booking?.bed?.room?.name || "-"}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>{item.status?.replaceAll("_", " ")}</td>
                    <td>
                      <button type="button" className="btn btn-neutral" onClick={() => navigate(`/resident/complaints/${item.id}`)}>
                        View details
                        {unreadComplaintIds.includes(item.id) && (
                          <span className="side-nav-alert-dot" aria-label="Unread complaint activity" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </MainLayout>
  );
}

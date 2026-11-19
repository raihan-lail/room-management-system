import apiRequest from "./client";

const residentComplaintsPath = "/api/resident-portal/complaints";
const staffComplaintsPath = "/api/complaint";
const feedbackComplaintsPath = "/api/feedback/complaints";

export function fetchComplaints(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`${staffComplaintsPath}${query ? `?${query}` : ""}`);
}

export function fetchComplaint(id) {
  return apiRequest(`${staffComplaintsPath}/${encodeURIComponent(id)}`);
}

export function updateComplaintStatus(id, status, resolution) {
  return apiRequest(`${staffComplaintsPath}/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, resolution }),
  });
}

export function updateComplaintPriority(id, priority) {
  return apiRequest(`${staffComplaintsPath}/${encodeURIComponent(id)}/priority`, {
    method: "PATCH",
    body: JSON.stringify({ priority }),
  });
}

export function fetchComplaintFeedback(bookingId, token) {
  return apiRequest(
    `${feedbackComplaintsPath}/${encodeURIComponent(bookingId)}/${encodeURIComponent(token)}`
  );
}

export function submitComplaintFeedback(bookingId, token, complaint) {
  return apiRequest(
    `${feedbackComplaintsPath}/${encodeURIComponent(bookingId)}/${encodeURIComponent(token)}`,
    { method: "POST", body: JSON.stringify(complaint) }
  );
}

export function fetchMyComplaints() {
  return apiRequest(residentComplaintsPath);
}

export function fetchMyComplaint(id) {
  return apiRequest(`${residentComplaintsPath}/${encodeURIComponent(id)}`);
}

export function markComplaintNotificationsAsRead(id) {
  return apiRequest(`/api/notification/complaints/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
  });
}

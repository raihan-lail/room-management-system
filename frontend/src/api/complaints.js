import apiRequest from "./client";

const residentComplaintsPath = "/api/resident-portal/complaints";
const staffComplaintsPath = "/api/complaint";

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

export function sendStaffComplaintMessage(id, message, isInternal = false) {
  return apiRequest(`${staffComplaintsPath}/${encodeURIComponent(id)}/messages`, {
    method: "POST",
    body: JSON.stringify({ message, isInternal }),
  });
}

export function submitResidentComplaint(bookingId, complaint) {
  return apiRequest(
    `/api/resident-portal/bookings/${encodeURIComponent(bookingId)}/complaints`,
    { method: "POST", body: JSON.stringify(complaint) }
  );
}

export function fetchMyComplaints() {
  return apiRequest(residentComplaintsPath);
}

export function fetchMyComplaint(id) {
  return apiRequest(`${residentComplaintsPath}/${encodeURIComponent(id)}`);
}

export function replyToMyComplaint(id, message) {
  return apiRequest(`${residentComplaintsPath}/${encodeURIComponent(id)}/messages`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export function markComplaintNotificationsAsRead(id) {
  return apiRequest(`/api/notification/complaints/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
  });
}

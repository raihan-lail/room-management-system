import apiRequest from "./client";

export async function fetchNotifications() {
  return apiRequest("/api/notification");
}

export async function markNotificationAsRead(id) {
  return apiRequest(`/api/notification/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsAsRead() {
  return apiRequest("/api/notification/read-all", { method: "PATCH" });
}

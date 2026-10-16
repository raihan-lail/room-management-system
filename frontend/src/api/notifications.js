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

export async function requestNotificationSocketTicket() {
  return apiRequest("/api/notification/socket-ticket", { method: "POST" });
}

export function buildNotificationSocketUrl(ticket) {
  const base =
    import.meta.env.VITE_API_BASE_URL || window.location.origin;
  const wsBase = base.startsWith("https://")
    ? base.replace(/^https:\/\//, "wss://")
    : base.startsWith("http://")
      ? base.replace(/^http:\/\//, "ws://")
      : base;
  const normalizedBase = wsBase.replace(/\/$/, "");
  return `${normalizedBase}/ws/notifications?ticket=${encodeURIComponent(ticket)}`;
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  buildNotificationSocketUrl,
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  requestNotificationSocketTicket,
} from "../api/notifications";
import useAuth from "../contexts/useAuth";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const notificationTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

function formatNotificationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return notificationTimeFormatter.format(date);
}

export default function Navbar({ onToggleSidebar }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const notificationsContainerRef = useRef(null);
  const userDropdownRef = useRef(null);
  const notificationsRef = useRef([]);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const employee = user?.employee;
  const resident = user?.resident;
  const isResident = user?.accountType === "resident";
  
  const userName =
    employee?.name || resident?.fullName || user?.email || "User";
  const userRole = isResident
    ? "Resident"
    : employee?.roles?.length
      ? employee.roles.join(", ")
      : "";
  const siteName =
    employee?.siteName ||
    employee?.site?.name ||
    resident?.siteName ||
    "GLOBAL";
  const userId = user?.id;

  const unreadInList = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications]
  );
  const displayUnreadCount = Math.max(unreadCount, unreadInList);

  const handleLogout = async () => {
    setUserDropdownOpen(false);
    await logout();
    navigate("/login", { replace: true });
  };

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    setNotificationsError("");
    try {
      const data = await fetchNotifications();
      const list = Array.isArray(data?.data) ? data.data : [];
      setNotifications(list);
      notificationsRef.current = list;
      setUnreadCount(typeof data?.unreadCount === "number" ? data.unreadCount : 0);
    } catch (err) {
      setNotificationsError(err?.message || "Failed to load notifications");
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
  // Defer the initial fetch so it isn't synchronous on mount
  const initialTimer = window.setTimeout(loadNotifications, 0);
  
  const pollId = window.setInterval(loadNotifications, 60000);
  
  return () => {
    window.clearTimeout(initialTimer);
    window.clearInterval(pollId);
  };
}, [loadNotifications]);

  useEffect(() => {
    if (!userId) return;

    let socket = null;
    let retryTimeoutId = null;
    let stopped = false;
    let retryCount = 0;

    const handleIncomingNotification = (notification) => {
      if (!notification || !notification.id) return;
      if (notificationsRef.current.some((item) => item.id === notification.id)) {
        return;
      }

      const next = [notification, ...notificationsRef.current].slice(0, 50);
      notificationsRef.current = next;
      setNotifications(next);
      setUnreadCount((prev) => prev + 1);
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      const delay = Math.min(1000 * 2 ** retryCount, 15000);
      retryCount += 1;
      retryTimeoutId = window.setTimeout(() => {
        void connect();
      }, delay);
    };

    const connect = async () => {
      if (stopped) return;

      try {
        const data = await requestNotificationSocketTicket();
        if (stopped || !data?.ticket) {
          scheduleReconnect();
          return;
        }

        socket = new WebSocket(buildNotificationSocketUrl(data.ticket));

        socket.onopen = () => {
          retryCount = 0;
        };

        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload?.event === "notification:new" && payload?.data) {
              handleIncomingNotification(payload.data);
            }
          } catch {
            // Ignore malformed socket messages.
          }
        };

        socket.onclose = () => {
          socket = null;
          scheduleReconnect();
        };

        socket.onerror = () => {
          try {
            socket?.close();
          } catch {
            // Socket cleanup best-effort; onclose handles reconnect.
          }
        };
      } catch {
        scheduleReconnect();
      }
    };

    void connect();

    return () => {
      stopped = true;
      if (retryTimeoutId) window.clearTimeout(retryTimeoutId);
      if (socket) socket.close();
    };
  }, [userId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!notificationsOpen) return;

    const handlePointerDown = (event) => {
      const container = notificationsContainerRef.current;

      if (!container) return;

      if (container.contains(event.target)) {
        return;
      }

      setNotificationsOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!userDropdownOpen) return;

    const handlePointerDown = (event) => {
      const container = userDropdownRef.current;

      if (!container) return;

      if (container.contains(event.target)) {
        return;
      }

      setUserDropdownOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [userDropdownOpen]);

  const handleToggleNotifications = async () => {
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);
    if (nextOpen) {
      setUserDropdownOpen(false);
      await loadNotifications();
    }
  };

  const handleToggleUserDropdown = () => {
    const nextOpen = !userDropdownOpen;
    setUserDropdownOpen(nextOpen);
    if (nextOpen) {
      setNotificationsOpen(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification || notification.isRead) return;

    try {
      await markNotificationAsRead(notification.id);
      const next = notificationsRef.current.map((item) =>
        item.id === notification.id ? { ...item, isRead: true } : item
      );
      notificationsRef.current = next;
      setNotifications(next);
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Keep dropdown usable even if mark-as-read fails.
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      const next = notificationsRef.current.map((item) => ({
        ...item,
        isRead: true,
      }));
      notificationsRef.current = next;
      setNotifications(next);
      setUnreadCount(0);
    } catch (err) {
      setNotificationsError(err?.message || "Failed to update notifications");
    }
  };

  return (
    <header className="navbar">
      <div className="navbar__brand">
        <button
          type="button"
          className="navbar-menu-toggle"
          aria-label="Toggle side navigation"
          onClick={onToggleSidebar}
        >
          <i className="bi bi-list" aria-hidden="true" />
        </button>

        <i className="bi bi-geo-alt" aria-hidden="true" />

        <span className="navbar__title">{siteName}</span>
      </div>

      <div className="navbar__actions">
        <div className="navbar-date-time" aria-label="Current date and time">
          <span className="navbar-date-time__date">
            {dateFormatter.format(currentTime)}
          </span>

          <span className="navbar-date-time__clock">
            {timeFormatter.format(currentTime)}
          </span>
        </div>

        <div className="navbar-notifications" ref={notificationsContainerRef}>
          <button
            type="button"
            className="navbar-icon-button"
            aria-label="Notifications"
            title="Notifications"
            aria-expanded={notificationsOpen}
            onClick={handleToggleNotifications}
          >
            <i className="bi bi-bell" aria-hidden="true" />
            {displayUnreadCount > 0 ? (
              <span className="navbar-notification-dot" aria-hidden="true" />
            ) : null}
          </button>

          {notificationsOpen ? (
            <div
              className="notifications-dropdown"
              role="menu"
              aria-label="Notifications"
            >
              <div className="notifications-dropdown__header">
                <span>
                  Notifications
                  {displayUnreadCount > 0 ? ` (${displayUnreadCount})` : ""}
                </span>

                <button
                  type="button"
                  className="notifications-refresh"
                  disabled={notificationsLoading || displayUnreadCount === 0}
                  onClick={handleMarkAllAsRead}
                >
                  Mark all read
                </button>
              </div>

              <div className="notifications-dropdown__body">
                {notificationsLoading ? <p>Loading notifications…</p> : null}

                {!notificationsLoading && notificationsError ? (
                  <p>
                    {notificationsError}{" "}
                    <button
                      type="button"
                      className="notifications-refresh"
                      onClick={loadNotifications}
                    >
                      Retry
                    </button>
                  </p>
                ) : null}

                {!notificationsLoading &&
                !notificationsError &&
                notifications.length === 0 ? (
                  <p>No notifications yet.</p>
                ) : null}

                {!notificationsLoading &&
                  !notificationsError &&
                  notifications.map((notification) =>
                    notification.isRead ? (
                      <div key={notification.id} className="notification-item">
                        <p className="notification-item__message">
                          <strong>{notification.title}</strong>
                          <br />
                          {notification.message}
                        </p>
                        <p className="notification-item__meta">
                          {formatNotificationTime(notification.createdAt)}
                        </p>
                      </div>
                    ) : (
                      <button
                        key={notification.id}
                        type="button"
                        className="notification-item is-unread"
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <p className="notification-item__message">
                          <strong>{notification.title}</strong>
                          <br />
                          {notification.message}
                        </p>
                        <p className="notification-item__meta">
                          {formatNotificationTime(notification.createdAt)} • Unread
                        </p>
                      </button>
                    )
                  )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="navbar-user-dropdown" ref={userDropdownRef}>
          <button
            type="button"
            className="navbar-user-button"
            onClick={handleToggleUserDropdown}
            aria-expanded={userDropdownOpen}
            aria-haspopup="menu"
          >
            <div className="navbar-user__avatar">
              <i className="bi bi-person-fill" aria-hidden="true" />
            </div>

            <div className="navbar-user__info">
              <span className="navbar-user__name">{userName}</span>

              <span className="navbar-user__role">{userRole}</span>
            </div>
            <div className="user-dropdown-toogle">
              {userDropdownOpen ? (
                <i className="bi bi-chevron-up"> </i>
              ) : (
                <i className="bi bi-chevron-down"> </i>
              )}
            </div>
          </button>

          {userDropdownOpen ? (
            <div className="user-dropdown-menu" role="menu">
              <button
                type="button"
                className="logout-button"
                onClick={handleLogout}
              >
                <i className="bi bi-box-arrow-right" aria-hidden="true" />
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

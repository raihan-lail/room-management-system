import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useAuth from "../contexts/useAuth";
import apiRequest from "../api/client";


function getItemPermission(item) {
  return item.permission ?? item.permissions ?? null;
}

function isAllowed(item, hasPermission) {
  const required = getItemPermission(item);

  if (!required) return true;

  if (Array.isArray(required)) {
    if (required.length === 0) return true;
    return required.some((name) => hasPermission(name));
  }

  return hasPermission(required);
}

function filterMenuItems(items, hasPermission) {
  return items.reduce((visibleItems, item) => {
    const hasChildren =
      Array.isArray(item.items) && item.items.length > 0;

    const visibleChildren = hasChildren
      ? filterMenuItems(item.items, hasPermission)
      : [];

    const hasOwnPermission = isAllowed(item, hasPermission);

    if (hasChildren) {
      // Group headers (e.g. /bookings, /rooms, /settings) are not
      // standalone pages, so hide them when no child is accessible.
      if (visibleChildren.length > 0) {
        visibleItems.push({
          ...item,
          items: visibleChildren,
        });
      }
    } else if (hasOwnPermission) {
      visibleItems.push(item);
    }

    return visibleItems;
  }, []);
}

export default function Sidebar({
  isCollapsed,
  onToggle,
  menuItems = [],
  title = "Navigation Menu",
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();

  const [openMenus, setOpenMenus] = useState({});
  const [hasFrontdeskAlerts, setHasFrontdeskAlerts] = useState(false);
  const visibleMenuItems = useMemo(
  () => filterMenuItems(menuItems, hasPermission),
  [menuItems, hasPermission]
);

  useEffect(() => {
    if (!hasPermission("frontdesk")) return undefined;

    let isMounted = true;
    const refreshAlerts = async () => {
      try {
        const today = new Date();
        const date = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}-${`${today.getDate()}`.padStart(2, "0")}`;
        const tabs = ["arrival", "departure", "near-end"];
        const counts = await Promise.all(tabs.map(async (tab) => {
          const params = new URLSearchParams({ tab, page: "1", limit: "1", date });
          const response = await apiRequest(`/api/booking?${params}`);
          return Number(response?.pagination?.total ?? 0);
        }));
        if (isMounted) setHasFrontdeskAlerts(counts.some((count) => count > 0));
      } catch {
        if (isMounted) setHasFrontdeskAlerts(false);
      }
    };

    refreshAlerts();
    const timer = window.setInterval(refreshAlerts, 60000);
    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [hasPermission]);

  const toggleMenu = (path) => {
    // If sidebar is collapsed, open it first.
    if (isCollapsed) {
      onToggle(false);

      setOpenMenus((prev) => ({
        ...prev,
        [path]: true,
      }));

      return;
    }

    setOpenMenus((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const handleNavigate = (path) => {
    navigate(path);

   
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches
    ) {
      onToggle(true);
    }
  };

  return (
    <aside
      className="app-sidebar"
      aria-label="Main menu"
    >
      {/* HEADER */}
      <div className="app-sidebar__header">
        <div className="app-sidebar__identity">
          <div className="app-sidebar__brand">
            <span className="app-sidebar__brand-title">
              {title}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => onToggle(!isCollapsed)}
          aria-label={
            isCollapsed
              ? "Open side navigation"
              : "Close side navigation"
          }
        >
          <i className="bi bi-list" />
        </button>
      </div>

      {/* NAVIGATION */}
      <nav className="app-sidebar__nav">
        {visibleMenuItems.map((item) => {
          const hasChildren =
            Array.isArray(item.items) &&
            item.items.length > 0;

          const isParentActive =
            location.pathname === item.path;

          const isChildActive =
            hasChildren &&
            item.items.some(
              (child) =>
                location.pathname === child.path ||
                location.pathname.startsWith(`${child.path}/`)
            );

          const isActive =
            isParentActive || isChildActive;

          const isOpen =
            openMenus[item.path] || isChildActive;

          return (
            <div
              className="side-nav-section"
              key={item.path}
            >
             
              <button
                type="button"
                className={`side-nav-parent ${
                  isActive ? "is-active" : ""
                }`}
                onClick={() => {
                  if (hasChildren) {
                    toggleMenu(item.path);
                  } else {
                    handleNavigate(item.path);
                  }
                }}
                title={item.label}
              >
                <i
                  className={`bi ${item.icon} side-nav-link__icon`}
                  aria-hidden="true"
                />

                <span className="side-nav-link__label">
                  {item.label}
                </span>

                {item.path === "/frontdesk" && hasFrontdeskAlerts && (
                  <span className="side-nav-alert-dot" aria-label="Front desk alerts" />
                )}

               
                {hasChildren && (
                  <i
                    className={`bi ${
                      isOpen
                        ? "bi-chevron-up"
                        : "bi-chevron-down"
                    } side-nav-parent__chevron`}
                    aria-hidden="true"
                  />
                )}
              </button>

             
              {hasChildren && isOpen && (
                <div className="side-nav-submenu">
                  {item.items.map((child) => {
                    const isChildActive =
                      location.pathname === child.path;

                    return (
                      <button
                        type="button"
                        key={child.path}
                        className={`side-nav-subitem ${
                          isChildActive
                            ? "is-active"
                            : ""
                        }`}
                        onClick={() =>
                          handleNavigate(child.path)
                        }
                        title={child.label}
                      >
                        <i
                          className={`bi ${child.icon} side-nav-subitem__icon`}
                          aria-hidden="true"
                        />

                        <span>
                          {child.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

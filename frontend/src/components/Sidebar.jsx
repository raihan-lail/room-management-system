import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function Sidebar({
  isCollapsed,
  onToggle,
  menuItems = [],
  title = "Navigation Menu",
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const [openMenus, setOpenMenus] = useState({});

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
        {menuItems.map((item) => {
          const hasChildren =
            Array.isArray(item.items) &&
            item.items.length > 0;

          const isParentActive =
            location.pathname === item.path;

          const isChildActive =
            hasChildren &&
            item.items.some(
              (child) =>
                child.path === location.pathname
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
              {/* =========================
                  PARENT ITEM
              ========================= */}
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

                {/* Chevron only if submenu exists */}
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

              {/* =========================
                  SUBMENU
              ========================= */}
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
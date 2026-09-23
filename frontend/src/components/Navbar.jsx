import { useState } from "react";


export default function Navbar({
  isSidebarCollapsed,
  onToggleSidebar,
}) {
      const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  return (
    <header className="navbar">
      <div className="navbar__brand">
        <button
          className="navbar-menu-toggle"
          onClick={onToggleSidebar}
        >
          <i className="bi bi-list" />
        </button>

        <i class="bi bi-geo-alt"></i>

        <span className="navbar__title">DONGGI</span>

      </div>
      <div className="navbar-user-dropdown">
      <button
        type="button"
        className="navbar-user-button"
        onClick={() => setUserDropdownOpen((prev) => !prev)}
        aria-expanded={userDropdownOpen}
      >
        <div className="navbar-user__avatar">
          <i
            className="bi bi-person-fill"
            aria-hidden="true"
          />
        </div>

        <div className="navbar-user__info">
          <span className="navbar-user__name">
            
              User
          </span>

          <span className="navbar-user__role">
           Superadmin
          </span>
        </div>
        <div className='user-dropdown-toogle'>

        {userDropdownOpen ? (
            <i className=' bi-chevron-up'> </i>
        ):
          <i className=' bi-chevron-down'> </i>
        }
        </div>

      </button>

      {/* DROPDOWN MENU */}
      {userDropdownOpen ? (
        <div className="user-dropdown-menu" role="menu">
          <button
            type="button"
            className="logout-button"
           
          >
            <i className="bi bi-box-arrow-right" aria-hidden="true" />
            Logout
          </button>
        </div>
      ) : null}
    </div>
    </header>
  );
}
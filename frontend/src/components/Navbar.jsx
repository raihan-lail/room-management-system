import { useEffect, useRef, useState } from "react";



export default function Navbar({
  isSidebarCollapsed,
  onToggleSidebar,
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  // const [notifications, setNotifications] = useState([])
 //  const [notificationsLoading, setNotificationsLoading] = useState(false)
 // const [notificationsError, setNotificationsError] = useState('')
      const [userDropdownOpen, setUserDropdownOpen] = useState(false);

       const notificationsContainerRef = useRef(null);

       useEffect(() => {
    if (!notificationsOpen) return

    const handlePointerDown = (event) => {
      const container =
        notificationsContainerRef.current

      if (!container) return

      if (container.contains(event.target)) {
        return
      }

      setNotificationsOpen(false)
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setNotificationsOpen(false)
      }
    }

    document.addEventListener(
      'pointerdown',
      handlePointerDown
    )

    document.addEventListener(
      'keydown',
      handleKeyDown
    )

    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDown
      )

      document.removeEventListener(
        'keydown',
        handleKeyDown
      )
    }
  }, [notificationsOpen])
  return (
    <header className="navbar">
      <div className="navbar__brand">
        <button
          className="navbar-menu-toggle"
          onClick={onToggleSidebar}
        >
          <i className="bi bi-list" />
        </button>

        <i className="bi bi-geo-alt"></i>

        <span className="navbar__title">DONGGI</span>

      </div>
      <div className="navbar__actions">

       <div
      className="navbar-notifications"
      ref={
        notificationsContainerRef
      }
    >
      <button
        type="button"
        className="navbar-icon-button"
        aria-label= "notifications"
        title= "notifications"
        onClick={async () => {
          const nextOpen =
            !notificationsOpen

          setNotificationsOpen(
            nextOpen
          )

          if (!nextOpen) return

          
        }}
      >
        <i
          className="bi bi-bell"
          aria-hidden="true"
        />

        
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
            </span>

            <button
              type="button"
              className="notifications-refresh">
             
            </button>
          </div>

          

          <div className="notifications-dropdown__body">
            <p>Notifications will show heere</p>
          </div>
        </div>
      ) : null}
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
            
              Admin
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
      </div>
    </header>
  );
}
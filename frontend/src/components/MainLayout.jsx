import { useState } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { residentMenu, sidebarMenu } from "../data/sidebar";
import useAuth from "../contexts/useAuth";

const MOBILE_QUERY = "(max-width: 768px)";


export default function MainLayout({ children }) {
  
  const [isCollapsed, setIsCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(MOBILE_QUERY).matches
  );
  const { isResident } = useAuth();
  const menuItems = isResident ? residentMenu : sidebarMenu;

  return (
    <div className={`layout ${isCollapsed ? "is-sidebar-collapsed" : ""}`}>
      <Sidebar
        isCollapsed={isCollapsed}
        onToggle={setIsCollapsed}
        menuItems={menuItems}
      />

      <div className="layout__main">
        <Navbar
          isSidebarCollapsed={isCollapsed}
          onToggleSidebar={() => setIsCollapsed((prev) => !prev)}
        />

        <main className="layout__content">{children}</main>
      </div>
    </div>
  );
}
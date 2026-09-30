import { useState } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { sidebarMenu } from "../data/sidebar";

const MOBILE_QUERY = "(max-width: 768px)";


export default function MainLayout({ children }) {
  /*
   * On mobile the sidebar is a hidden drawer,
   * so it must start collapsed.
   */
  const [isCollapsed, setIsCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(MOBILE_QUERY).matches
  );

  return (
    <div className={`layout ${isCollapsed ? "is-sidebar-collapsed" : ""}`}>
      <Sidebar
        isCollapsed={isCollapsed}
        onToggle={setIsCollapsed}
        menuItems={sidebarMenu}
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
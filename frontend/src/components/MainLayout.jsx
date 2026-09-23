import { useState } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { sidebarMenu } from "../data/sidebar";



export default function MainLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

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
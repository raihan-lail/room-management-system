import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import "./App.css";
import Dashboard from "./pages/Dashboard";
import BookingCalendarView from "./pages/bookings/BookingCalendarView";
import BookingMapView from "./pages/bookings/BookingMapView";
import BookingTableView from "./pages/bookings/BookingTableView";
import RoomManagement from "./pages/rooms/RoomManagement";
import RoomAllocation from "./pages/rooms/RoomAllocations";
import GuestManagement from "./pages/guest/GuestManagement";
import SiteManagement from "./pages/settings/SiteManagement";
import EmployeeManagement from "./pages/settings/EmployeeManagement";
import ManagePermissions from "./pages/settings/ManagePermissions";
import AuditLog from "./pages/settings/AuditLogs";

function App() {
  return (
    <Router>
      <div className="app-shell">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/bookings/calendar" element={<BookingCalendarView />} />
          <Route path="/rooms/map" element={<BookingMapView />} />
          <Route path="/bookings/table" element={<BookingTableView />} />
          <Route path="/rooms/management" element={<RoomManagement />} />
          <Route path="/rooms/allocation" element={<RoomAllocation />} />
          <Route path="/guests/management" element={<GuestManagement />} />
          <Route path="/sites" element={<SiteManagement />} />
          <Route path="/employees" element={<EmployeeManagement />} />
          <Route path="/manage-permissions" element={<ManagePermissions />} />
          <Route path="/audit-logs" element={<AuditLog />} />



          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import "./App.css";
import AuthProvider from "./contexts/auth.provider";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import BookingCalendarView from "./pages/bookings/BookingCalendarView";
import BookingMapView from "./pages/bookings/BookingMapView";
import BookingTableView from "./pages/bookings/BookingTableView";
import RoomManagement from "./pages/rooms/RoomManagement";
import RoomBookingDetails from "./pages/rooms/RoomBookingDetails";
import RoomAllocation from "./pages/rooms/RoomAllocations";
import GuestManagement from "./pages/guest/GuestManagement";
import SiteManagement from "./pages/settings/SiteManagement";
import EmployeeManagement from "./pages/settings/EmployeeManagement";
import ManagePermissions from "./pages/settings/ManagePermissions";
import AuditLog from "./pages/settings/AuditLogs";
import Login from "./pages/auth/login";
import MealType from "./pages/guest/MealType";
import NotFound from "./pages/NotFound";
import RoleManagement from "./pages/settings/RoleManagement";
import FrontDesk from "./pages/FrontDesk";
import Complains from "./pages/bookings/Complains";
import ComplainDetails from "./pages/bookings/ComplainDetails";
import Ratings from "./pages/bookings/Ratings";
import BookingHistory from "./pages/resident-front-office/BookingHistory";
import BookingRating from "./pages/resident-front-office/BookingRating";
import BookingComplaints from "./pages/resident-front-office/BookingComplaints";
import HomeLeave from "./pages/bookings/HomeLeave";
import ChangePassword from "./pages/ChangePassword";

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="app-shell">
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/frontdesk" element={<FrontDesk />} />
              <Route
                path="/bookings/calendar"
                element={<BookingCalendarView />}
              />
              <Route path="/bookings/home-leave" element={<HomeLeave />} />
              <Route path="/bookings/complains" element={<Complains />} />
              <Route path="/bookings/ratings" element={<Ratings />} />
              <Route
                path="/bookings/complains/:complainId"
                element={<ComplainDetails />}
              />
              <Route path="/rooms/map" element={<BookingMapView />} />
              <Route path="/bookings/table" element={<BookingTableView />} />
              <Route path="/rooms/management" element={<RoomManagement />} />
              <Route
                path="/rooms/:roomName/booking-details"
                element={<RoomBookingDetails />}
              />
              <Route path="/rooms/allocation" element={<RoomAllocation />} />
              <Route path="/guests/management" element={<GuestManagement />} />
              <Route path="/guests/meal-type" element={<MealType />} />
              <Route path="/sites" element={<SiteManagement />} />
              <Route path="/employees" element={<EmployeeManagement />} />
              <Route path="/roles" element={<RoleManagement />} />
              <Route
                path="/manage-permissions"
                element={<ManagePermissions />}
              />
              <Route path="/audit-logs" element={<AuditLog />} />
              <Route path="/change-password" element={<ChangePassword />} />
              <Route path="/resident/history" element={<BookingHistory />} />
              <Route
                path="/resident/rating/:bookingId"
                element={<BookingRating />}
              />
              <Route
                path="/resident/complaints/:bookingId"
                element={<BookingComplaints />}
              />

              <Route
                path="/"
                element={<Navigate to="/dashboard" replace />}
              />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;

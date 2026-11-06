import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import "./App.css";
import AuthProvider from "./contexts/auth.provider";
import useAuth from "./contexts/useAuth";
import ProtectedRoute, {
  RequireAccountType,
  RequirePermission,
} from "./components/ProtectedRoute";
import { getDefaultRouteForUser } from "./utils/permissions";
import Dashboard from "./pages/Dashboard";
import BookingCalendarView from "./pages/bookings/BookingCalendarView";
import BookingMapView from "./pages/bookings/BookingMapView";
import BookingTableView from "./pages/bookings/BookingTableView";
import RoomManagement from "./pages/rooms/RoomManagement";
import RoomBookingDetails from "./pages/rooms/RoomBookingDetails";
import RoomAllocation from "./pages/rooms/RoomAllocations";
import GuestManagement from "./pages/guest/GuestManagement";
import ResidentDetails from "./pages/guest/ResidentDetails";
import SiteManagement from "./pages/settings/SiteManagement";
import EmployeeManagement from "./pages/settings/EmployeeManagement";
import ManagePermissions from "./pages/settings/ManagePermissions";
import AuditLog from "./pages/settings/AuditLogs";
import Login from "./pages/auth/login";
import MealType from "./pages/guest/MealType";
import NotFound from "./pages/NotFound";
import Unauthorized from "./pages/Unauthorized";
import RoleManagement from "./pages/settings/RoleManagement";
import FrontDesk from "./pages/FrontDesk";
import HomeLeave from "./pages/bookings/HomeLeave";
import ChangePassword from "./pages/ChangePassword";
import LocationManagement from "./pages/rooms/LocationManagement";
import ForgotPassword from "./pages/auth/ForgotPassword";
import EmailLog from "./pages/settings/EmailLogs";

function DefaultRedirect() {
  const { status, user } = useAuth();

  if (status === "loading") {
    return null;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getDefaultRouteForUser(user)} replace />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="app-shell">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword/>} />

            <Route element={<ProtectedRoute />}>
              <Route path="/unauthorized" element={<Unauthorized />} />

              <Route element={<RequireAccountType accountType="employee" />}>
              <Route
                path="/dashboard"
                element={
                  <RequirePermission permission="dashboard">
                    <Dashboard />
                  </RequirePermission>
                }
              />
              <Route
                path="/frontdesk"
                element={
                  <RequirePermission permission="frontdesk">
                    <FrontDesk />
                  </RequirePermission>
                }
              />
              <Route
                path="/bookings/calendar"
                element={
                  <RequirePermission permission="bookings.calendar">
                    <BookingCalendarView />
                  </RequirePermission>
                }
              />
              <Route
                path="/bookings/home-leave"
                element={
                  <RequirePermission permission="home.leaves">
                    <HomeLeave />
                  </RequirePermission>
                }
              />
              <Route
                path="/rooms/map"
                element={
                  <RequirePermission permission="rooms.map">
                    <BookingMapView />
                  </RequirePermission>
                }
              />
              <Route
                path="/bookings/table"
                element={
                  <RequirePermission permission="bookings.read">
                    <BookingTableView />
                  </RequirePermission>
                }
              />
               <Route
                 path="/rooms/locations"
                 element={
                   <RequirePermission permission="location.read">
                     <LocationManagement />
                   </RequirePermission>
                 }
               />
              <Route
                path="/rooms/management"
                element={
                  <RequirePermission permission="rooms.read">
                    <RoomManagement />
                  </RequirePermission>
                }
              />
              <Route
                path="/rooms/:roomName/booking-details"
                element={
                  <RequirePermission permission="rooms.read">
                    <RoomBookingDetails />
                  </RequirePermission>
                }
              />
              <Route
                path="/rooms/allocation"
                element={
                  <RequirePermission permission="rooms.allocations">
                    <RoomAllocation />
                  </RequirePermission>
                }
              />
              <Route
                path="/guests/management"
                element={
                  <RequirePermission permission="resident.view">
                    <GuestManagement />
                  </RequirePermission>
                }
              />
              <Route
                path="/guests/:residentId"
                element={
                  <RequirePermission permission="resident.read">
                    <ResidentDetails />
                  </RequirePermission>
                }
              />
              <Route
                path="/guests/meal-type"
                element={
                  <RequirePermission permission="meal-type.read">
                    <MealType />
                  </RequirePermission>
                }
              />
              <Route
                path="/sites"
                element={
                  <RequirePermission permission="site.read">
                    <SiteManagement />
                  </RequirePermission>
                }
              />
              <Route
                path="/employees"
                element={
                  <RequirePermission permission="employees.read">
                    <EmployeeManagement />
                  </RequirePermission>
                }
              />
              <Route
                path="/roles"
                element={
                  <RequirePermission permission="roles.read">
                    <RoleManagement />
                  </RequirePermission>
                }
              />
              <Route
                path="/manage-permissions"
                element={
                  <RequirePermission permission="permissions.read">
                    <ManagePermissions />
                  </RequirePermission>
                }
              />
              <Route
                path="/audit-logs"
                element={
                  <RequirePermission permission="audit.logs">
                    <AuditLog />
                  </RequirePermission>
                }
              />
              <Route
                path="/email-logs"
                element={
                  <RequirePermission permission="email.logs">
                    <EmailLog />
                  </RequirePermission>
                }
              />
              </Route>
              

              <Route path="/change-password" element={<ChangePassword />} />


              <Route
                path="/"
                element={<DefaultRedirect />}
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

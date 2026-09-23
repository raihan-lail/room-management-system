import CalendarView from "../../components/CalendarView";
import MainLayout from "../../components/MainLayout";


export default function BookingCalendarView() {
    return (
        <MainLayout>
            <div className="dashboard">
                <div className="dashboard-header">
                     <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Bookings (calendar view)</h1>
            <p className="dashboard-header__subtitle">
              Visualize bookings by room across a date range
            </p>
          </div>

                </div>
                <CalendarView/>
            </div>

        </MainLayout>
    )
}
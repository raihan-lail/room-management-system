import MainLayout from "../../components/MainLayout";

export default function BookingMapView() {
  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Map View</h1>
            <p className="dashboard-header__subtitle">
              booking map will added here
            </p>
          </div>
        </div>

         <div className="bookings-toolbar form-actions">
          <div
            className="permissions-filters"
            style={{ display: "flex", gap: "16px", alignItems: "center" }}
          >
            {/* Location Selector */}
            <div className="page-permission-role-selector">
              <label htmlFor="permission-role">Select Location </label>
              <select
                id="permission-role"
               value="EAST CAMP"
                className="permission-role-selector"
                
              >
               <option value="EAST CAMP">EAST CAMP</option>
                <option value="WEST CAMP">WEST CAMP</option>
              
              </select>
            </div>
              <div className="page-permission-role-selector">
              <label htmlFor="permission-role">Select Floor</label>
              <select
                id="permission-role"
               value="Floor 1"
                className="permission-role-selector"
                
              >
               <option value="EAST CAMP">Floor 1</option>
                <option value="WEST CAMP">Floor 2</option>
              
              </select>
            </div>

           
          </div>
        </div>

        <section className="content ">
            <div className="map-header">
                <p className="map-title">EAST CAMP MAP</p>
                <div className="map-legend">
                    LEGENDS

                </div>
            </div>
            <div className="map-wrapper">

            <img src="/map-example.jpg" alt="" />
            </div>
        </section>
      </div>
    </MainLayout>
  );
}

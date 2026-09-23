import MainLayout from "../../components/MainLayout";
import { useMemo, useState } from "react";
import { rooms } from "../../data/room";

const PAGE_SIZE = 10;


export default function RoomManagement() {
     const [currentPage, setCurrentPage] = useState(1);
     const [search, setSearch] = useState("");

     const filteredRooms = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return rooms;

        return rooms.filter((room) =>
        [
            room.name,
            room.desc,
            room.location,
            room.status,
        ].some((value) =>
        (value || "").toString().toLowerCase().includes(query)
    )
    )
     }, [search]);
     const totalPages = Math.max(1, Math.ceil(filteredRooms.length / PAGE_SIZE));
     const safePage = Math.min(currentPage, totalPages);

      const pagedRooms = useMemo(() => {
         const startIndex = (safePage - 1) * PAGE_SIZE;
         return filteredRooms.slice(startIndex, startIndex + PAGE_SIZE);
       }, [filteredRooms, safePage]);
     
       const startRow = filteredRooms.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
       const endRow = Math.min(safePage * PAGE_SIZE, filteredRooms.length);
     
       const handleSearchChange = (value) => {
         setSearch(value);
         setCurrentPage(1);
       };

    return (
        <MainLayout>
            <div className="dashboard">
                <div className="dashboard-header">
                     <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Room Management</h1>
            <p className="dashboard-header__subtitle">
              Room management will added here
            </p>
          </div>
         

                </div>
                 <div className="bookings-toolbar form-actions">
          <label className="history-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search rooms"
              placeholder="Search by room number, location, status..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </label>

          <div className="bookings-toolbar__actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => console.log("Create new room")}
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
              Create New Room
            </button>

            <button
              type="button"
              className="btn btn-neutral"
              onClick={() => console.log("Import Excel")}
            >
              <i className="bi bi-file-earmark-excel" aria-hidden="true" />
              Export Excel
            </button>
          </div>
        </div>

         <section className="table-card content">
          <div className="office-table-wrapper">
            <table className="office-table">
              <thead>
                <tr>
                  <th className="table-col-no">No</th>
                  <th>Room Number</th>
                  <th>Location</th>
                  <th>Desc</th>
                  <th>Status</th>
                   <th>Action</th>
                  
                </tr>
              </thead>

              <tbody>
                {pagedRooms.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="muted">
                      No rooms found.
                    </td>
                  </tr>
                ) : (
                  pagedRooms.map((room, index) => (
                    <tr
                      key={`${room.name}-${index}`}
                    >
                      <td className="table-col-no">
                        {(safePage - 1) * PAGE_SIZE + index + 1}
                      </td>

                      <td>
                        <strong>{room.name || "-"}</strong>
                      </td>

                      <td>{room.location || "-"}</td>

                      <td>{room.desc || "-"}</td>

                      <td>{room.status || "-"}</td>

                     

                      

                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn btn-neutral"
                            title={`View room  ${room.name || "guest"}`}
                            onClick={() =>
                              console.log("View room:", room)
                            }
                          >
                            <i
                              className="bi bi-eye"
                              aria-hidden="true"
                            />
                          </button>

                          <button
                            type="button"
                            className="btn btn-neutral"
                            title={`Edit room  ${room.name || "guest"}`}
                            onClick={() =>
                              console.log("Edit room:", room)
                            }
                          >
                            <i
                              className="bi bi-pencil-square"
                              aria-hidden="true"
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="office-pagination">
            <span className="office-page-info">
              Showing {startRow}–{endRow} of {filteredRooms.length} rooms
            </span>

            <div className="office-page-nav">
              <button
                type="button"
                className="btn btn-neutral"
                disabled={safePage <= 1}
                onClick={() =>
                  setCurrentPage((prev) => Math.max(1, prev - 1))
                }
              >
                <i className="bi bi-chevron-left" aria-hidden="true" />
                Prev
              </button>

              <span className="office-page-info">
                Page {safePage} of {totalPages}
              </span>

              <button
                type="button"
                className="btn btn-neutral"
                disabled={safePage >= totalPages}
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
              >
                Next
                <i className="bi bi-chevron-right" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
            </div>

        </MainLayout>
    )
}
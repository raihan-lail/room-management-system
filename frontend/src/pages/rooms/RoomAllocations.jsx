import { useMemo, useState } from "react";
import MainLayout from "../../components/MainLayout";

import { roomAllocations } from "../../data/room";


const PAGE_SIZE = 10;

export default function RoomAllocation() {
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));

    setCurrentPage(1);
  };

  const filteredRoomAllocation = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return roomAllocations;

    return roomAllocations.filter((roomAllocation) =>
      [
        roomAllocation.name,
        roomAllocation.type,
        roomAllocation.started_at,
        roomAllocation.ended_at,
        roomAllocation.reason,
        roomAllocation.allocated_by,
        
      ].some((value) => (value || "").toString().toLowerCase().includes(query)),
    );
  }, [search]);

  const sortedRoomAllocations = useMemo(() => {
    if (!sortConfig.key) return filteredRoomAllocation;

    return [...filteredRoomAllocation].sort((a, b) => {
      let aValue;
      let bValue;

      switch (sortConfig.key) {
        case "name":
          aValue = a.name;
          bValue = b.name;
          break;

        case "type":
          aValue = a.type;
          bValue = b.type;
          break;

        case "allocated_by":
          aValue = a.allocated_by;
          bValue = b.allocated_by;
          break;

        

        default:
          return 0;
      }

      aValue = (aValue ?? "").toString().toLowerCase();
      bValue = (bValue ?? "").toString().toLowerCase();

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }

      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }

      return 0;
    });
  }, [filteredRoomAllocation, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedRoomAllocations.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const pagedRoomAllocations = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;

    return sortedRoomAllocations.slice(startIndex, startIndex + PAGE_SIZE);
  }, [sortedRoomAllocations, safePage]);

  const startRow =
    filteredRoomAllocation.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(safePage * PAGE_SIZE, filteredRoomAllocation.length);

  const handleSearchChange = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  return (
    <MainLayout>
      <div className="dashboard">
        {/* HEADER */}
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Room Allocations</h1>

            <p className="dashboard-header__subtitle">
              View and manage room allocations
            </p>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="bookings-toolbar form-actions">
          <label className="history-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search bookings"
              placeholder="Search by room, type, reason..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </label>

          <div className="bookings-toolbar__actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => console.log("Create new booking")}
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
              Create New Allocations
            </button>

            <button
              type="button"
              className="btn btn-neutral"
              onClick={() => console.log("Import Excel")}
            >
              <i className="bi bi-file-earmark-excel" aria-hidden="true" />
              Import Excel
            </button>
          </div>
        </div>

        {/* TABLE CARD */}
        <section className="table-card content">
          <div className="office-table-wrapper">
            <table className="office-table">
              <thead>
                <tr>
                  <th className="table-col-no">No</th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("name")}
                    >
                      Room Number
                      <i className="bi bi-sort-alpha-down" column="name">
                        {" "}
                      </i>
                    </button>
                  </th>

                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("type")}
                    >
                      Allocation Type
                      <i className="bi bi-sort-alpha-down" column="type">
                        {" "}
                      </i>
                    </button>
                  </th>

                 
                  <th>Started At</th>
                  <th>Ended At</th>
                  <th>Allocation Reason</th>
                   <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("allocated_by")}
                    >
                      Allocated By
                      <i className="bi bi-sort-alpha-down" column="allocated_by">
                        {" "}
                      </i>
                    </button>
                  </th>
                 
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {pagedRoomAllocations.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="muted">
                      No room allocation found.
                    </td>
                  </tr>
                ) : (
                  pagedRoomAllocations.map((roomAllocation, index) => (
                    <tr key={`${index}`}>
                      <td className="table-col-no">
                        {(safePage - 1) * PAGE_SIZE + index + 1}
                      </td>

                      <td>
                        <strong>{roomAllocation.name || "-"}</strong>
                      </td>

                      <td>{roomAllocation.type || "-"}</td>

                      <td>{roomAllocation.started_at || "-"}</td>

                      <td>{roomAllocation.ended_at || "-"}</td>

                      <td>{roomAllocation.reason || "-"}</td>

                      <td>{roomAllocation.allocated_by || "-"}</td>

                      

                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn btn-neutral"
                           
                            
                          >
                            <i className="bi bi-eye" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            className="btn btn-neutral"
                            
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
              Showing {startRow}–{endRow} of {filteredRoomAllocation.length} room allocations
            </span>

            <div className="office-page-nav">
              <button
                type="button"
                className="btn btn-neutral"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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
  );
}

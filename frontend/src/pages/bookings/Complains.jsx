import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../../components/MainLayout";
import { complainsData } from "../../data/complains";

const PAGE_SIZE = 10;

export default function Complains() {
  const navigate = useNavigate();

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc"
          ? "desc"
          : "asc",
    }));

    setCurrentPage(1);
  };

  /*
   * SEARCH
   */
  const filteredComplains = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return complainsData;

    return complainsData.filter((complain) =>
      [
        complain.complain_id,
        complain.room,
        complain.name,
        complain.type,
        complain.submitted_date,
        
      ].some((value) =>
        (value || "").toString().toLowerCase().includes(query)
      )
    );
  }, [search]);

  /*
   * SORT
   */
  const sortedComplains = useMemo(() => {
    if (!sortConfig.key) return filteredComplains;

    return [...filteredComplains].sort((a, b) => {
      let aValue;
      let bValue;

      switch (sortConfig.key) {
        case "complain_id":
          aValue = a.complain_id;
          bValue = b.complain_id;
          break;

        case "room":
          aValue = a.room;
          bValue = b.room;
          break;

        case "name":
          aValue = a.name;
          bValue = b.name;
          break;

        case "type":
          aValue = a.type;
          bValue = b.type;
          break;

        case "submitted_date":
          aValue = a.submitted_date;
          bValue = b.submitted_date;
          break;

        case "details":
          aValue = a.details;
          bValue = b.details;
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
  }, [filteredComplains, sortConfig]);

  /*
   * PAGINATION
   */
  const totalPages = Math.max(
    1,
    Math.ceil(sortedComplains.length / PAGE_SIZE)
  );

  const safePage = Math.min(currentPage, totalPages);

  const pagedComplains = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;

    return sortedComplains.slice(
      startIndex,
      startIndex + PAGE_SIZE
    );
  }, [sortedComplains, safePage]);

  const startRow =
    filteredComplains.length === 0
      ? 0
      : (safePage - 1) * PAGE_SIZE + 1;

  const endRow = Math.min(
    safePage * PAGE_SIZE,
    filteredComplains.length
  );

  const handleSearchChange = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  /*
   * VIEW COMPLAINT
   */
  const handleViewComplaint = (complainId) => {
    navigate(`/bookings/complains/${complainId}`);
  };

  return (
    <MainLayout>
      <div className="dashboard">

        {/* HEADER */}
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">
              Complaints
            </h1>

            <p className="dashboard-header__subtitle">
              View and manage guest complaints
            </p>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="bookings-toolbar form-actions">
          <label className="history-search">
            <i
              className="bi bi-search"
              aria-hidden="true"
            />

            <input
              type="search"
              aria-label="Search complaints"
              placeholder="Search by complaint ID, room, name, type..."
              value={search}
              onChange={(event) =>
                handleSearchChange(event.target.value)
              }
            />
          </label>
        </div>

        {/* TABLE CARD */}
        <section className="table-card content">
          <div className="office-table-wrapper">
            <table className="office-table">

              <thead>
                <tr>
                  <th className="table-col-no">
                    No
                  </th>

                  {/* COMPLAINT ID */}
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() =>
                        handleSort("complain_id")
                      }
                    >
                      Complaint ID

                      <i
                        className="bi bi-sort-alpha-down"
                        aria-hidden="true"
                      />
                    </button>
                  </th>

                  {/* ROOM */}
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() =>
                        handleSort("room")
                      }
                    >
                      Room

                      <i
                        className="bi bi-sort-alpha-down"
                        aria-hidden="true"
                      />
                    </button>
                  </th>

                  {/* NAME */}
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() =>
                        handleSort("name")
                      }
                    >
                      Name

                      <i
                        className="bi bi-sort-alpha-down"
                        aria-hidden="true"
                      />
                    </button>
                  </th>

                  {/* TYPE */}
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() =>
                        handleSort("type")
                      }
                    >
                      Type

                      <i
                        className="bi bi-sort-alpha-down"
                        aria-hidden="true"
                      />
                    </button>
                  </th>

                  {/* SUBMITTED DATE */}
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() =>
                        handleSort("submitted_date")
                      }
                    >
                      Submitted Date

                      <i
                        className="bi bi-sort-alpha-down"
                        aria-hidden="true"
                      />
                    </button>
                  </th>

                 

                  <th>
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {pagedComplains.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="muted"
                    >
                      No complaints found.
                    </td>
                  </tr>
                ) : (
                  pagedComplains.map(
                    (complain, index) => (
                      <tr
                        key={complain.complain_id}
                      >
                        {/* NO */}
                        <td className="table-col-no">
                          {(safePage - 1) *
                            PAGE_SIZE +
                            index +
                            1}
                        </td>

                        {/* COMPLAINT ID */}
                        <td>
                          <strong>
                            {complain.complain_id}
                          </strong>
                        </td>

                        {/* ROOM */}
                        <td>
                          {complain.room || "-"}
                        </td>

                        {/* NAME */}
                        <td>
                          {complain.name || "-"}
                        </td>

                        {/* TYPE */}
                        <td>
                          {complain.type || "-"}
                        </td>

                        {/* SUBMITTED DATE */}
                        <td>
                          {complain.submitted_date ||
                            "-"}
                        </td>

                        {/* DETAILS */}
                        

                        {/* ACTION */}
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="btn btn-neutral"
                              title={`View complaint ${complain.complain_id}`}
                              onClick={() =>
                                handleViewComplaint(
                                  complain.complain_id
                                )
                              }
                            >
                              <i
                                className="bi bi-eye"
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="office-pagination">
            <span className="office-page-info">
              Showing {startRow}–{endRow} of{" "}
              {filteredComplains.length} complaints
            </span>

            <div className="office-page-nav">

              <button
                type="button"
                className="btn btn-neutral"
                disabled={safePage <= 1}
                onClick={() =>
                  setCurrentPage((prev) =>
                    Math.max(1, prev - 1)
                  )
                }
              >
                <i
                  className="bi bi-chevron-left"
                  aria-hidden="true"
                />

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
                  setCurrentPage((prev) =>
                    Math.min(
                      totalPages,
                      prev + 1
                    )
                  )
                }
              >
                Next

                <i
                  className="bi bi-chevron-right"
                  aria-hidden="true"
                />
              </button>

            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
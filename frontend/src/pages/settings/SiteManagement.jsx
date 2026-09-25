import MainLayout from "../../components/MainLayout";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sites } from "../../data/sites";

const PAGE_SIZE = 10;

export default function SiteManagement() {
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
        prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };

  const filteredSites = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sites;

    return sites.filter((site) => {
      const siteNameMatch = (site.name || "").toLowerCase().includes(query);
      const locationsMatch = site.locations?.some((loc) =>
        loc.title.toLowerCase().includes(query)
      );
      const roomStatusMatch = site.room_status?.some((st) =>
        st.title.toLowerCase().includes(query)
      );
      const bookingStatusMatch = site.booking_status?.some((st) =>
        st.title.toLowerCase().includes(query)
      );

      return (
        siteNameMatch ||
        locationsMatch ||
        roomStatusMatch ||
        bookingStatusMatch
      );
    });
  }, [search]);

  const sortedSites = useMemo(() => {
    if (!sortConfig.key) return filteredSites;

    return [...filteredSites].sort((a, b) => {
      let aValue = "";
      let bValue = "";

      switch (sortConfig.key) {
        case "name":
          aValue = a.name || "";
          bValue = b.name || "";
          break;
        case "locations":
          aValue = (a.locations || []).map((l) => l.title).join(", ");
          bValue = (b.locations || []).map((l) => l.title).join(", ");
          break;
        default:
          return 0;
      }

      aValue = aValue.toString().toLowerCase();
      bValue = bValue.toString().toLowerCase();

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredSites, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filteredSites.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const pagedSites = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;
    return sortedSites.slice(startIndex, startIndex + PAGE_SIZE);
  }, [sortedSites, safePage]);

  const startRow =
    filteredSites.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(safePage * PAGE_SIZE, filteredSites.length);

  const handleSearchChange = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Site Management</h1>
            <p className="dashboard-header__subtitle">
              Manage sites, camp locations, room statuses, and booking configurations
            </p>
          </div>
        </div>

        <div className="bookings-toolbar form-actions">
          <label className="history-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search sites"
              placeholder="Search by site name, camp location, or status..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </label>

          <div className="bookings-toolbar__actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => console.log("Create new site")}
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
              Create New Site
            </button>

            <button
              type="button"
              className="btn btn-neutral"
              onClick={() => console.log("Export Excel")}
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
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("name")}
                    >
                      Site Name
                      <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("locations")}
                    >
                      Camp Locations
                      <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                    </button>
                  </th>
                  <th>Room Statuses</th>
                  <th>Booking Statuses</th>
                  <th>Timezone</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {pagedSites.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="muted text-center">
                      No sites found.
                    </td>
                  </tr>
                ) : (
                  pagedSites.map((site, index) => (
                    <tr key={`${site.name}-${index}`}>
                      <td className="table-col-no">
                        {(safePage - 1) * PAGE_SIZE + index + 1}
                      </td>

                      <td>
                        <strong>{site.name || "-"}</strong>
                      </td>

                      <td>
                        <div className="tags-container" style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {site.locations && site.locations.length > 0
                            ? site.locations.map((loc, idx) => (
                                <span key={idx} className="badge badge-neutral">
                                  {loc.title}
                                </span>
                              ))
                            : "-"}
                        </div>
                      </td>

                      <td>
                        <div className="tags-container" style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {site.room_status && site.room_status.length > 0
                            ? site.room_status.map((status, idx) => (
                                <span key={idx} className="badge badge-info">
                                  {status.title}
                                </span>
                              ))
                            : "-"}
                        </div>
                      </td>

                      <td>
                        <div className="tags-container" style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {site.booking_status && site.booking_status.length > 0
                            ? site.booking_status.map((status, idx) => (
                                <span key={idx} className="badge badge-success">
                                  {status.title}
                                </span>
                              ))
                            : "-"}
                        </div>
                      </td>
                      <td>{site.timezone}</td>

                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn btn-neutral"
                            title={`View site ${site.name}`}
                            onClick={() =>
                              navigate(`/sites/${site.name.toLowerCase()}`)
                            }
                          >
                            <i className="bi bi-eye" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            className="btn btn-neutral"
                            title={`Edit site ${site.name}`}
                            onClick={() => console.log("Edit site:", site)}
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
              Showing {startRow}–{endRow} of {filteredSites.length} sites
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
  );
}
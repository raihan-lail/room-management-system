import MainLayout from "../../components/MainLayout";
import { useMemo, useState } from "react";
import { auditLogsData } from "../../data/auditLog";


const PAGE_SIZE = 10;

// Dummy Audit Logs Data


export default function AuditLog() {
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedModule, setSelectedModule] = useState("ALL");
  const [sortConfig, setSortConfig] = useState({
    key: "timestamp",
    direction: "desc",
  });

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return auditLogsData.filter((log) => {
      const matchesModule =
        selectedModule === "ALL" || log.module === selectedModule;

      const matchesSearch = [
        log.id,
        log.timestamp,
        log.user,
        log.email,
        log.action,
        log.module,
        log.ip_address,
        log.details,
        log.status,
      ].some((val) => (val || "").toString().toLowerCase().includes(query));

      return matchesModule && matchesSearch;
    });
  }, [search, selectedModule]);

  const sortedLogs = useMemo(() => {
    if (!sortConfig.key) return filteredLogs;

    return [...filteredLogs].sort((a, b) => {
      let aValue = a[sortConfig.key] ?? "";
      let bValue = b[sortConfig.key] ?? "";

      aValue = aValue.toString().toLowerCase();
      bValue = bValue.toString().toLowerCase();

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredLogs, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const pagedLogs = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;
    return sortedLogs.slice(startIndex, startIndex + PAGE_SIZE);
  }, [sortedLogs, safePage]);

  const startRow =
    filteredLogs.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(safePage * PAGE_SIZE, filteredLogs.length);

  const handleSearchChange = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Audit Logs</h1>
            <p className="dashboard-header__subtitle">
              Track user activities, system security events, and configuration changes
            </p>
          </div>
        </div>

        <div className="bookings-toolbar form-actions">
          <label className="history-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search audit logs"
              placeholder="Search by user, action, IP, or details..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </label>

          <div className="bookings-toolbar__actions">
            <div className="page-permission-role-selector">
              <select
                id="module-filter"
                value={selectedModule}
                className="permission-role-selector"
                onChange={(e) => {
                  setSelectedModule(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="ALL">All Modules</option>
                <option value="Booking Management">Booking Management</option>
                <option value="Room Management">Room Management</option>
                <option value="Site Management">Site Management</option>
                <option value="User Management">User Management</option>
                <option value="Permissions">Permissions</option>
                <option value="Authentication">Authentication</option>
              </select>
            </div>

            <button
              type="button"
              className="btn btn-neutral"
              onClick={() => console.log("Exporting logs to Excel...")}
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
                      onClick={() => handleSort("timestamp")}
                    >
                      Timestamp
                      <i className="bi bi-sort-numeric-down" aria-hidden="true" />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("user")}
                    >
                      User
                      <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                    </button>
                  </th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Details</th>
                  <th>IP Address</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {pagedLogs.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="muted text-center">
                      No audit logs found.
                    </td>
                  </tr>
                ) : (
                  pagedLogs.map((log, index) => (
                    <tr key={log.id || index}>
                      <td className="table-col-no">
                        {(safePage - 1) * PAGE_SIZE + index + 1}
                      </td>

                      <td style={{ whiteSpace: "nowrap" }}>
                        <small>{log.timestamp}</small>
                      </td>

                      <td>
                        <strong>{log.user}</strong>
                        <br />
                        <small className="muted">{log.email}</small>
                      </td>

                      <td>
                        <span className="badge badge-neutral">{log.action}</span>
                      </td>

                      <td>{log.module}</td>

                      <td style={{ maxWidth: "280px" }}>
                        <span title={log.details}>{log.details}</span>
                      </td>

                      <td>
                        <code>{log.ip_address}</code>
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            log.status === "SUCCESS"
                              ? "badge-success"
                              : "badge-danger"
                          }`}
                        >
                          {log.status}
                        </span>
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
              Showing {startRow}–{endRow} of {filteredLogs.length} logs
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

import MainLayout from "../../components/MainLayout";
import { useEffect, useState } from "react";
import apiRequest from "../../api/client";

const PAGE_SIZE = 10;

const INITIAL_FILTERS = {
  actor: "",
  action: "",
  resource: "",
  resourceId: "",
  startDate: "",
  endDate: "",
};

function formatTimestamp(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function formatJson(value) {
  if (value == null) return "-";
  return JSON.stringify(value, null, 2);
}

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [selectedLogId, setSelectedLogId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch audit logs from the API.
  useEffect(() => {
    const controller = new AbortController();

    // Debounce text search and filter changes.
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(PAGE_SIZE),
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      // These parameters must be supported by the backend.
      Object.entries(filters).forEach(([key, value]) => {
        if (value.trim()) {
          params.set(key, value.trim());
        }
      });

      try {
        const response = await apiRequest(
          `/api/audit?${params.toString()}`,
          { signal: controller.signal }
        );

        setLogs(response.data ?? []);
        setPagination(
          response.pagination ?? {
            page: currentPage,
            pageSize: PAGE_SIZE,
            total: 0,
            totalPages: 0,
          }
        );
      } catch (err) {
        if (err.name === "AbortError") return;

        setError(err.message || "Failed to load audit logs.");
        setLogs([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [currentPage, search, filters]);

 

  function handleSearchChange(value) {
    setSearch(value);
    setCurrentPage(1);
    setSelectedLogId(null);
  }

  function clearFilters() {
    setSearch("");
    setFilters(INITIAL_FILTERS);
    setCurrentPage(1);
    setSelectedLogId(null);
  }

  const totalPages = pagination.totalPages || 0;
  const startRow =
    pagination.total === 0
      ? 0
      : (currentPage - 1) * PAGE_SIZE + 1;

  const endRow = Math.min(
    currentPage * PAGE_SIZE,
    pagination.total
  );

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">
              Audit Logs
            </h1>

            <p className="dashboard-header__subtitle">
              Track user activities, system security events,
              and configuration changes
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="bookings-toolbar form-actions">
          <label className="history-search">
            <i className="bi bi-search" aria-hidden="true" />

            <input
              type="search"
              aria-label="Search audit logs"
              placeholder="Search user, action, resource, or details..."
              value={search}
              onChange={(event) =>
                handleSearchChange(event.target.value)
              }
            />
          </label>

          <div className="bookings-toolbar__actions">
            <button
              type="button"
              className="btn btn-neutral"
              onClick={clearFilters}
            >
              <i className="bi bi-x-circle" aria-hidden="true" />
              Clear Filters
            </button>

            <button
              type="button"
              className="btn btn-neutral"
              onClick={() =>
                console.log("Implement server-side Excel export")
              }
            >
              <i
                className="bi bi-file-earmark-excel"
                aria-hidden="true"
              />
              Export Excel
            </button>
          </div>
        </div>

        {/* Filters */}
        <section className="table-card content">
         

          {error && (
            <div className="audit-error" role="alert">
              {error}
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => setCurrentPage((page) => page)}
              >
                Retry
              </button>
            </div>
          )}

          <div className="office-table-wrapper">
            <table className="office-table">
              <thead>
                <tr>
                  <th className="table-col-no">No</th>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Resource ID</th>
                  <th>Description</th>
                  <th>Details</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="muted text-center">
                      Loading audit logs...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="muted text-center">
                      Unable to load audit logs.
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="muted text-center">
                      No audit logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log, index) => (
                    <>
                      <tr key={log.id}>
                        <td className="table-col-no">
                          {startRow + index}
                        </td>

                        <td style={{ whiteSpace: "nowrap" }}>
                          <small>
                            {formatTimestamp(log.createdAt)}
                          </small>
                        </td>

                        <td>
                          <strong>
                            {log.actorName || "Unknown user"}
                          </strong>
                          <br />
                          <small className="muted">
                            {log.actorUserId || "System"}
                          </small>
                        </td>

                        <td>
                          <span className="badge badge-neutral">
                            {log.action}
                          </span>
                        </td>

                        <td>{log.resource}</td>

                        <td>
                          <code>{log.resourceId || "-"}</code>
                        </td>

                        <td style={{ maxWidth: "280px" }}>
                          <span title={log.description || ""}>
                            {log.description || "-"}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="btn btn-neutral"
                            onClick={() =>
                              setSelectedLogId((current) =>
                                current === log.id ? null : log.id
                              )
                            }
                          >
                            {selectedLogId === log.id
                              ? "Hide"
                              : "View"}
                          </button>
                        </td>
                      </tr>

                      {selectedLogId === log.id && (
                        <tr key={`${log.id}-details`}>
                          <td colSpan={8}>
                            <div className="audit-log-details">
                              <h4>Audit Event Details</h4>

                              <p>
                                <strong>Event ID:</strong>{" "}
                                {log.id}
                              </p>

                              <p>
                                <strong>Actor user ID:</strong>{" "}
                                {log.actorUserId || "-"}
                              </p>

                              <p>
                                <strong>IP address:</strong>{" "}
                                {log.ipAddress || "-"}
                              </p>

                              <p>
                                <strong>User agent:</strong>{" "}
                                {log.userAgent || "-"}
                              </p>

                              <div className="audit-log-changes">
                                <div>
                                  <strong>Before</strong>
                                  <pre>
                                    {formatJson(log.before)}
                                  </pre>
                                </div>

                                <div>
                                  <strong>After</strong>
                                  <pre>
                                    {formatJson(log.after)}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Server-side pagination */}
          <div className="office-pagination">
            <span className="office-page-info">
              Showing {startRow}–{endRow} of {pagination.total} logs
            </span>

            <div className="office-page-nav">
              <button
                type="button"
                className="btn btn-neutral"
                disabled={loading || currentPage <= 1}
                onClick={() =>
                  setCurrentPage((page) => Math.max(1, page - 1))
                }
              >
                <i className="bi bi-chevron-left" aria-hidden="true" />
                Prev
              </button>

              <span className="office-page-info">
                Page {currentPage} of {Math.max(1, totalPages)}
              </span>

              <button
                type="button"
                className="btn btn-neutral"
                disabled={
                  loading ||
                  totalPages === 0 ||
                  currentPage >= totalPages
                }
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.min(totalPages, page + 1)
                  )
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

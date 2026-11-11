import MainLayout from "../../components/MainLayout";
import { Fragment, useEffect, useState } from "react";
import apiRequest from "../../api/client";
import PageSizeSelect from "../../components/PageSizeSelect";

const PAGE_SIZE = 10;

function formatTimestamp(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function formatLabel(value) {
  if (!value) return "-";

  return value.replaceAll("_", " ");
}

export default function EmailLog() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [selectedLogId, setSelectedLogId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [emailEnabled, setEmailEnabled] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingEmailSetting, setSavingEmailSetting] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  // Load the booking email sending setting.
  useEffect(() => {
    let active = true;

    async function loadEmailSettings() {
      try {
        const response = await apiRequest("/api/email-log/settings");

        if (active) {
          setEmailEnabled(
            Boolean(response.data?.emailEnabled)
          );
        }
      } catch (err) {
        if (active) {
          setSettingsError(
            err.message || "Failed to load email settings."
          );
        }
      } finally {
        if (active) setSettingsLoading(false);
      }
    }

    loadEmailSettings();

    return () => {
      active = false;
    };
  }, []);

  // Fetch email logs from the API.
  useEffect(() => {
    const controller = new AbortController();

    // Debounce text search and filter changes.
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      try {
        const response = await apiRequest(
          `/api/email-log?${params.toString()}`,
          { signal: controller.signal }
        );

        setLogs(response.data ?? []);
        setPagination(
          response.pagination ?? {
            page: currentPage,
            limit: pageSize,
            total: 0,
            totalPages: 0,
          }
        );
      } catch (err) {
        if (err.name === "AbortError") return;

        setError(err.message || "Failed to load email logs.");
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
  }, [currentPage, pageSize, search, reloadKey]);

  function handleSearchChange(value) {
    setSearch(value);
    setCurrentPage(1);
    setSelectedLogId(null);
  }

  function clearFilters() {
    setSearch("");
    setCurrentPage(1);
    setSelectedLogId(null);
  }

  async function handleToggleEmailSetting() {
    setSavingEmailSetting(true);
    setSettingsError("");

    try {
      const response = await apiRequest("/api/email-log/settings", {
        method: "PATCH",
        body: JSON.stringify({
          emailEnabled: !emailEnabled,
        }),
      });

      setEmailEnabled(
        Boolean(response.data?.emailEnabled)
      );
    } catch (err) {
      setSettingsError(
        err.message || "Failed to update email settings."
      );
    } finally {
      setSavingEmailSetting(false);
    }
  }

  const totalPages = pagination.totalPages || 0;
  const startRow =
    pagination.total === 0
      ? 0
      : (currentPage - 1) * pageSize + 1;

  const endRow = Math.min(
    currentPage * pageSize,
    pagination.total
  );

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">
              Email Logs
            </h1>

            <p className="dashboard-header__subtitle">
              Track outgoing emails, delivery status, and failures
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="bookings-toolbar form-actions">
          <label className="history-search">
            <i className="bi bi-search" aria-hidden="true" />

            <input
              type="search"
              aria-label="Search email logs"
              placeholder="Search recipient or subject..."
              value={search}
              onChange={(event) =>
                handleSearchChange(event.target.value)
              }
            />
          </label>

          <div className="bookings-toolbar__actions">
            {settingsError && (
              <span className="muted" role="alert">
                {settingsError}
              </span>
            )}

            <span className="muted">
              Email sending
            </span>

            <button
              type="button"
              role="switch"
              aria-checked={emailEnabled}
              aria-label="Email sending"
              className={`driver-availability-toggle ${
                emailEnabled ? "is-on" : "is-off"
              }`}
              disabled={settingsLoading || savingEmailSetting}
              onClick={handleToggleEmailSetting}
              title={
                emailEnabled
                  ? "Turn email sending off"
                  : "Turn email sending on"
              }
            >
              <i
                className={`bi ${
                  emailEnabled
                    ? "bi-toggle-on"
                    : "bi-toggle-off"
                }`}
                aria-hidden="true"
              />
              <span>
                {savingEmailSetting
                  ? "Saving..."
                  : emailEnabled
                    ? "On"
                    : "Off"}
              </span>
            </button>

            <button
              type="button"
              className="btn btn-neutral"
              onClick={clearFilters}
            >
              <i className="bi bi-x-circle" aria-hidden="true" />
              Clear Filters
            </button>
          </div>
        </div>

        <section className="table-card content">
          {error && (
            <div className="audit-error" role="alert">
              {error}
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => setReloadKey((key) => key + 1)}
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
                  <th>Created</th>
                  <th>Recipient</th>
                  <th>Subject</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>User</th>
                  <th>Booking</th>
                  <th>Site</th>
                  <th>Details</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="muted text-center">
                      Loading email logs...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={10} className="muted text-center">
                      Unable to load email logs.
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="muted text-center">
                      No email logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log, index) => (
                    <Fragment key={log.id}>
                      <tr>
                        <td className="table-col-no">
                          {startRow + index}
                        </td>

                        <td style={{ whiteSpace: "nowrap" }}>
                          <small>
                            {formatTimestamp(log.createdAt)}
                          </small>
                        </td>

                        <td>
                          <strong>{log.recipient}</strong>
                        </td>

                        <td style={{ maxWidth: "260px" }}>
                          <span title={log.subject || ""}>
                            {log.subject || "-"}
                          </span>
                        </td>

                        <td>{formatLabel(log.type)}</td>

                        <td>
                          <span className="badge badge-neutral">
                            {log.status}
                          </span>
                        </td>

                        <td>
                          {log.user?.email || "-"}
                        </td>

                        <td>
                          {log.booking?.bookingNumber || "-"}
                        </td>

                        <td>{log.site?.name || "-"}</td>

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
                        <tr>
                          <td colSpan={10}>
                            <div className="audit-log-details">
                              <h4>Email Log Details</h4>

                              <p>
                                <strong>Log ID:</strong>{" "}
                                {log.id}
                              </p>

                              <p>
                                <strong>Message ID:</strong>{" "}
                                {log.messageId || "-"}
                              </p>

                              <p>
                                <strong>Sent at:</strong>{" "}
                                {formatTimestamp(log.sentAt)}
                              </p>

                              <p>
                                <strong>Attempts:</strong>{" "}
                                {log.attempts ?? 0}
                              </p>

                              <p>
                                <strong>Error:</strong>{" "}
                                {log.error || "-"}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
              <PageSizeSelect
                value={pageSize}
                onChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              />

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

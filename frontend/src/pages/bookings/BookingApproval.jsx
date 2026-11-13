import { useCallback, useEffect, useMemo, useState } from "react";
import MainLayout from "../../components/MainLayout";
import PageSizeSelect from "../../components/PageSizeSelect";
import TableRowActions from "../../components/TableRowActions";
import apiRequest from "../../api/client";

const PAGE_SIZE = 10;

const TYPE_LABELS = {
  CHANGE_DATES: "Change dates",
  EXTEND: "Extension",
  CANCEL: "Cancellation",
  OTHER: "Other",
};

const FIELD_LABELS = {
  residentId: "Resident",
  bedId: "Bed",
  startedAt: "Start date",
  endedAt: "End date",
  notes: "Notes",
  operation: "Operation",
};

function formatValue(field, value) {
  if (value == null || value === "") return "—";

  if (["startedAt", "endedAt"].includes(field)) {
    return new Date(value).toLocaleDateString("en-GB");
  }

  return String(value);
}

function formatReference(booking, field, value, requestedBed) {
  if (field === "residentId") {
    return booking.resident?.id === value
      ? booking.resident?.fullName
      : value;
  }

  if (field === "bedId") {
    if (booking.bed?.id === value) {
      return `${booking.bed?.room?.name ?? "Room"} · ${booking.bed?.name}`;
    }

    return requestedBed
      ? `${requestedBed.room?.name ?? "Room"} · ${requestedBed.name}`
      : "Unavailable bed";
  }

  return formatValue(field, value);
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-GB") : "-";
}

export default function BookingApproval() {
  const [activeTab, setActiveTab] = useState("upcoming");
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await apiRequest(activeTab === "history"
        ? "/api/booking-approval/history"
        : "/api/booking-approval?status=PENDING");

      setRequests(Array.isArray(response?.data) ? response.data : []);
    } catch (err) {
      setError(err.message || "Failed to load booking change requests.");
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  const selectTab = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearch("");
    setSortConfig({ key: null, direction: "asc" });
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadRequests();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadRequests]);

  const review = async (request, decision, reason = "") => {
    setBusyId(request.id);
    setError("");

    try {
      await apiRequest(`/api/booking-approval/${request.id}/review`, {
        method: "PATCH",
        body: JSON.stringify({
          decision,
          rejectionReason: reason,
        }),
      });

      await loadRequests();
      window.dispatchEvent(new Event("booking-approvals:updated"));

      return true;
    } catch (err) {
      setError(err.message || "Failed to review the request.");

      return false;
    } finally {
      setBusyId("");
    }
  };

  const openRejectModal = (request) => {
    setError("");
    setRejectionReason("");
    setRejectingRequest(request);
  };

  const closeRejectModal = () => {
    if (busyId) return;

    setError("");
    setRejectionReason("");
    setRejectingRequest(null);
  };

  const handleRejectSubmit = async (event) => {
    event.preventDefault();

    const reason = rejectionReason.trim();

    if (!rejectingRequest || !reason) return;

    const succeeded = await review(rejectingRequest, "REJECTED", reason);

    if (succeeded) {
      setRejectionReason("");
      setRejectingRequest(null);
    }
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));

    setCurrentPage(1);
  };

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return requests;

    return requests.filter((request) =>
      [
        request.booking?.bookingNumber,
        request.booking?.resident?.fullName,
        request.requestedBy?.name,
        request.reason,
        TYPE_LABELS[request.type],
      ].some((value) =>
        (value || "").toString().toLowerCase().includes(query)
      )
    );
  }, [requests, search]);

  const sortedRequests = useMemo(() => {
    if (!sortConfig.key) return filteredRequests;

    return [...filteredRequests].sort((a, b) => {
      const getValue = (request) => {
        switch (sortConfig.key) {
          case "booking":
            return request.booking?.bookingNumber ?? "";
          case "requested_by":
            return request.requestedBy?.name ?? "";
          case "requested_at":
            return request.requestedAt ?? "";
          default:
            return "";
        }
      };

      const aValue = String(getValue(a)).toLowerCase();
      const bValue = String(getValue(b)).toLowerCase();

      const result = aValue.localeCompare(bValue, undefined, {
        numeric: true,
      });

      return sortConfig.direction === "asc" ? result : -result;
    });
  }, [filteredRequests, sortConfig]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedRequests.length / pageSize)
  );

  const safePage = Math.min(currentPage, totalPages);

  const pagedRequests = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;

    return sortedRequests.slice(startIndex, startIndex + pageSize);
  }, [sortedRequests, pageSize, safePage]);

  const startRow =
    filteredRequests.length === 0 ? 0 : (safePage - 1) * pageSize + 1;

  const endRow = Math.min(
    safePage * pageSize,
    filteredRequests.length
  );

  return (
    <MainLayout>
      <div className="dashboard">
        {/* HEADER */}
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">
              Booking Change Requests
            </h1>

            <p className="dashboard-header__subtitle">
              Review requested booking updates and see completed decisions.
            </p>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="bookings-toolbar form-actions">
          <label className="history-search">
            <i className="bi bi-search" aria-hidden="true" />

            <input
              type="search"
              aria-label={`Search ${activeTab === "history" ? "booking request history" : "upcoming booking requests"}`}
              placeholder="Search by booking ID, resident, requested by..."
              value={search}
              onChange={(event) =>
                handleSearchChange(event.target.value)
              }
            />
          </label>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {/* TABLE CARD */}
        <section className="table-card content">
          <div className="detail-card__head detail-card__head--tabs">
            <div className="detail-tabs" role="tablist" aria-label="Booking approval requests">
              <button type="button" role="tab" aria-selected={activeTab === "upcoming"} className={`detail-tab ${activeTab === "upcoming" ? "is-active" : ""}`} onClick={() => selectTab("upcoming")}>
                Upcoming Requests
              </button>
              <button type="button" role="tab" aria-selected={activeTab === "history"} className={`detail-tab ${activeTab === "history" ? "is-active" : ""}`} onClick={() => selectTab("history")}>
                Request History
              </button>
            </div>
          </div>
          <div className="office-table-wrapper">
            <table className="office-table">
              <thead>
                <tr>
                  <th className="table-col-no">No</th>

                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("booking")}
                    >
                      Booking
                      <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                    </button>
                  </th>

                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("requested_by")}
                    >
                      Requested by
                      <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                    </button>
                  </th>

                  <th>Requested changes</th>

                  <th>Reason</th>

                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => handleSort("requested_at")}
                    >
                      Requested at
                      <i className="bi bi-sort-alpha-down" aria-hidden="true" />
                    </button>
                  </th>

                  <th>{activeTab === "history" ? "Review" : "Action"}</th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      Loading requests...
                    </td>
                  </tr>
                ) : pagedRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      {activeTab === "history" ? "There is no booking request history." : "There are no pending booking change requests."}
                    </td>
                  </tr>
                ) : (
                  pagedRequests.map((request, index) => {
                    const oldData = request.oldData || {};
                    const requestedData = request.requestedData || {};

                    return (
                      <tr key={request.id}>
                        <td className="table-col-no">
                          {(safePage - 1) * pageSize + index + 1}
                        </td>

                        <td>
                          <strong>
                            {request.booking?.bookingNumber || "-"}
                          </strong>
                          <br />
                          <span className="muted">
                            {request.booking?.resident?.fullName || "-"}
                          </span>
                        </td>

                        <td>{request.requestedBy?.name || "-"}</td>

                        <td>
                          {Object.keys(requestedData).length === 0 ? (
                            TYPE_LABELS[request.type] || request.type || "-"
                          ) : (
                            Object.entries(requestedData).map(
                              ([field, value]) => (
                                <div key={field}>
                                  <strong>
                                    {FIELD_LABELS[field] || field}:
                                  </strong>{" "}
                                  {formatReference(
                                    request.booking || {},
                                    field,
                                  oldData[field],
                                  request.requestedBed
                                  )}{" "}
                                  →{" "}
                                  {formatReference(
                                    request.booking || {},
                                    field,
                                  value,
                                  request.requestedBed
                                  )}
                                </div>
                              )
                            )
                          )}
                        </td>

                        <td>{request.reason || "—"}</td>

                        <td>{formatDate(request.requestedAt)}</td>

                        <td>
                          {activeTab === "history" ? (
                            <>
                              <strong>{request.status === "APPROVED" ? "Approved" : "Rejected"}</strong>
                              <br />
                              <span className="muted">{request.reviewedBy?.name || "-"} · {formatDate(request.reviewedAt)}</span>
                              {request.rejectionReason && <><br /><span className="muted">{request.rejectionReason}</span></>}
                            </>
                          ) : busyId === request.id ? (
                            <span className="muted">Processing...</span>
                          ) : (
                            <TableRowActions
                              label="change request"
                              rowLabel={request.booking?.bookingNumber}
                              permission="bookings.approve"
                              actions={[
                                {
                                  label: "Approve",
                                  icon: "bi bi-check2",
                                  onClick: () =>
                                    review(request, "APPROVED"),
                                },
                                {
                                  label: "Reject",
                                  icon: "bi bi-x-lg",
                                  danger: true,
                                  onClick: () => openRejectModal(request),
                                },
                              ]}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="office-pagination">
            <span className="office-page-info">
              Showing {startRow}–{endRow} of {filteredRequests.length} {activeTab === "history" ? "historical" : "pending"} change requests
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
                  setCurrentPage((prev) =>
                    Math.min(totalPages, prev + 1)
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

      {rejectingRequest && (
        <div className="modal-overlay" onMouseDown={closeRejectModal}>
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-request-title"
            onSubmit={handleRejectSubmit}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal__header">
              <h2 className="modal__title" id="reject-request-title">
                Reject change request
              </h2>

              <button
                type="button"
                className="modal__close"
                onClick={closeRejectModal}
                aria-label="Close"
                disabled={Boolean(busyId)}
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>

            <p className="modal__message">
              Reject the change request for booking{" "}
              {rejectingRequest.booking?.bookingNumber || "-"}? The
              rejection reason is shared with the requester.
            </p>

            <div className="form-stack">
              <label className="form-field">
                <span>Rejection reason</span>

                <textarea
                  rows="3"
                  required
                  placeholder="Explain why this change request is rejected"
                  value={rejectionReason}
                  onChange={(event) =>
                    setRejectionReason(event.target.value)
                  }
                  disabled={Boolean(busyId)}
                />
              </label>
            </div>

            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}

            <div className="modal__actions">
              <button
                type="button"
                className="btn btn-neutral"
                onClick={closeRejectModal}
                disabled={Boolean(busyId)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-danger"
                disabled={Boolean(busyId) || !rejectionReason.trim()}
              >
                {busyId ? "Rejecting..." : "Reject Request"}
              </button>
            </div>
          </form>
        </div>
      )}
    </MainLayout>
  );
}

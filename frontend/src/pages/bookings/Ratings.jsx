import { useMemo, useState } from "react";
import MainLayout from "../../components/MainLayout";
import { ratingsData } from "../../data/ratings";

const PAGE_SIZE = 10;

export default function Ratings() {

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
  const filteredRatings = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return ratingsData;

    return ratingsData.filter((rating) =>
      [
        rating.rating_id,
        rating.room,
        rating.name,
        rating.score,
        rating.submitted_date,
        rating.details,
      ].some((value) =>
        (value || "")
          .toString()
          .toLowerCase()
          .includes(query)
      )
    );
  }, [search]);

  /*
   * SORT
   */
  const sortedRatings = useMemo(() => {
    if (!sortConfig.key) return filteredRatings;

    return [...filteredRatings].sort((a, b) => {
      let aValue;
      let bValue;

      switch (sortConfig.key) {
        case "rating_id":
          aValue = a.rating_id;
          bValue = b.rating_id;
          break;

        case "room":
          aValue = a.room;
          bValue = b.room;
          break;

        case "name":
          aValue = a.name;
          bValue = b.name;
          break;

        case "score":
          aValue = a.score;
          bValue = b.score;
          break;

        case "submitted_date":
          aValue = a.submitted_date;
          bValue = b.submitted_date;
          break;

        default:
          return 0;
      }

      // Numeric sorting for score
      if (sortConfig.key === "score") {
        return sortConfig.direction === "asc"
          ? aValue - bValue
          : bValue - aValue;
      }

      aValue = (aValue ?? "")
        .toString()
        .toLowerCase();

      bValue = (bValue ?? "")
        .toString()
        .toLowerCase();

      if (aValue < bValue) {
        return sortConfig.direction === "asc"
          ? -1
          : 1;
      }

      if (aValue > bValue) {
        return sortConfig.direction === "asc"
          ? 1
          : -1;
      }

      return 0;
    });
  }, [filteredRatings, sortConfig]);

  /*
   * PAGINATION
   */
  const totalPages = Math.max(
    1,
    Math.ceil(sortedRatings.length / PAGE_SIZE)
  );

  const safePage = Math.min(
    currentPage,
    totalPages
  );

  const pagedRatings = useMemo(() => {
    const startIndex =
      (safePage - 1) * PAGE_SIZE;

    return sortedRatings.slice(
      startIndex,
      startIndex + PAGE_SIZE
    );
  }, [sortedRatings, safePage]);

  const startRow =
    filteredRatings.length === 0
      ? 0
      : (safePage - 1) * PAGE_SIZE + 1;

  const endRow = Math.min(
    safePage * PAGE_SIZE,
    filteredRatings.length
  );

  const handleSearchChange = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  /*
   * VIEW RATING
   */
  

  /*
   * RENDER STARS
   */
  const renderStars = (score) => {
    return (
      <div
        className="rating-stars"
        aria-label={`${score} out of 5 stars`}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <i
            key={star}
            className={
              star <= score
                ? "bi bi-star-fill"
                : "bi bi-star"
            }
            aria-hidden="true"
          />
        ))}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="dashboard">

        {/* HEADER */}
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">
              Ratings
            </h1>

            <p className="dashboard-header__subtitle">
              View and manage guest ratings
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
              aria-label="Search ratings"
              placeholder="Search by rating ID, room, name, score..."
              value={search}
              onChange={(event) =>
                handleSearchChange(
                  event.target.value
                )
              }
            />
          </label>

           <div className="bookings-toolbar__actions">
           

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

        {/* TABLE */}
        <section className="table-card content">
          <div className="office-table-wrapper">
            <table className="office-table">

              <thead>
                <tr>

                  <th className="table-col-no">
                    No
                  </th>

                  {/* RATING ID */}
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() =>
                        handleSort("rating_id")
                      }
                    >
                      Rating ID

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

                  {/* SCORE */}
                  <th>
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() =>
                        handleSort("score")
                      }
                    >
                      Rating

                      <i
                        className="bi bi-sort-down"
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
                        handleSort(
                          "submitted_date"
                        )
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
                    Details
                  </th>

                  <th>
                    Action
                  </th>

                </tr>
              </thead>

              <tbody>
                {pagedRatings.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="muted"
                    >
                      No ratings found.
                    </td>
                  </tr>
                ) : (
                  pagedRatings.map(
                    (rating, index) => (
                      <tr
                        key={rating.rating_id}
                      >

                        {/* NO */}
                        <td className="table-col-no">
                          {(safePage - 1) *
                            PAGE_SIZE +
                            index +
                            1}
                        </td>

                        {/* RATING ID */}
                        <td>
                          <strong>
                            {rating.rating_id}
                          </strong>
                        </td>

                        {/* ROOM */}
                        <td>
                          {rating.room || "-"}
                        </td>

                        {/* NAME */}
                        <td>
                          {rating.name || "-"}
                        </td>

                        {/* RATING */}
                        <td>
                          {renderStars(
                            rating.score
                          )}
                        </td>

                        {/* SUBMITTED DATE */}
                        <td>
                          {rating.submitted_date ||
                            "-"}
                        </td>

                        {/* DETAILS */}
                        <td>
                          {rating.details || "-"}
                        </td>

                        {/* ACTION */}
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="btn btn-neutral"
                              title={`View rating ${rating.rating_id}`}
                             
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
              {filteredRatings.length} ratings
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
                disabled={
                  safePage >= totalPages
                }
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
import { useMemo, useState } from "react";

import bookingsData from "../data/bookings";
import { rooms as roomsData } from "../data/room";

const bookings = Array.isArray(bookingsData) 
    ? bookingsData 
    : [];
const rooms = Array.isArray(roomsData)
    ? roomsData
    : [];

const DAY_WIDTH = 34;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const CALENDAR_START = "2026-09-01";
const CALENDAR_END = "2026-10-28";

const STATUSES = [
  "OCCUPIED",
  "BOOKED",
  "COMPLETED",
  "PENDING",
  "CANCELLED",
];

function parseDate(dateStr) {
  if (!dateStr) return null;

  const [year, month, day] = dateStr.split("-").map(Number);

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );
}

function generateDates(start, end) {
  const dates = [];

  const current = parseDate(start);
  const last = parseDate(end);

  if (!current || !last || current > last) {
    return [];
  }

  while (current <= last) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

function dayCount(start, end) {
  const startDate =
    start instanceof Date ? start : parseDate(start);
  const endDate =
    end instanceof Date ? end : parseDate(end);

  if (!startDate || !endDate) {
    return 0;
  }

  return Math.round(
    (endDate - startDate) / MS_PER_DAY
  );
}

function isWeekend(date) {
  const day = date.getUTCDay();

  return day === 0 || day === 6;
}

function bookingOverlaps(
  windowStart,
  windowEnd,
  booking
) {
  if (
    !booking?.started_at ||
    !booking?.ended_at
  ) {
    return false;
  }

  const start = parseDate(booking.started_at);
  const end = parseDate(booking.ended_at);
  const calendarStart = parseDate(windowStart);
  const calendarEnd = parseDate(windowEnd);

  if (
    !start ||
    !end ||
    !calendarStart ||
    !calendarEnd
  ) {
    return false;
  }

  return (
    start <= calendarEnd &&
    end >= calendarStart
  );
}

export default function CalendarView() {
     console.log("CalendarView rendering");
  console.log("rooms:", rooms);
  console.log("bookings:", bookings);
  const [hoveredBooking, setHoveredBooking] =
    useState(null);

  const [roomFilter, setRoomFilter] =
    useState("");

  const [guestFilter, setGuestFilter] =
    useState("");

  const [startDate, setStartDate] =
    useState("");

  const [endDate, setEndDate] =
    useState("");

  /*
   * Calendar window
   */
  const windowStart =
    startDate &&
    startDate >= CALENDAR_START
      ? startDate
      : CALENDAR_START;

  const windowEnd =
    endDate &&
    endDate <= CALENDAR_END
      ? endDate
      : CALENDAR_END;

  /*
   * Generate calendar dates
   */
  const dates = useMemo(() => {
    return generateDates(
      windowStart,
      windowEnd
    );
  }, [windowStart, windowEnd]);

  /*
   * Filter bookings
   */
  const filteredBookings = useMemo(() => {
    const roomQuery =
      roomFilter.trim().toLowerCase();

    const guestQuery =
      guestFilter.trim().toLowerCase();

    return bookings.filter((booking) => {
      const roomName = String(
        booking?.room || ""
      ).toLowerCase();

      const guestName = String(
        booking?.guest?.name || ""
      ).toLowerCase();

      const matchesRoom =
        !roomQuery ||
        roomName.includes(roomQuery);

      const matchesGuest =
        !guestQuery ||
        guestName.includes(guestQuery);

      const overlaps = bookingOverlaps(
        windowStart,
        windowEnd,
        booking
      );

      return (
        matchesRoom &&
        matchesGuest &&
        overlaps
      );
    });
  }, [
    roomFilter,
    guestFilter,
    windowStart,
    windowEnd,
  ]);

  /*
   * Filter rooms
   */
  const activeRooms = useMemo(() => {
    const roomQuery =
      roomFilter.trim().toLowerCase();

    const guestQuery =
      guestFilter.trim().toLowerCase();

    /*
     * No filters:
     * show every room
     */
    if (!roomQuery && !guestQuery) {
      return rooms;
    }

    /*
     * Guest search:
     * only show rooms containing
     * matching bookings
     */
    const roomsWithBookings = new Set(
      filteredBookings.map(
        (booking) => booking.room
      )
    );

    return rooms.filter((room) => {
      const roomName = String(
        room?.name || ""
      );

      const matchesRoom =
        !roomQuery ||
        roomName
          .toLowerCase()
          .includes(roomQuery);

      const hasBookings =
        roomsWithBookings.has(room.name);

      return (
        matchesRoom &&
        (!guestQuery || hasBookings)
      );
    });
  }, [
    roomFilter,
    guestFilter,
    filteredBookings,
  ]);

  /*
   * Calculate booking position
   */
  const getBookingStyle = (booking) => {
    const bookingStart =
      parseDate(booking.started_at);

    const bookingEnd =
      parseDate(booking.ended_at);

    const calendarStart =
      parseDate(windowStart);

    const calendarEnd =
      parseDate(windowEnd);

    if (
      !bookingStart ||
      !bookingEnd ||
      !calendarStart ||
      !calendarEnd
    ) {
      return {
        left: 0,
        width: DAY_WIDTH,
      };
    }

    /*
     * Clamp booking to calendar window
     */
    const effectiveStart =
      bookingStart < calendarStart
        ? calendarStart
        : bookingStart;

    const effectiveEnd =
      bookingEnd > calendarEnd
        ? calendarEnd
        : bookingEnd;

    const left =
      dayCount(
        windowStart,
        effectiveStart
      ) * DAY_WIDTH;

    const width = Math.max(
      dayCount(
        effectiveStart,
        effectiveEnd
      ) * DAY_WIDTH,
      DAY_WIDTH
    );

    return {
      left,
      width,
    };
  };

  const hasActiveFilters = Boolean(
    roomFilter.trim() ||
      guestFilter.trim() ||
      startDate ||
      endDate
  );

  const clearFilters = () => {
    setRoomFilter("");
    setGuestFilter("");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="calendar-view">

      {/* =========================
          FILTERS
      ========================== */}

      <div className="calendar-filters form-actions bookings-toolbar">

        <div className="calendar-filters__search">

          <label className="history-search">
            <i
              className="bi bi-door-open"
              aria-hidden="true"
            />

            <input
              type="search"
              aria-label="Search rooms"
              placeholder="Search room..."
              value={roomFilter}
              onChange={(e) =>
                setRoomFilter(e.target.value)
              }
            />
          </label>

          <label className="history-search">
            <i
              className="bi bi-person"
              aria-hidden="true"
            />

            <input
              type="search"
              aria-label="Search guests"
              placeholder="Search guest name..."
              value={guestFilter}
              onChange={(e) =>
                setGuestFilter(e.target.value)
              }
            />
          </label>

        </div>

        <div className="calendar-filters__dates">

          <label className="calendar-date-filter">
            <span>From</span>

            <input
              type="date"
              min={CALENDAR_START}
              max={CALENDAR_END}
              value={startDate}
              onChange={(e) =>
                setStartDate(e.target.value)
              }
            />
          </label>

          <label className="calendar-date-filter">
            <span>To</span>

            <input
              type="date"
              min={CALENDAR_START}
              max={CALENDAR_END}
              value={endDate}
              onChange={(e) =>
                setEndDate(e.target.value)
              }
            />
          </label>

          <button
            type="button"
            className="btn btn-neutral"
            disabled={!hasActiveFilters}
            onClick={clearFilters}
          >
            <i
              className="bi bi-x-lg"
              aria-hidden="true"
            />

            Clear
          </button>

        </div>

        <div className="calendar-legend">

          {STATUSES.map((status) => (
            <span
              className="calendar-legend__item"
              key={status}
            >
              <i
                className={`calendar-legend__dot calendar-legend__dot--${status.toLowerCase()}`}
                aria-hidden="true"
              />

              {status}
            </span>
          ))}

        </div>

      </div>

      {/* =========================
          CALENDAR
      ========================== */}

      <div className="booking-calendar">

        {/* HEADER */}

        <div className="calendar-header">

          <div className="calendar-room-header">
            Room
          </div>

          <div
            className="calendar-dates"
            style={{
              width:
                dates.length *
                DAY_WIDTH,
            }}
          >
            {dates.map((date) => (
              <div
                key={date.toISOString()}
                className={`calendar-date ${
                  isWeekend(date)
                    ? "is-weekend"
                    : ""
                }`}
                style={{
                  width: DAY_WIDTH,
                }}
              >
                <span>
                  {date.toLocaleDateString(
                    "en-US",
                    {
                      weekday: "short",
                      timeZone: "UTC",
                    }
                  )}
                </span>

                <strong>
                  {date.getUTCDate()}
                </strong>
              </div>
            ))}
          </div>

        </div>

        {/* BODY */}

        <div className="calendar-body">

          {dates.length === 0 ? (
            <div className="calendar-empty">
              Invalid calendar date range.
            </div>
          ) : activeRooms.length === 0 ? (
            <div className="calendar-empty">
              No rooms match the current filters.
            </div>
          ) : (

            activeRooms.map((room) => {

              const roomBookings =
                filteredBookings.filter(
                  (booking) =>
                    booking.room ===
                    room.name
                );

              return (
                <div
                  className="calendar-row"
                  key={
                    room.id ||
                    room.name
                  }
                >

                  {/* ROOM */}

                  <div className="calendar-room">

                    <strong>
                      {room.name}
                    </strong>

                 

                  </div>

                  {/* TIMELINE */}

                  <div
                    className="calendar-timeline"
                    style={{
                      width:
                        dates.length *
                        DAY_WIDTH,
                    }}
                  >

                    {/* GRID */}

                    {dates.map((date) => (
                      <div
                        key={date.toISOString()}
                        className={`calendar-grid-cell ${
                          isWeekend(date)
                            ? "is-weekend"
                            : ""
                        }`}
                        style={{
                          width: DAY_WIDTH,
                        }}
                      />
                    ))}

                    {/* BOOKINGS */}

                    {roomBookings.map(
                      (booking, index) => {

                        const style =
                          getBookingStyle(
                            booking
                          );

                        const statusClass = String(
  booking?.status ?? ""
).toLowerCase();

                        return (
                          <div
                            key={
                              booking.id ||
                              `${room.name}-${booking.started_at}-${index}`
                            }
                            className={`booking-block booking-${statusClass}`}
                            style={{
                              left:
                                style.left,
                              width:
                                style.width,
                            }}
                            onMouseEnter={() =>
                              setHoveredBooking(
                                booking
                              )
                            }
                            onMouseLeave={() =>
                              setHoveredBooking(
                                null
                              )
                            }
                          >

                            <div className="booking-block__name">
                              {booking?.guest?.name ||
                                "Unknown Guest"}
                            </div>

                            <div className="booking-block__status">
                              {booking?.status}
                            </div>

                            {hoveredBooking ===
                              booking && (
                              <BookingTooltip
                                booking={
                                  booking
                                }
                              />
                            )}

                          </div>
                        );
                      }
                    )}

                  </div>

                </div>
              );
            })
          )}

        </div>

      </div>
    </div>
  );
}

/*
 * =================================
 * BOOKING TOOLTIP
 * =================================
 */

function BookingTooltip({ booking }) {
  const statusClass = String(
    booking?.status || ""
  ).toLowerCase();

  return (
    <div className="booking-tooltip">

      <div className="booking-tooltip__header">

        <strong>
          {booking?.guest?.name ||
            "Guest"}
        </strong>

        <span
          className={`tooltip-status tooltip-status--${statusClass}`}
        >
          {booking?.status}
        </span>

      </div>

      <div className="booking-tooltip__divider" />

      <div className="booking-tooltip__row">
        <span>Room</span>
        <strong>{booking?.room}</strong>
      </div>

      <div className="booking-tooltip__row">
        <span>Gender</span>
        <strong>
          {booking?.guest?.gender}
        </strong>
      </div>

      <div className="booking-tooltip__row">
        <span>Country</span>
        <strong>
          {booking?.guest?.country}
        </strong>
      </div>

      <div className="booking-tooltip__row">
        <span>Department</span>
        <strong>
          {booking?.guest?.dept}
        </strong>
      </div>

      <div className="booking-tooltip__row">
        <span>Meal</span>
        <strong>
          {booking?.guest?.meal_type}
        </strong>
      </div>

      <div className="booking-tooltip__row">
        <span>Start</span>
        <strong>
          {booking?.started_at}
        </strong>
      </div>

      <div className="booking-tooltip__row">
        <span>End</span>
        <strong>
          {booking?.ended_at}
        </strong>
      </div>

      {booking?.notes && (
        <>
          <div className="booking-tooltip__divider" />

          <div className="booking-tooltip__notes">
            <span>Notes</span>

            <p>
              {booking.notes}
            </p>
          </div>
        </>
      )}

    </div>
  );
}
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import bookingsData from "../data/bookings";
import { rooms as roomsData } from "../data/room";
import BookingModal from "./modals/BookingModal";

const initialBookings = Array.isArray(bookingsData)
    ? bookingsData
    : [];
const rooms = Array.isArray(roomsData)
    ? roomsData
    : [];

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const DAY_WIDTH = 34;

const DRAG_EDGE = 80;

const SCROLL_SPEED = 14;

const TOOLTIP_WIDTH = 264;

const TOOLTIP_GAP = 10;

const TOOLTIP_MARGIN = 8;

const BLOCKED_FLASH_MS = 400;

const DEFAULT_SETTINGS = {
  calendarStart: "2026-09-01",
  calendarEnd: "2026-10-28",
  viewMode: "CUSTOM",
};

const VIEW_DAYS = {
  DAILY: 0,
  WEEKLY: 6,
  BIWEEKLY: 13,
};

/*
 * Booking statuses.
 * The key is the normalized status and is used to
 * build every status class name:
 *   .booking-block.booking-<key>
 *   .calendar-legend__dot--<key>
 *   .tooltip-status--<key>
 * Colors live in App.css as --status-<key>-*
 */
const STATUS_META = {
  in_house: { label: "In house" },
  confirmed: { label: "Confirmed" },
  in_request: { label: "In request" },
  checked_out: { label: "Checked out" },
  no_show: { label: "No show" },
  archived: { label: "Archived" },
  unknown: { label: "Unknown" },
};

const STATUS_ORDER = [
  "in_house",
  "confirmed",
  "in_request",
  "checked_out",
  "no_show",
  "archived",
];

function normalizeStatus(status) {
  const key = String(
    status || ""
  )
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return key in STATUS_META ? key : "unknown";
}

function statusLabel(status) {
  return STATUS_META[normalizeStatus(status)].label;
}

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

function addDays(dateStr, days) {
  const date = parseDate(dateStr);

  if (!date) return null;

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function lastDayOfMonth(dateStr) {
  const date = parseDate(dateStr);

  if (!date) return null;

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      0
    )
  ).toISOString().slice(0, 10);
}

function isWeekend(date) {
  const day = date.getUTCDay();

  return day === 0 || day === 6;
}

function formatVisibleDate(date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
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
   
  const [hovered, setHovered] =
    useState(null);

  const [tooltipPosition, setTooltipPosition] =
    useState(null);

  const [roomFilter, setRoomFilter] =
    useState("");

  const [guestFilter, setGuestFilter] =
    useState("");

  const [startDate, setStartDate] =
    useState("");

  const [endDate, setEndDate] =
    useState("");

  const [calendarStart, setCalendarStart] =
    useState(DEFAULT_SETTINGS.calendarStart);

  const [calendarEnd, setCalendarEnd] =
    useState(DEFAULT_SETTINGS.calendarEnd);

  const [viewMode, setViewMode] =
    useState(DEFAULT_SETTINGS.viewMode);

  const calendarRef = useRef(null);

  const [visibleStart, setVisibleStart] =
    useState(null);

  const [visibleEnd, setVisibleEnd] =
    useState(null);

  const [bookings, setBookings] =
    useState(initialBookings);

  const [dragRange, setDragRange] =
    useState(null);

  const [bookingDraft, setBookingDraft] =
    useState(null);

  const [dragScrollDirection, setDragScrollDirection] =
    useState(0);

  const [blockedCell, setBlockedCell] =
    useState(null);

  const dragRangeRef = useRef(null);
  const dragActiveRef = useRef(false);
  const lastXRef = useRef(0);
  const tooltipRef = useRef(null);
  const tooltipAnchorRef = useRef(null);
  const blockedTimerRef = useRef(null);

  useEffect(() => {
    dragRangeRef.current = dragRange;
  }, [dragRange]);

  useEffect(() => {
    return () => {
      if (blockedTimerRef.current) {
        clearTimeout(blockedTimerRef.current);
      }
    };
  }, []);

  /*
   * Calendar bounds
   */
  const sortedCalStart =
    calendarStart <= calendarEnd
      ? calendarStart
      : calendarEnd;

  const sortedCalEnd =
    calendarStart <= calendarEnd
      ? calendarEnd
      : calendarStart;

  /*
   * Calendar window
   */
  const windowStart =
    startDate &&
    startDate >= sortedCalStart &&
    startDate <= sortedCalEnd
      ? startDate
      : sortedCalStart;

  let windowEnd;

  if (viewMode === "CUSTOM") {
    windowEnd =
      endDate &&
      endDate >= sortedCalStart &&
      endDate <= sortedCalEnd
        ? endDate
        : sortedCalEnd;
  } else if (viewMode === "MONTHLY") {
    windowEnd =
      lastDayOfMonth(windowStart) ||
      windowStart;
  } else {
    windowEnd =
      addDays(
        windowStart,
        VIEW_DAYS[viewMode]
      ) || windowStart;
  }

  if (windowEnd > sortedCalEnd) {
    windowEnd = sortedCalEnd;
  }

  if (windowEnd < windowStart) {
    windowEnd = windowStart;
  }

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
   * Booked days per room (all bookings, not the
   * filtered ones, so text filters can never
   * unlock an already occupied date)
   */
  const blockedDays = useMemo(() => {
    const map = new Map();

    if (dates.length === 0) {
      return map;
    }

    const lastIndex = dates.length - 1;

    bookings.forEach((booking) => {
      const roomName = booking?.room;

      if (
        !roomName ||
        !bookingOverlaps(
          windowStart,
          windowEnd,
          booking
        )
      ) {
        return;
      }

      const start = parseDate(booking.started_at);
      const end = parseDate(booking.ended_at);

      if (!start || !end) return;

      const from = Math.max(
        0,
        dayCount(windowStart, start)
      );

      const to = Math.min(
        lastIndex,
        dayCount(windowStart, end)
      );

      if (to < from) return;

      let days = map.get(roomName);

      if (!days) {
        days = new Set();
        map.set(roomName, days);
      }

      for (let i = from; i <= to; i += 1) {
        days.add(i);
      }
    });

    return map;
  }, [bookings, windowStart, windowEnd, dates]);

  const isDayBooked = useCallback(
    (roomName, index) => {
      const days =
        blockedDays.get(roomName);

      return days ? days.has(index) : false;
    },
    [blockedDays]
  );

  /*
   * Contiguous free span of a room around
   * a given day index. A selection can never
   * cross an occupied date.
   */
  const getFreeSpan = useCallback(
    (roomName, index) => {
      const days =
        blockedDays.get(roomName);

      const lastIndex = dates.length - 1;

      if (!days || dates.length === 0) {
        return [0, lastIndex];
      }

      let low = index;

      while (low - 1 >= 0 && !days.has(low - 1)) {
        low -= 1;
      }

      let high = index;

      while (
        high + 1 < dates.length &&
        !days.has(high + 1)
      ) {
        high += 1;
      }

      return [low, high];
    },
    [blockedDays, dates]
  );

  const hasBookedDay = useCallback(
    (roomName, from, to) => {
      if (dates.length === 0) {
        return false;
      }

      const low = Math.max(0, Math.min(from, to));
      const high = Math.min(
        dates.length - 1,
        Math.max(from, to)
      );

      for (let i = low; i <= high; i += 1) {
        if (isDayBooked(roomName, i)) {
          return true;
        }
      }

      return false;
    },
    [dates.length, isDayBooked]
  );

  /*
   * Visible date range (changes on scroll/resize)
   */
  const updateVisibleRange = useCallback(() => {
    const container = calendarRef.current;

    if (!container || dates.length === 0) {
      setVisibleStart(null);
      setVisibleEnd(null);
      return;
    }

    const header = container.querySelector(
      ".calendar-room-header"
    );

    const headerWidth =
      header?.getBoundingClientRect().width ||
      64;

    const scrollLeft = container.scrollLeft;
    const containerWidth =
      container.clientWidth;

    const firstIndex = Math.max(
      0,
      Math.floor(
        (scrollLeft - headerWidth) / DAY_WIDTH
      )
    );

    const lastIndex = Math.min(
      dates.length - 1,
      Math.floor(
        (scrollLeft +
          containerWidth -
          headerWidth -
          1) /
          DAY_WIDTH
      )
    );

    setVisibleStart(dates[firstIndex]);
    setVisibleEnd(
      dates[Math.max(firstIndex, lastIndex)]
    );
  }, [dates]);

  useEffect(() => {
    updateVisibleRange();

    const onResize = () =>
      updateVisibleRange();

    window.addEventListener(
      "resize",
      onResize
    );

    return () =>
      window.removeEventListener(
        "resize",
        onResize
      );
  }, [updateVisibleRange]);

  /*
   * Tooltip anchoring
   *
   * The tooltip is rendered as a fixed overlay
   * outside the scroll container so it is never
   * clipped. It flips below the booking when
   * there is not enough room above and is
   * clamped horizontally inside the viewport.
   */
  const updateTooltipPosition = useCallback(() => {
    const node = tooltipRef.current;
    const anchor = tooltipAnchorRef.current;

    if (!node || !anchor) return;

    const box = node.getBoundingClientRect();
    const anchorBox = anchor.getBoundingClientRect();

    const width = box.width || TOOLTIP_WIDTH;
    const height = box.height;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const roomAbove =
      anchorBox.top - TOOLTIP_GAP - height;

    const placement =
      roomAbove >= TOOLTIP_MARGIN ? "top" : "bottom";

    const top = Math.min(
      Math.max(
        placement === "top"
          ? roomAbove
          : anchorBox.bottom + TOOLTIP_GAP,
        TOOLTIP_MARGIN
      ),
      Math.max(
        TOOLTIP_MARGIN,
        viewportHeight - height - TOOLTIP_MARGIN
      )
    );

    const centered =
      anchorBox.left +
      anchorBox.width / 2 -
      width / 2;

    const left = Math.min(
      Math.max(centered, TOOLTIP_MARGIN),
      Math.max(
        TOOLTIP_MARGIN,
        viewportWidth - width - TOOLTIP_MARGIN
      )
    );

    const arrowCenter =
      anchorBox.left + anchorBox.width / 2 - left;

    const arrowLeft = Math.min(
      Math.max(arrowCenter, 16),
      Math.max(16, width - 16)
    );

    setTooltipPosition({
      left,
      top,
      placement,
      arrowLeft,
    });
  }, []);

  useLayoutEffect(() => {
    if (!hovered?.booking) {
      return;
    }

    tooltipAnchorRef.current = hovered.anchor;

    updateTooltipPosition();

    window.addEventListener(
      "scroll",
      updateTooltipPosition,
      true
    );

    window.addEventListener(
      "resize",
      updateTooltipPosition
    );

    return () => {
      window.removeEventListener(
        "scroll",
        updateTooltipPosition,
        true
      );

      window.removeEventListener(
        "resize",
        updateTooltipPosition
      );
    };
  }, [hovered, updateTooltipPosition]);

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
    bookings,
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
      endDate ||
      calendarStart !== DEFAULT_SETTINGS.calendarStart ||
      calendarEnd !== DEFAULT_SETTINGS.calendarEnd ||
      viewMode !== DEFAULT_SETTINGS.viewMode
  );

  const clearFilters = () => {
    setRoomFilter("");
    setGuestFilter("");
    setStartDate("");
    setEndDate("");
    setCalendarStart(
      DEFAULT_SETTINGS.calendarStart
    );
    setCalendarEnd(
      DEFAULT_SETTINGS.calendarEnd
    );
    setViewMode(DEFAULT_SETTINGS.viewMode);
  };

  /*
   * Cell drag-to-book selection
   */
  const flashBlockedCell = (roomName, index) => {
    if (blockedTimerRef.current) {
      clearTimeout(blockedTimerRef.current);
    }

    setBlockedCell({ room: roomName, index });

    blockedTimerRef.current =
      setTimeout(() => {
        blockedTimerRef.current = null;
        setBlockedCell(null);
      }, BLOCKED_FLASH_MS);
  };

  const handleCellMouseDown = (
    roomName,
    index,
    event
  ) => {
    if (event.button !== 0) return;

    event.preventDefault();

    setHovered(null);

    /*
     * Occupied dates cannot be selected
     */
    if (isDayBooked(roomName, index)) {
      flashBlockedCell(roomName, index);
      return;
    }

    dragActiveRef.current = true;

    setDragRange({
      start: { room: roomName, index },
      end: { room: roomName, index },
    });
  };

  const updateDragEndIndex = useCallback(
    (clientX) => {
      const container = calendarRef.current;

      if (!container || !dragActiveRef.current) {
        return;
      }

      const header = container.querySelector(
        ".calendar-room-header"
      );

      const headerWidth =
        header?.getBoundingClientRect().width ||
        64;

      const rect = container.getBoundingClientRect();

      const rawIndex = Math.floor(
        (container.scrollLeft +
          clientX -
          rect.left -
          headerWidth) /
          DAY_WIDTH
      );

      const index = Math.max(
        0,
        Math.min(dates.length - 1, rawIndex)
      );

      setDragRange((prev) => {
        if (!prev) return prev;

        const roomName = prev.start.room;
        const anchor = prev.start.index;

        if (isDayBooked(roomName, anchor)) {
          return prev;
        }

        /*
         * Keep the selection inside the free
         * span so it never overlaps a booking
         */
        const [low, high] = getFreeSpan(
          roomName,
          anchor
        );

        return {
          ...prev,
          end: {
            ...prev.end,
            index: Math.min(
              high,
              Math.max(low, index)
            ),
          },
        };
      });
    },
    [dates, getFreeSpan, isDayBooked]
  );

  const handleWindowMouseMove = useCallback(
    (event) => {
      if (!dragActiveRef.current) return;

      lastXRef.current = event.clientX;

      updateDragEndIndex(event.clientX);

      const container = calendarRef.current;

      if (!container) return;

      const rect = container.getBoundingClientRect();

      const clientX = event.clientX;

      let direction = 0;

      if (clientX > rect.right - DRAG_EDGE) {
        direction = 1;
      } else if (clientX < rect.left + DRAG_EDGE) {
        direction = -1;
      }

      setDragScrollDirection(direction);
    },
    [updateDragEndIndex]
  );

  const isCellSelected = (
    roomName,
    index
  ) => {
    const range = dragRange;

    if (!range) return false;

    if (roomName !== range.start.room) {
      return false;
    }

    const minIndex = Math.min(
      range.start.index,
      range.end.index
    );

    const maxIndex = Math.max(
      range.start.index,
      range.end.index
    );

    return (
      index >= minIndex &&
      index <= maxIndex
    );
  };

  const endDrag = useCallback(() => {
    setDragScrollDirection(0);
    dragActiveRef.current = false;

    const range = dragRangeRef.current;

    dragRangeRef.current = null;
    setDragRange(null);

    if (!range) return;

    const minIndex = Math.min(
      range.start.index,
      range.end.index
    );

    const maxIndex = Math.max(
      range.start.index,
      range.end.index
    );

    const startedAt = dates[minIndex];
    const endedAt = dates[maxIndex];

    if (!startedAt || !endedAt) return;

    /*
     * Last safety net: never open the modal for
     * a range that touches an occupied date
     */
    if (
      hasBookedDay(
        range.start.room,
        minIndex,
        maxIndex
      )
    ) {
      flashBlockedCell(
        range.start.room,
        minIndex
      );
      return;
    }

    setBookingDraft({
      room: range.start.room,
      started_at:
        startedAt.toISOString().slice(0, 10),
      ended_at:
        endedAt.toISOString().slice(0, 10),
    });
  }, [dates, hasBookedDay]);

  useEffect(() => {
    window.addEventListener(
      "mouseup",
      endDrag
    );

    window.addEventListener(
      "mousemove",
      handleWindowMouseMove
    );

    return () => {
      window.removeEventListener(
        "mouseup",
        endDrag
      );

      window.removeEventListener(
        "mousemove",
        handleWindowMouseMove
      );
    };
  }, [endDrag, handleWindowMouseMove]);

  /*
   * Auto-scroll while dragging near the edges
   */
  useEffect(() => {
    if (dragScrollDirection === 0) return;

    const container = calendarRef.current;

    if (!container) return;

    let frame = null;

    const step = () => {
      if (!dragActiveRef.current) return;

      container.scrollLeft +=
        dragScrollDirection * SCROLL_SPEED;

      const maxScroll =
        container.scrollWidth - container.clientWidth;

      container.scrollLeft = Math.max(
        0,
        Math.min(container.scrollLeft, maxScroll)
      );

      updateDragEndIndex(lastXRef.current);

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);

    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [dragScrollDirection, updateDragEndIndex]);

  const handleCreateBooking = (draft) => {
    setBookings((prev) => [
      ...prev,
      {
        id: Date.now(),
        room: draft.room,
        guest: {
          name: draft.guest_name || "New Guest",
          gender: draft.gender ?? "",
          country: draft.country ?? "",
          site: draft.site ?? "",
          dept: draft.dept ?? "",
          meal_type: draft.meal_type ?? "",
          email: draft.email ?? "",
          phone: draft.phone ?? "",
        },
        started_at: draft.started_at,
        ended_at: draft.ended_at,
        status: draft.status || "IN_REQUEST",
        notes: draft.notes ?? "",
      },
    ]);
  };

  /*
   * Draft guard: reject a booking that would
   * overlap an existing one in the same room
   */
  const isDraftBookable = (draft) => {
    if (!draft?.room) return false;

    const from = dayCount(
      windowStart,
      draft.started_at
    );

    const to = dayCount(
      windowStart,
      draft.ended_at
    );

    if (from < 0 || to < from) return false;

    return !hasBookedDay(
      draft.room,
      from,
      to
    );
  };

  return (
    <div className="calendar-view">

      <div className="calendar-range">
       

        <span>
          {visibleStart && visibleEnd
            ? `${formatVisibleDate(visibleStart)} - ${formatVisibleDate(visibleEnd)}`
            : "No dates to display"}
        </span>
      </div>

      {/* =========================
          FILTERS
      ========================== */}

      <div className="calendar-filters form-actions bookings-toolbar">

        <div className="calendar-filters__search">

          <label className="history-search">
            

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
              min={sortedCalStart}
              max={sortedCalEnd}
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
              min={sortedCalStart}
              max={sortedCalEnd}
              value={
                viewMode === "CUSTOM"
                  ? endDate
                  : windowEnd
              }
              disabled={
                viewMode !== "CUSTOM"
              }
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

          {STATUS_ORDER.map((key) => (
            <span
              className="calendar-legend__item"
              key={key}
            >
              <i
                className={`calendar-legend__dot calendar-legend__dot--${key}`}
                aria-hidden="true"
              />

              {STATUS_META[key].label}
            </span>
          ))}

        </div>

      </div>

      {/* =========================
          CALENDAR SETTINGS
      ========================== */}

      <div className="calendar-filters form-actions bookings-toolbar">

        <div className="calendar-filters__dates">

          <label
            className="calendar-date-filter"
          >
            <span>Calendar Start</span>

            <input
              type="date"
              value={calendarStart}
              onChange={(e) =>
                setCalendarStart(e.target.value)
              }
            />
          </label>

          <label
            className="calendar-date-filter"
          >
            <span>Calendar End</span>

            <input
              type="date"
              value={calendarEnd}
              onChange={(e) =>
                setCalendarEnd(e.target.value)
              }
            />
          </label>

         

          <label
            className="calendar-date-filter"
          >
            <span>View</span>

            <select
              value={viewMode}
              onChange={(e) =>
                setViewMode(e.target.value)
              }
            >
              <option value="CUSTOM">
                Custom
              </option>

              <option value="DAILY">
                Daily
              </option>

              <option value="WEEKLY">
                Weekly
              </option>

              <option value="BIWEEKLY">
                Biweekly
              </option>

              <option value="MONTHLY">
                Monthly
              </option>
            </select>
          </label>

        </div>

      </div>

      {/* =========================
          CALENDAR
      ========================== */}

      <div
        className="booking-calendar"
        ref={calendarRef}
        onScroll={updateVisibleRange}
        style={{
          "--calendar-days-width":
            `${dates.length * DAY_WIDTH}px`,
        }}
      >

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

                  <div className="calendar-room">

                    <strong>
                      {room.name}
                    </strong>

                 

                  </div>

                  <div
                    className="calendar-timeline"
                    style={{
                      width:
                        dates.length *
                        DAY_WIDTH,
                    }}
                  >

                    {dates.map((date, index) => {
                      const booked = isDayBooked(
                        room.name,
                        index
                      );

                      return (
                        <div
                          key={date.toISOString()}
                          className={`calendar-grid-cell ${
                            isWeekend(date)
                              ? "is-weekend"
                              : ""
                          } ${
                            booked ? "is-booked" : ""
                          } ${
                            isCellSelected(
                              room.name,
                              index
                            )
                              ? "is-selected"
                              : ""
                          } ${
                            blockedCell?.room ===
                              room.name &&
                            blockedCell?.index ===
                              index
                              ? "is-blocked"
                              : ""
                          }`}
                          style={{
                            width: DAY_WIDTH,
                          }}
                          onMouseDown={(event) =>
                            handleCellMouseDown(
                              room.name,
                              index,
                              event
                            )
                          }
                        />
                      );
                    })}

                    {/* BOOKINGS */}

                    {roomBookings.map(
                      (booking, index) => {

                        const style =
                          getBookingStyle(
                            booking
                          );

                        const statusClass =
                          normalizeStatus(
                            booking?.status
                          );

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
                            onMouseEnter={(event) =>
                              setHovered({
                                booking,
                                anchor:
                                  event.currentTarget,
                              })
                            }
                            onMouseLeave={() =>
                              setHovered(null)
                            }
                          >

                            <div className="booking-block__name">
                              {booking?.guest?.name ||
                                "Unknown Guest"}
                            </div>

                            <div className="booking-block__status">
                              {statusLabel(
                                booking?.status
                              )}
                            </div>

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

      {/*
       * Rendered outside the scroll container so
       * it can never be clipped by the calendar
       */}
      <BookingTooltip
        ref={tooltipRef}
        booking={hovered?.booking}
        position={tooltipPosition}
      />

      {bookingDraft && (
        <BookingModal
          room={bookingDraft.room}
          startedAt={bookingDraft.started_at}
          endedAt={bookingDraft.ended_at}
          onClose={() => setBookingDraft(null)}
          onSubmit={(draft) => {
            if (!isDraftBookable(draft)) {
              setBookingDraft(null);
              return;
            }

            handleCreateBooking(draft);
          }}
        />
      )}
    </div>
  );
}



const BookingTooltip = forwardRef(
  function BookingTooltip(
    { booking, position },
    ref
  ) {
    if (!booking) {
      return null;
    }

    const statusClass =
      normalizeStatus(booking?.status);

    /*
     * The node mounts before it is measured, so it
     * stays hidden until a position is resolved.
     */
    const style = {
      left: position
        ? `${position.left}px`
        : "0px",
      top: position
        ? `${position.top}px`
        : "0px",
      "--tooltip-arrow-left": position
        ? `${position.arrowLeft}px`
        : "50%",
    };

    return (
      <div
        ref={ref}
        className={`booking-tooltip booking-tooltip--${
          position?.placement || "top"
        }${position ? " is-ready" : ""}`}
        style={style}
        role="tooltip"
      >

        <div className="booking-tooltip__header">

          <strong>
            {booking?.guest?.name ||
              "Guest"}
          </strong>

          <span
            className={`tooltip-status tooltip-status--${statusClass}`}
          >
            {statusLabel(booking?.status)}
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
          <span>Booked At</span>
          <strong>
            {booking?.booked_at}
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
);

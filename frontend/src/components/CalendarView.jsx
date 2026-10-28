import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import useAuth from "../contexts/useAuth";
import apiRequest from "../api/client";
import BookingCreateModal from "./modals/BookingCreateModal";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const DAY_WIDTH = 34;

const DRAG_EDGE = 80;

const SCROLL_SPEED = 14;

const TOOLTIP_WIDTH = 264;

const TOOLTIP_GAP = 10;

const TOOLTIP_MARGIN = 8;

const BLOCKED_FLASH_MS = 400;

const today = new Date();
const todayString = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
const defaultEndDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 90);
const defaultEndString = [defaultEndDate.getFullYear(), String(defaultEndDate.getMonth() + 1).padStart(2, "0"), String(defaultEndDate.getDate()).padStart(2, "0")].join("-");

const DEFAULT_SETTINGS = {
  calendarStart: todayString,
  calendarEnd: defaultEndString,
  viewMode: "CUSTOM",
};

const VIEW_DAYS = {
  DAILY: 0,
  WEEKLY: 6,
  BIWEEKLY: 13,
};


const STATUS_META = {
  in_house: { label: "In house" },
  confirmed: { label: "Confirmed" },
  in_request: { label: "In request" },
  checked_out: { label: "Checked out" },
  no_show: { label: "No show" },
  archived: { label: "Archived" },
  home_leave: { label: "Home leave" },
  cancelled: { label: "Cancelled" },
  unknown: { label: "Unknown" },
};

const STATUS_ORDER = [
  "in_house",
  "confirmed",
  "in_request",
  "checked_out",
  "no_show",
  "home_leave",
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

  const calendarExclusiveEnd = new Date(calendarEnd);
  calendarExclusiveEnd.setUTCDate(calendarExclusiveEnd.getUTCDate() + 1);
  return start < calendarExclusiveEnd && end > calendarStart;
}

function toCalendarBooking(booking) {
  const bed = booking?.bed;
  const resident = booking?.resident;
  return {
    ...booking,
    bedId: booking?.bedId ?? bed?.id,
    bed,
    room: bed?.room?.name ?? "",
    guest: {
      name: resident?.fullName ?? "Unknown resident",
      gender: resident?.gender ?? "",
      country: resident?.nationality ?? "",
      site: bed?.room?.floor?.location?.site?.name ?? "",
      dept: resident?.department ?? "",
      meal_type: resident?.mealType ?? "",
      email: resident?.user?.email ?? "",
      phone: resident?.phone ?? "",
    },
    booked_at: booking?.createdAt ? String(booking.createdAt).slice(0, 10) : "",
    started_at: String(booking?.startedAt ?? "").slice(0, 10),
    ended_at: String(booking?.endedAt ?? "").slice(0, 10),
  };
}

async function loadAllPages(path, pageParam, pageSizeParam, baseParams = {}) {
  const firstParams = new URLSearchParams(baseParams);
  firstParams.set(pageParam, "1");
  firstParams.set(pageSizeParam, "100");
  const first = await apiRequest(`${path}?${firstParams.toString()}`);
  const records = Array.isArray(first?.beds) ? first.beds : Array.isArray(first?.data) ? first.data : [];
  const totalPages = Number(first?.pagination?.totalPages ?? 1);
  if (totalPages <= 1) return records;
  const pages = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => {
    const params = new URLSearchParams(baseParams);
    params.set(pageParam, String(index + 2));
    params.set(pageSizeParam, "100");
    return apiRequest(`${path}?${params.toString()}`);
  }));
  return records.concat(...pages.map((page) => Array.isArray(page?.beds) ? page.beds : Array.isArray(page?.data) ? page.data : []));
}

export default function CalendarView() {
  const { hasPermission } = useAuth();

  const canCreateBooking =
    hasPermission("bookings.create");

  const [hovered, setHovered] =
    useState(null);

  const [tooltipPosition, setTooltipPosition] =
    useState(null);

  const [search, setSearch] =
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

  const [bookings, setBookings] = useState([]);
  const [beds, setBeds] = useState([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true);
  const [calendarError, setCalendarError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

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

  useEffect(() => {
    let isCurrentRequest = true;
    const fetchCalendarData = async () => {
      setIsLoadingCalendar(true);
      setCalendarError("");
      try {
        const searchParams = search.trim() ? { search: search.trim() } : {};
        const bookingParams = {
          ...searchParams,
          overlapStart: `${windowStart}T00:00:00.000Z`,
          overlapEnd: `${addDays(windowEnd, 1)}T00:00:00.000Z`,
        };
        const bedParams = { ...searchParams };
        const [bedRecords, bookingRecords] = await Promise.all([
          loadAllPages("/api/bed", "page", "pageSize", bedParams),
          loadAllPages("/api/booking", "page", "limit", bookingParams),
        ]);
        if (!isCurrentRequest) return;

        const normalizedBookings = bookingRecords.map(toCalendarBooking);
        const bedMap = new Map(bedRecords.map((bed) => [bed.id, bed]));
        normalizedBookings.forEach((booking) => {
          if (booking.bed?.id && !bedMap.has(booking.bed.id)) {
            bedMap.set(booking.bed.id, booking.bed);
          }
        });
        setBeds([...bedMap.values()].filter(
          (bed) => bed.isActive !== false && bed.room?.isBookable !== false,
        ));
        setBookings(normalizedBookings);
      } catch (error) {
        if (isCurrentRequest) {
          setCalendarError(error.message || "Failed to load calendar bookings.");
          setBeds([]);
          setBookings([]);
        }
      } finally {
        if (isCurrentRequest) setIsLoadingCalendar(false);
      }
    };
    fetchCalendarData();
    return () => {
      isCurrentRequest = false;
    };
  }, [search, windowStart, windowEnd, reloadKey]);

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
      const roomName = booking?.bedId;

      if (
        !roomName ||
        !["CONFIRMED", "IN_HOUSE", "HOME_LEAVE"].includes(String(booking.status).toUpperCase()) ||
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
        dayCount(windowStart, end) - 1
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
    return bookings.filter((booking) => bookingOverlaps(
        windowStart,
        windowEnd,
        booking
      ));
  }, [windowStart, windowEnd, bookings]);

  /* Calendar rows follow beds because bookings reserve beds. */
  const activeBeds = useMemo(() => beds, [beds]);

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

    const calendarExclusiveEnd =
      parseDate(addDays(windowEnd, 1));

    if (
      !bookingStart ||
      !bookingEnd ||
      !calendarStart ||
      !calendarExclusiveEnd
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
      bookingEnd > calendarExclusiveEnd
        ? calendarExclusiveEnd
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
    search.trim() ||
      startDate ||
      endDate ||
      calendarStart !== DEFAULT_SETTINGS.calendarStart ||
      calendarEnd !== DEFAULT_SETTINGS.calendarEnd ||
      viewMode !== DEFAULT_SETTINGS.viewMode
  );

  const clearFilters = () => {
    setSearch("");
    setStartDate("");
    setEndDate("");
    setCalendarStart(
      todayString
    );
    setCalendarEnd(
      defaultEndString
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
    if (!canCreateBooking) return;

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
      bedId: range.start.room,
      bed: activeBeds.find((bed) => bed.id === range.start.room),
      started_at:
        startedAt.toISOString().slice(0, 10),
      ended_at:
        addDays(endedAt.toISOString().slice(0, 10), 1),
    });
  }, [dates, hasBookedDay, activeBeds]);

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

  const handleCreateBooking = () => {
    setBookingDraft(null);
    setReloadKey((value) => value + 1);
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
              aria-label="Search rooms, beds, bookings, and residents"
              placeholder="Search room, bed, booking, resident..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
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
          Room / Bed
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
          ) : isLoadingCalendar ? (
            <div className="calendar-empty">Loading beds and bookings...</div>
          ) : calendarError ? (
            <div className="calendar-empty">{calendarError}</div>
          ) : activeBeds.length === 0 ? (
            <div className="calendar-empty">
              No beds match the current search.
            </div>
          ) : (

            activeBeds.map((bed) => {

              const roomBookings =
                filteredBookings.filter(
                  (booking) =>
                    booking.bedId === bed.id
                );

              return (
                <div
                  className="calendar-row"
                  key={
                    bed.id
                  }
                >

                  <div className="calendar-room">

                    <strong>{bed.room?.name ?? "Room"}</strong>
                    <small>{bed.name}</small>

                 

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
                        bed.id,
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
                            !canCreateBooking
                              ? "is-locked"
                              : ""
                          } ${
                            isCellSelected(
                              bed.id,
                              index
                            )
                              ? "is-selected"
                              : ""
                          } ${
                            blockedCell?.room ===
                              bed.id &&
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
                              bed.id,
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
                              `${bed.id}-${booking.started_at}-${index}`
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
        <BookingCreateModal
          initialValues={{
            bedId: bookingDraft.bedId,
            startedAt: bookingDraft.started_at,
            endedAt: bookingDraft.ended_at,
          }}
          lockedBed={bookingDraft.bed}
          onClose={() => setBookingDraft(null)}
          onCreated={handleCreateBooking}
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
          <span>Booking ID</span>
          <strong>{booking?.bookingNumber} </strong>
        </div>

        <div className="booking-tooltip__row">
          <span>Room</span>
          <strong>{booking?.room} / {booking?.bed?.name}</strong>
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

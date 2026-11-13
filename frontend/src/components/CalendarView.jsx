import {
  Fragment,
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

const RANGE_EXTEND_DAYS = 30;

const RANGE_EXTEND_THRESHOLD = 240;

const INITIAL_LEAD_DAYS = 30;

const today = new Date();
const todayString = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
const defaultEndDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 90);
const defaultEndString = [defaultEndDate.getFullYear(), String(defaultEndDate.getMonth() + 1).padStart(2, "0"), String(defaultEndDate.getDate()).padStart(2, "0")].join("-");

const STATUS_META = {
  in_house: { label: "In house" },
  confirmed: { label: "Confirmed" },
  in_request: { label: "In request" },
  checked_out: { label: "Checked out" },
  no_show: { label: "No show" },
  archived: { label: "Archived" },
  home_leave: { label: "Home leave" },
  cancelled: { label: "Cancelled" },
  allocated: { label: "Allocated" },
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
  "allocated",
];

const STATUS_FILTER_OPTIONS = [
  "CONFIRMED",
  "IN_HOUSE",
  "HOME_LEAVE",
  "CHECKED_OUT",
  "ALLOCATED",
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

function daysUntil(dateString) {
  const target = parseDate(dateString);
  if (!target) return null;
  const now = new Date();
  const current = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return Math.ceil((target.getTime() - current.getTime()) / MS_PER_DAY);
}

function countdownLabel(label, dateString) {
  const days = daysUntil(dateString);
  if (days === null) return null;
  return `${label}: ${days} ${days === 1 ? "day" : "days"}`;
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

function mergeBookings(current, incoming) {
  const bookingMap = new Map(current.map((booking) => [booking.id, booking]));
  incoming.forEach((booking) => {
    bookingMap.set(booking.id, booking);
  });
  return [...bookingMap.values()];
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
  const [filtersVisible, setFiltersVisible] = useState(true);

  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedFloor, setSelectedFloor] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [startDate, setStartDate] =
    useState("");

  const [endDate, setEndDate] =
    useState("");

  const [calendarEnd, setCalendarEnd] =
    useState(defaultEndString);

  const [leadDays, setLeadDays] =
    useState(INITIAL_LEAD_DAYS);

  const calendarRef = useRef(null);

  const [visibleStart, setVisibleStart] =
    useState(null);

  const [visibleEnd, setVisibleEnd] =
    useState(null);

  const [bookings, setBookings] = useState([]);
  const [occupancyBookings, setOccupancyBookings] = useState([]);
  const [beds, setBeds] = useState([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true);
  const [calendarError, setCalendarError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [dragRange, setDragRange] =
    useState(null);

  const [bookingDraft, setBookingDraft] =
    useState(null);

  const [bookingMoveDraft, setBookingMoveDraft] = useState(null);
  const [bookingMovePreview, setBookingMovePreview] = useState(null);
  const [bookingMoveNotice, setBookingMoveNotice] = useState("");
  const [bookingMoveError, setBookingMoveError] = useState("");
  const [isSavingBookingMove, setIsSavingBookingMove] = useState(false);

  const [dragScrollDirection, setDragScrollDirection] =
    useState(0);

  const [blockedCell, setBlockedCell] =
    useState(null);

  const dragRangeRef = useRef(null);
  const dragActiveRef = useRef(false);
  const bookingMoveRef = useRef(null);
  const lastXRef = useRef(0);
  const tooltipRef = useRef(null);
  const tooltipAnchorRef = useRef(null);
  const blockedTimerRef = useRef(null);
  const loadedRangeRef = useRef(null);
  const pendingScrollAdjustRef = useRef(0);
  const backwardExtendPendingRef = useRef(false);
  const initialScrollDoneRef = useRef(false);

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
  const calStart = todayString;

  const calEnd = calendarEnd;

  /*
   * Calendar window
   */
  const windowStart =
    startDate &&
    startDate >= calStart &&
    startDate <= calEnd
      ? startDate
      : calStart;

  let windowEnd =
    endDate &&
    endDate >= calStart &&
    endDate <= calEnd
      ? endDate
      : calEnd;

  if (windowEnd < windowStart) {
    windowEnd = windowStart;
  }

  /*
   * Rendered range start. A lead buffer lets the
   * calendar scroll into dates before the window
   * start without moving the initial view.
   */
  const rangeStart = !startDate
    ? addDays(windowStart, -leadDays) || windowStart
    : windowStart;

  /*
   * Generate calendar dates
   */
  const dates = useMemo(() => {
    return generateDates(
      rangeStart,
      windowEnd
    );
  }, [rangeStart, windowEnd]);

  useEffect(() => {
    let isCurrentRequest = true;
    const previous = loadedRangeRef.current;
    const isForwardExtension =
      Boolean(previous?.loaded) &&
      previous.search === search &&
      previous.status === statusFilter &&
      previous.start === rangeStart &&
      windowEnd > previous.end;
    const isBackwardExtension =
      Boolean(previous?.loaded) &&
      previous.search === search &&
      previous.status === statusFilter &&
      previous.end === windowEnd &&
      rangeStart < previous.start;
    const isExtension =
      isForwardExtension || isBackwardExtension;

    const extensionStart = isBackwardExtension
      ? rangeStart
      : addDays(previous?.end, 1);

    const extensionEnd = isBackwardExtension
      ? previous.start
      : addDays(windowEnd, 1);

    const fetchCalendarData = async () => {
      if (!isExtension) {
        setIsLoadingCalendar(true);
        setCalendarError("");
      }
      try {
        const searchParams = search.trim() ? { search: search.trim() } : {};
        const bookingStatusFilter =
          statusFilter && statusFilter !== "ALLOCATED" ? statusFilter : "";
        const bookingParams = {
          ...searchParams,
          ...(bookingStatusFilter ? { status: bookingStatusFilter } : {}),
          overlapStart: `${
            isExtension ? extensionStart : rangeStart
          }T00:00:00.000Z`,
          overlapEnd: `${
            isExtension ? extensionEnd : addDays(windowEnd, 1)
          }T00:00:00.000Z`,
        };
        const occupancyParams = { ...bookingParams };
        delete occupancyParams.status;
        const bedParams = { ...searchParams };

        if (isExtension) {
          const [bookingRecords, occupancyRecords] = await Promise.all([
            loadAllPages("/api/booking", "page", "limit", bookingParams),
            bookingStatusFilter
              ? loadAllPages("/api/booking", "page", "limit", occupancyParams)
              : null,
          ]);
          if (!isCurrentRequest) return;

          const normalizedBookings = bookingRecords.map(toCalendarBooking);
          const normalizedOccupancy = (occupancyRecords ?? bookingRecords).map(toCalendarBooking);
          setBookings((current) => mergeBookings(current, normalizedBookings));
          setOccupancyBookings((current) => mergeBookings(current, normalizedOccupancy));
        } else {
          const [bedRecords, bookingRecords, occupancyRecords] = await Promise.all([
            loadAllPages("/api/bed", "page", "pageSize", bedParams),
            loadAllPages("/api/booking", "page", "limit", bookingParams),
            bookingStatusFilter
              ? loadAllPages("/api/booking", "page", "limit", occupancyParams)
              : null,
          ]);
          if (!isCurrentRequest) return;

          const normalizedBookings = bookingRecords.map(toCalendarBooking);
          const normalizedOccupancy = occupancyRecords
            ? occupancyRecords.map(toCalendarBooking)
            : normalizedBookings;
          const bedMap = new Map(bedRecords.map((bed) => [bed.id, bed]));
          normalizedBookings.forEach((booking) => {
            if (booking.bed?.id && !bedMap.has(booking.bed.id)) {
              bedMap.set(booking.bed.id, booking.bed);
            }
          });
          setBeds([...bedMap.values()].filter(
            (bed) => bed.isActive !== false &&
              (bed.room?.isBookable !== false || Boolean(bed.room?.allocation)),
          ));
          setBookings(normalizedBookings);
          setOccupancyBookings(normalizedOccupancy);
        }

        loadedRangeRef.current = {
          loaded: true,
          search,
          status: statusFilter,
          start: rangeStart,
          end: windowEnd,
        };
      } catch (error) {
        if (isCurrentRequest) {
          setCalendarError(error.message || "Failed to load calendar bookings.");
          if (!isExtension) {
            loadedRangeRef.current = null;
            setBeds([]);
            setBookings([]);
            setOccupancyBookings([]);
          }
        }
      } finally {
        if (isCurrentRequest) setIsLoadingCalendar(false);
      }
    };
    fetchCalendarData();
    return () => {
      isCurrentRequest = false;
    };
  }, [search, statusFilter, rangeStart, windowEnd, reloadKey]);

  /*
   * Blocked days per room: unfiltered occupancy
   * bookings plus fully allocated beds, so filters
   * can never unlock an already occupied or
   * allocated date
   */
  const blockedDays = useMemo(() => {
    const map = new Map();

    if (dates.length === 0) {
      return map;
    }

    const lastIndex = dates.length - 1;

    beds.forEach((bed) => {
      if (!bed.room?.allocation) return;

      const days = new Set();

      for (let i = 0; i <= lastIndex; i += 1) {
        days.add(i);
      }

      map.set(bed.id, days);
    });

    occupancyBookings.forEach((booking) => {
      const roomName = booking?.bedId;

      if (
        !roomName ||
        !["CONFIRMED", "IN_HOUSE", "HOME_LEAVE"].includes(String(booking.status).toUpperCase()) ||
        !bookingOverlaps(
          rangeStart,
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
        dayCount(rangeStart, start)
      );

      const to = Math.min(
        lastIndex,
        dayCount(rangeStart, end) - 1
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
  }, [beds, occupancyBookings, rangeStart, windowEnd, dates]);

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
      Math.floor(scrollLeft / DAY_WIDTH)
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

  /*
   * Extend the calendar range while scrolling: forward
   * into future dates and backward into past dates.
   */
  const handleCalendarScroll = useCallback(() => {
    updateVisibleRange();

    const container = calendarRef.current;

    if (
      !container ||
      dates.length === 0
    ) {
      return;
    }

    if (
      !dragActiveRef.current &&
      !startDate &&
      !backwardExtendPendingRef.current &&
      container.scrollLeft <= RANGE_EXTEND_THRESHOLD
    ) {
      backwardExtendPendingRef.current = true;
      pendingScrollAdjustRef.current +=
        RANGE_EXTEND_DAYS * DAY_WIDTH;
      setLeadDays(
        (current) => current + RANGE_EXTEND_DAYS
      );
    }

    if (endDate) return;

    const maxScroll =
      container.scrollWidth - container.clientWidth;

    if (maxScroll <= 0) return;

    const remaining =
      maxScroll - container.scrollLeft;

    if (remaining > RANGE_EXTEND_THRESHOLD) return;

    setCalendarEnd((current) => {
      const extended = addDays(current, RANGE_EXTEND_DAYS);
      return extended || current;
    });
  }, [dates.length, endDate, startDate, updateVisibleRange]);

  /*
   * Anchor the initial view on the window start once
   * the lead buffer exists. Scrolling left then reveals
   * the buffered past dates.
   */
  useLayoutEffect(() => {
    const container = calendarRef.current;

    if (
      !container ||
      initialScrollDoneRef.current ||
      dates.length === 0
    ) {
      return;
    }

    initialScrollDoneRef.current = true;
    container.scrollLeft = leadDays * DAY_WIDTH;
  }, [dates.length, leadDays]);

  /*
   * Prepending past dates shifts the timeline, so
   * restore scrollLeft to keep the view from jumping.
   */
  useLayoutEffect(() => {
    const container = calendarRef.current;
    const adjust = pendingScrollAdjustRef.current;

    if (!container || !adjust) return;

    pendingScrollAdjustRef.current = 0;
    backwardExtendPendingRef.current = false;
    container.scrollLeft += adjust;
  }, [leadDays]);

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
    return bookings.filter(
      (booking) =>
        !["CANCELLED", "ARCHIVED"].includes(String(booking.status).toUpperCase()) &&
        bookingOverlaps(
          rangeStart,
          windowEnd,
          booking
        )
    );
  }, [rangeStart, windowEnd, bookings]);

  /* Calendar rows follow beds because bookings reserve beds. */
  const locations = useMemo(() => [...new Map(beds.map((bed) => {
    const location = bed.room?.floor?.location;
    return location?.id ? [location.id, location] : null;
  }).filter(Boolean)).values()].sort((a, b) => a.name.localeCompare(b.name)), [beds]);
  const floors = useMemo(() => [...new Map(beds.map((bed) => {
    const floor = bed.room?.floor;
    return floor?.id && (!selectedLocation || floor.location?.id === selectedLocation)
      ? [floor.id, floor] : null;
  }).filter(Boolean)).values()].sort((a, b) => (a.floorNumber ?? 0) - (b.floorNumber ?? 0)), [beds, selectedLocation]);
  const activeLocationName = locations.find((location) => location.id === selectedLocation)?.name ?? "All locations";
  const activeFloorName = floors.find((floor) => floor.id === selectedFloor)?.name ?? "All floors";
  const activeBeds = useMemo(() => beds.filter((bed) =>
    (!selectedLocation || bed.room?.floor?.location?.id === selectedLocation) &&
    (!selectedFloor || bed.room?.floor?.id === selectedFloor) &&
    (statusFilter !== "ALLOCATED" || Boolean(bed.room?.allocation))
  ).sort((a, b) => {
    const locationOrder = (a.room?.floor?.location?.name ?? "").localeCompare(b.room?.floor?.location?.name ?? "");
    if (locationOrder) return locationOrder;
    const floorOrder = (a.room?.floor?.floorNumber ?? 0) - (b.room?.floor?.floorNumber ?? 0);
    if (floorOrder) return floorOrder;
    return (a.room?.name ?? "").localeCompare(b.room?.name ?? "") || (a.name ?? "").localeCompare(b.name ?? "");
  }), [beds, selectedLocation, selectedFloor, statusFilter]);

  /*
   * Calculate booking position
   */
  const getBookingStyle = (booking) => {
    const bookingStart =
      parseDate(booking.started_at);

    const bookingEnd =
      parseDate(booking.ended_at);

    const calendarStart =
      parseDate(rangeStart);

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
        rangeStart,
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
      search.trim() || selectedLocation || selectedFloor || statusFilter ||
      startDate ||
      endDate
  );

  const clearFilters = () => {
    setSearch("");
    setSelectedLocation("");
    setSelectedFloor("");
    setStatusFilter("");
    setStartDate("");
    setEndDate("");
    setLeadDays(INITIAL_LEAD_DAYS);

    pendingScrollAdjustRef.current = 0;
    backwardExtendPendingRef.current = false;

    const container = calendarRef.current;
    if (container) {
      container.scrollLeft =
        INITIAL_LEAD_DAYS * DAY_WIDTH;
    }
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
      if (bookingMoveRef.current) {
        const move = bookingMoveRef.current;
        const target = document.elementFromPoint(event.clientX, event.clientY);
        const row = target?.closest("[data-bed-id]");
        if (row) move.destinationBedId = row.dataset.bedId;
        move.dayOffset = Math.round((event.clientX - move.startX) / DAY_WIDTH);
        setBookingMovePreview((previous) => previous
          ? {
              ...previous,
              left: event.clientX - move.grabOffsetX,
              top: event.clientY - move.grabOffsetY,
            }
          : previous);
        return;
      }
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

  const endDrag = useCallback(async () => {
    if (bookingMoveRef.current) {
      const move = bookingMoveRef.current;
      bookingMoveRef.current = null;
      setBookingMovePreview(null);
      setDragScrollDirection(0);
      const destinationBed = activeBeds.find((bed) => bed.id === move.destinationBedId);
      const startedAt = addDays(move.booking.started_at, move.dayOffset);
      const endedAt = addDays(move.booking.ended_at, move.dayOffset);
      if (!destinationBed || !startedAt || !endedAt) return;
      if (destinationBed.id === move.booking.bedId && move.dayOffset === 0) return;
      setBookingMoveError("");
      setBookingMoveNotice("");
      try {
        const conflicts = await loadAllPages("/api/booking", "page", "limit", {
          bedId: destinationBed.id,
          overlapStart: `${startedAt}T00:00:00.000Z`,
          overlapEnd: `${endedAt}T00:00:00.000Z`,
        });
        const conflict = conflicts.find((booking) =>
          booking.id !== move.booking.id &&
          ["CONFIRMED", "IN_HOUSE", "HOME_LEAVE"].includes(String(booking.status).toUpperCase())
        );
        if (conflict) {
          setBookingMoveNotice("This booking can't be moved because the destination bed is already booked for those dates.");
          const conflictDate = conflict.startedAt?.slice(0, 10) ?? conflict.started_at;
          const index = dayCount(rangeStart, conflictDate);
          if (index >= 0 && index < dates.length) flashBlockedCell(destinationBed.id, index);
          return;
        }
      } catch (error) {
        setBookingMoveNotice(error.message || "Could not check the destination bed for conflicts.");
        return;
      }
      setBookingMoveDraft({
        booking: move.booking,
        bed: destinationBed,
        bedId: destinationBed.id,
        startedAt,
        endedAt,
      });
      return;
    }
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
  }, [dates, hasBookedDay, activeBeds, rangeStart]);

  const confirmBookingMove = async () => {
    if (!bookingMoveDraft || isSavingBookingMove) return;
    setIsSavingBookingMove(true);
    setBookingMoveError("");
    try {
      await apiRequest("/api/booking-approval", {
        method: "POST",
        body: JSON.stringify({
          bookingId: bookingMoveDraft.booking.id,
          type: "CHANGE_DATES",
          reason: "Booking move requested from calendar",
          requestedData: {
            bedId: bookingMoveDraft.bedId,
            startedAt: bookingMoveDraft.startedAt,
            endedAt: bookingMoveDraft.endedAt,
          },
        }),
      });
      setBookingMoveDraft(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setBookingMoveError(error.message || "Failed to move booking.");
    } finally {
      setIsSavingBookingMove(false);
    }
  };

  const handleBookingMouseDown = (booking, event) => {
    if (!canCreateBooking || event.button !== 0 || !["CONFIRMED", "IN_HOUSE"].includes(String(booking.status).toUpperCase())) return;
    event.preventDefault();
    event.stopPropagation();
    setHovered(null);
    const rect = event.currentTarget.getBoundingClientRect();
    bookingMoveRef.current = {
      booking,
      startX: event.clientX,
      destinationBedId: booking.bedId,
      dayOffset: 0,
      grabOffsetX: event.clientX - rect.left,
      grabOffsetY: event.clientY - rect.top,
      width: rect.width,
    };
    setBookingMovePreview({
      booking,
      width: rect.width,
      left: rect.left,
      top: rect.top,
    });
  };

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
    <div className={`calendar-view${filtersVisible ? "" : " calendar-view--expanded"}`}>

      <div className="calendar-range">

        <div className="calendar-range__summary">

          <span>
            {visibleStart && visibleEnd
              ? `${formatVisibleDate(visibleStart)} - ${formatVisibleDate(visibleEnd)}`
              : "No dates to display"}
          </span>

          <button
            type="button"
            className="btn btn-neutral calendar-range__toggle"
            aria-expanded={filtersVisible}
            aria-controls="calendar-filters"
            onClick={() => setFiltersVisible((visible) => !visible)}
          >
            <i className={`bi ${filtersVisible ? "bi-eye-slash" : "bi-eye"}`} aria-hidden="true" />
            {filtersVisible ? "Hide tools" : "Show tools"}
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

      {bookingMoveNotice && (
        <p className="error-text" role="alert">{bookingMoveNotice}</p>
      )}

      {/* =========================
          FILTERS
      ========================== */}

      <div id="calendar-filters" hidden={!filtersVisible}>
      <div className="calendar-filters calendar-filters--primary form-actions bookings-toolbar">

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

        <div className="calendar-filters__dates calendar-filters__locations">
          <label className="calendar-date-filter">
            <span>Location</span>
            <select value={selectedLocation} onChange={(event) => {
              setSelectedLocation(event.target.value);
              setSelectedFloor("");
            }}>
              <option value="">All locations</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
          </label>
          <label className="calendar-date-filter">
            <span>Floor</span>
            <select value={selectedFloor} onChange={(event) => setSelectedFloor(event.target.value)}>
              <option value="">All floors</option>
              {floors.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}
            </select>
          </label>
          <label className="calendar-date-filter">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              {STATUS_FILTER_OPTIONS.map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="calendar-filters__dates calendar-filters__range-filters">

          <label className="calendar-date-filter">
            <span>From</span>

            <input
              type="date"
              min={calStart}
              max={calEnd}
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
              min={calStart}
              max={calEnd}
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

       

      </div>
      </div>

      {/* =========================
          CALENDAR
      ========================== */}

      <div
        className="booking-calendar"
        ref={calendarRef}
        onScroll={handleCalendarScroll}
        style={{
          "--calendar-days-width":
            `${dates.length * DAY_WIDTH}px`,
        }}
      >

        {/* HEADER */}

        <div className="calendar-header">

          <div
            className="calendar-room-header"
            title={`${activeLocationName} · ${activeFloorName}`}
          >
            <span>{activeLocationName}</span>
            <small>{activeFloorName}</small>
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

            activeBeds.map((bed, bedIndex) => {

              const roomBookings =
                filteredBookings.filter(
                  (booking) =>
                    booking.bedId === bed.id
                );

              const groupName = `${bed.room?.floor?.location?.name ?? "Unassigned location"} · ${bed.room?.floor?.name ?? "Unassigned floor"}`;
              const allocation = bed.room?.allocation;
              const allocationDetails = allocation
                ? [allocation.purpose, allocation.description, allocation.notes].filter(Boolean).join(" · ")
                : "";
              const previousBed = activeBeds[bedIndex - 1];
              const previousGroupName = previousBed
                ? `${previousBed.room?.floor?.location?.name ?? "Unassigned location"} · ${previousBed.room?.floor?.name ?? "Unassigned floor"}`
                : null;
              return (
                <Fragment key={bed.id}>
                {groupName !== previousGroupName && (
                  <div className="calendar-location-heading">
                    <span>{groupName}</span>
                  </div>
                )}
                <div
                  className="calendar-row"
                  data-bed-id={bed.id}
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

                    {/* ALLOCATION */}

                    {allocation && (
                      <div
                        className="booking-block booking-allocated"
                        style={{
                          left: 0,
                          width: dates.length * DAY_WIDTH,
                        }}
                        title={allocationDetails}
                        aria-label={`Allocated: ${allocationDetails}`}
                      >
                        <div className="booking-allocated__label">
                          <div className="booking-block__name">ALLOCATED</div>
                          <div className="booking-block__status">{allocation.purpose}</div>
                        </div>
                      </div>
                    )}

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
                            className={`booking-block booking-${statusClass}${canCreateBooking && ["CONFIRMED", "IN_HOUSE"].includes(String(booking.status).toUpperCase()) ? " booking-block--movable" : ""}`}
                            onMouseDown={(event) => handleBookingMouseDown(booking, event)}
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
                </Fragment>
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

      {bookingMovePreview && (
        <div
          className={`booking-block booking-${normalizeStatus(bookingMovePreview.booking.status)} booking-block--drag-preview`}
          style={{
            left: `${bookingMovePreview.left}px`,
            top: `${bookingMovePreview.top}px`,
            width: `${bookingMovePreview.width}px`,
          }}
          aria-hidden="true"
        >
          <div className="booking-block__name">{bookingMovePreview.booking.guest?.name || "Unknown Guest"}</div>
          <div className="booking-block__status">{statusLabel(bookingMovePreview.booking.status)}</div>
        </div>
      )}

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
      {bookingMoveDraft && (
        <div className="modal-overlay" onMouseDown={() => !isSavingBookingMove && setBookingMoveDraft(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="calendar-move-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title" id="calendar-move-title">Confirm booking move</h2>
            </div>
            <div className="modal__form">
              <p>Move {bookingMoveDraft.booking.guest?.name || "this booking"} to {bookingMoveDraft.bed.room?.name} / {bookingMoveDraft.bed.name}?</p>
              <p>{bookingMoveDraft.startedAt} to {addDays(bookingMoveDraft.endedAt, -1)}</p>
              {bookingMoveError && <p className="error-text" role="alert">{bookingMoveError}</p>}
              <div className="modal__actions">
                <button type="button" className="btn btn-neutral" disabled={isSavingBookingMove} onClick={() => setBookingMoveDraft(null)}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={isSavingBookingMove} onClick={confirmBookingMove}>{isSavingBookingMove ? "Saving..." : "Confirm move"}</button>
              </div>
            </div>
          </div>
        </div>
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
    const homeLeave = Array.isArray(booking?.homeLeaves)
      ? booking.homeLeaves.find((leave) => leave.status === "ACTIVE") ?? booking.homeLeaves[0]
      : null;
    const countdown = statusClass === "confirmed"
      ? countdownLabel("Arriving in", booking?.started_at)
      : statusClass === "in_house"
        ? countdownLabel("Leaving in", booking?.ended_at)
        : statusClass === "home_leave"
          ? countdownLabel("Expected return in", homeLeave?.expectedReturnAt?.slice(0, 10))
          : null;

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
        {countdown && (
          <div className="booking-tooltip__row">
            <span>{countdown.slice(0, countdown.indexOf(":"))}</span>
            <strong>{countdown.slice(countdown.indexOf(":") + 2)}</strong>
          </div>
        )}
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

        <div className="booking-tooltip__row">
          <span>Duration</span>
          <strong>
            {dayCount(booking?.started_at, booking?.ended_at)} days
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

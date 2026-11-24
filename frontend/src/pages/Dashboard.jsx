import { useEffect, useMemo, useRef, useState } from "react";
import { Chart, registerables } from "chart.js";

import MainLayout from "../components/MainLayout";
import apiRequest from "../api/client";
import { chartColors } from "../data/dashboardData";

Chart.register(...registerables);
Chart.defaults.font.family = "'Segoe UI', -apple-system, BlinkMacSystemFont, 'SF Pro Text', Avenir, 'Helvetica Neue', Helvetica, Arial, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.color = chartColors.muted;

function ChartCanvas({ type, data, options }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const chart = new Chart(canvasRef.current, { type, data, options });
    return () => chart.destroy();
  }, [type, data, options]);
  return <canvas ref={canvasRef} />;
}

const today = new Date().toISOString().slice(0, 10);
const defaultStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export default function Dashboard() {
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);
  const [trendPeriod, setTrendPeriod] = useState("daily");
  const [statusDate, setStatusDate] = useState(today);
  const [bedLocation, setBedLocation] = useState("");
  const [bedFloor, setBedFloor] = useState("");
  const [activityDate, setActivityDate] = useState(today);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [exportingActivity, setExportingActivity] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({ startDate, endDate, statusDate, activityDate, trendPeriod });
    apiRequest(`/api/dashboard?${params}`)
      .then((result) => { setData(result); setError(""); })
      .catch((requestError) => setError(requestError.message || "Failed to load dashboard data."));
  }, [startDate, endDate, statusDate, activityDate, trendPeriod]);

  const sharedOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8, boxHeight: 8, color: chartColors.dark, padding: 14 } } },
  }), []);
  const lineOptions = useMemo(() => ({
    ...sharedOptions,
    interaction: { mode: "index", intersect: false },
    scales: {
      x: { grid: { display: false }, border: { display: false } },
      y: { beginAtZero: true, suggestedMax: 100, max: 100, grid: { color: chartColors.border }, border: { display: false }, ticks: { stepSize: 20, callback: (value) => `${value}%` } },
    },
  }), [sharedOptions]);
  const barOptions = useMemo(() => ({
    ...sharedOptions,
    plugins: { ...sharedOptions.plugins, legend: { display: false } },
    scales: { x: { grid: { display: false }, border: { display: false } }, y: { beginAtZero: true, grid: { color: chartColors.border }, border: { display: false }, ticks: { precision: 0 } } },
  }), [sharedOptions]);
  const weeklyBarOptions = useMemo(() => ({
    ...sharedOptions,
    scales: { x: { grid: { display: false }, border: { display: false } }, y: { beginAtZero: true, grid: { color: chartColors.border }, border: { display: false }, ticks: { precision: 0 } } },
  }), [sharedOptions]);
  const pieOptions = useMemo(() => ({ ...sharedOptions, plugins: { ...sharedOptions.plugins, legend: { ...sharedOptions.plugins.legend, position: "bottom" } } }), [sharedOptions]);

  const bedLocations = useMemo(() => [...new Map((data?.bedStatusSnapshot ?? []).map((bed) => [bed.locationId, { id: bed.locationId, name: bed.locationName }])).values()].sort((a, b) => a.name.localeCompare(b.name)), [data]);
  const bedFloors = useMemo(() => [...new Map((data?.bedStatusSnapshot ?? []).filter((bed) => !bedLocation || bed.locationId === bedLocation).map((bed) => [bed.floorId, { id: bed.floorId, name: bed.floorName }])).values()].sort((a, b) => a.name.localeCompare(b.name)), [data, bedLocation]);
  const filteredBedStatuses = useMemo(() => {
    const counts = Object.fromEntries((data?.bedStatuses ?? []).map(({ status }) => [status, 0]));
    (data?.bedStatusSnapshot ?? []).filter((bed) => (!bedLocation || bed.locationId === bedLocation) && (!bedFloor || bed.floorId === bedFloor)).forEach((bed) => { counts[bed.status] += 1; });
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  }, [data, bedLocation, bedFloor]);

  const changeTrendPeriod = (period) => {
    const end = new Date(`${today}T00:00:00.000Z`);
    const start = new Date(end);
    if (period === "daily") start.setUTCDate(start.getUTCDate() - 7);
    if (period === "weekly") start.setUTCDate(start.getUTCDate() - 7 * 11);
    if (period === "monthly") {
      start.setUTCDate(1);
      start.setUTCMonth(start.getUTCMonth() - 11);
    }
    setTrendPeriod(period);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(today);
  };

  const exportDailyActivity = async () => {
    if (exportingActivity) return;
    setExportingActivity(true);
    setError("");
    try {
      const file = await apiRequest(`/api/booking/daily-activity/export?date=${statusDate}`, { responseType: "blob" });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `check-ins-check-outs-${statusDate}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.message || "Failed to export daily check-ins and check-outs.");
    } finally {
      setExportingActivity(false);
    }
  };

  const trendData = useMemo(() => ({
    labels: data?.trend.map((item) => item.label) ?? [],
    datasets: [{ label: "Occupancy", data: data?.trend.map((item) => item.occupancyRate) ?? [], borderColor: chartColors.primary, backgroundColor: chartColors.primaryFade, fill: true, tension: 0.25, borderWidth: 2, pointRadius: 3 }],
  }), [data]);
  const bedData = useMemo(() => ({
    labels: filteredBedStatuses.map((item) => item.status),
    datasets: [{ label: "Beds", data: filteredBedStatuses.map((item) => item.count), backgroundColor: [chartColors.primary, chartColors.primaryMid, chartColors.primarySoft, chartColors.brandSoft, chartColors.muted], borderRadius: 4, maxBarThickness: 46 }],
  }), [filteredBedStatuses]);
  const bookingData = useMemo(() => ({
    labels: data?.bookingStatuses.map((item) => item.status.replaceAll("_", " ")) ?? [],
    datasets: [{ label: "Bookings", data: data?.bookingStatuses.map((item) => item.count) ?? [], backgroundColor: [chartColors.primary, chartColors.primaryMid, chartColors.primarySoft, chartColors.muted, chartColors.brandSoft], borderColor: "#ffffff", borderWidth: 2 }],
  }), [data]);
  const weeklyActivityData = useMemo(() => ({
    labels: data?.weeklyActivity.map((item) => item.label) ?? [],
    datasets: [
      { label: "Check-ins", data: data?.weeklyActivity.map((item) => item.checkIns) ?? [], backgroundColor: chartColors.primary, borderRadius: 0, categoryPercentage: 0.8, barPercentage: 1 },
      { label: "Check-outs", data: data?.weeklyActivity.map((item) => item.checkOuts) ?? [], backgroundColor: chartColors.primaryMid, borderRadius: 0, categoryPercentage: 0.8, barPercentage: 1 },
    ],
  }), [data]);
  const summary = data?.summary;
  const stats = [
    ["Total Rooms / Beds", `${summary?.totalRooms ?? "—"} / ${summary?.totalBeds ?? "—"}`, "bi-door-open"],
    ["Occupied Beds / Available Beds", `${summary?.occupiedBeds ?? "—"} / ${summary?.totalBeds ?? "—"}`, "bi-check2-square"],
    ["Occupancy Rate", `${summary?.occupancyRate ?? "—"}%`, "bi-graph-up-arrow"],
    ["Today's Check In / Check Out", `${summary?.totalCheckIns ?? "—"} / ${summary?.totalCheckOuts ?? "—"}`, "bi-calendar-check"],
  ];

  return (
    <MainLayout>
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Dashboard</h1>
            <p className="dashboard-header__subtitle">Room and bed occupancy overview</p>
          </div>
        </div>

        <div className="dashboard-kpis">
          {stats.map(([label, value, icon]) => <article className="dashboard-kpi" key={label}>
            <span className="dashboard-kpi__icon"><i className={`bi ${icon}`} aria-hidden="true" /></span>
            <div className="dashboard-kpi__body"><p className="dashboard-kpi__label">{label}</p><p className="dashboard-kpi__value">{value}</p></div>
          </article>)}
        </div>

        {error && <p role="alert">{error}</p>}
        <div className="dashboard-charts">
          <section className="dashboard-chart dashboard-chart--trend">
            <div className="dashboard-chart__head"><div className="dashboard-chart__text"><h2 className="dashboard-chart__title">Occupancy Trend</h2><p className="dashboard-chart__caption">Occupied beds as a percentage of all beds</p></div>
              <label className="calendar-date-filter"><span>View</span><select value={trendPeriod} onChange={(event) => changeTrendPeriod(event.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
            </div>
            <div className="dashboard-chart__canvas">{data && <ChartCanvas type="line" data={trendData} options={lineOptions} />}</div>
          </section>
          <section className="dashboard-chart dashboard-chart--booking">
            <div className="dashboard-chart__head"><div className="dashboard-chart__text"><h2 className="dashboard-chart__title">Booking Status</h2><p className="dashboard-chart__caption">All time booking status distribution</p></div></div>
            <div className="dashboard-chart__canvas">{data && <ChartCanvas type="pie" data={bookingData} options={pieOptions} />}</div>
          </section>
          <section className="dashboard-chart dashboard-chart--bed">
            <div className="dashboard-chart__head"><div className="dashboard-chart__text"><h2 className="dashboard-chart__title">Bed Status</h2><p className="dashboard-chart__caption">Beds by status on the selected date</p></div><div className="dashboard-date-filters"><label className="calendar-date-filter"><span>Location</span><select value={bedLocation} onChange={(event) => { setBedLocation(event.target.value); setBedFloor(""); }}><option value="">All locations</option>{bedLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label className="calendar-date-filter"><span>Floor</span><select value={bedFloor} onChange={(event) => setBedFloor(event.target.value)}><option value="">All floors</option>{bedFloors.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}</select></label><label className="calendar-date-filter"><span>Date</span><input type="date" value={statusDate} max={today} onChange={(event) => setStatusDate(event.target.value)} /></label></div></div>
            <div className="dashboard-chart__canvas">{data && <ChartCanvas type="bar" data={bedData} options={barOptions} />}</div>
          </section>
          <section className="dashboard-chart dashboard-chart--activity">
            <div className="dashboard-chart__head"><div className="dashboard-chart__text"><h2 className="dashboard-chart__title">Check-ins &amp; Check-outs</h2><p className="dashboard-chart__caption">Latest activity for the selected day</p></div><div className="dashboard-date-filters"><label className="calendar-date-filter"><span>Date</span><input type="date" value={statusDate} max={today} onChange={(event) => setStatusDate(event.target.value)} /></label><button type="button" className="btn btn-neutral" onClick={exportDailyActivity} disabled={exportingActivity}>{exportingActivity ? "Exporting…" : "Export Excel"}</button></div></div>
            {data?.dayActivity?.length ? <div className="dashboard-activity-list" aria-live="polite">
              <table className="dashboard-activity-table">
                <thead><tr><th scope="col">Event</th><th scope="col">Resident</th><th scope="col">Time</th></tr></thead>
                <tbody>{data.dayActivity.map((event) => <tr key={event.id}>
                  <td className={event.type === "Check-in" ? "is-check-in" : "is-check-out"}>{event.type}</td>
                  <td className="dashboard-activity-table__name">{event.residentName}</td>
                  <td><time dateTime={event.at}>{new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></td>
                </tr>)}</tbody>
              </table>
            </div> : <p className="dashboard-activity-empty" aria-live="polite">No check-ins or check-outs for this date.</p>}
          </section>
          <section className="dashboard-chart dashboard-chart--weekly">
            <div className="dashboard-chart__head"><div className="dashboard-chart__text"><h2 className="dashboard-chart__title">Daily Check-ins &amp; Check-outs</h2><p className="dashboard-chart__caption">Seven days through the selected date</p></div><label className="calendar-date-filter"><span>Date</span><input type="date" value={activityDate} max={today} onChange={(event) => setActivityDate(event.target.value)} /></label></div>
            <div className="dashboard-chart__canvas">{data && <ChartCanvas type="bar" data={weeklyActivityData} options={weeklyBarOptions} />}</div>
          </section>
        </div>
      </div>
    </MainLayout>
  );
}

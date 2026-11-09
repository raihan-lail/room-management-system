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
const yearAgo = new Date();
yearAgo.setUTCMonth(yearAgo.getUTCMonth() - 11, 1);
const defaultStart = yearAgo.toISOString().slice(0, 10);

export default function Dashboard() {
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);
  const [statusDate, setStatusDate] = useState(today);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ startDate, endDate, statusDate });
    apiRequest(`/api/dashboard?${params}`)
      .then((result) => { setData(result); setError(""); })
      .catch((requestError) => setError(requestError.message || "Failed to load dashboard data."));
  }, [startDate, endDate, statusDate]);

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
  const pieOptions = useMemo(() => ({ ...sharedOptions, plugins: { ...sharedOptions.plugins, legend: { ...sharedOptions.plugins.legend, position: "bottom" } } }), [sharedOptions]);

  const trendData = useMemo(() => ({
    labels: data?.trend.map((item) => item.month) ?? [],
    datasets: [{ label: "Occupancy", data: data?.trend.map((item) => item.occupancyRate) ?? [], borderColor: chartColors.primary, backgroundColor: chartColors.primaryFade, fill: true, tension: 0.25, borderWidth: 2, pointRadius: 3 }],
  }), [data]);
  const bedData = useMemo(() => ({
    labels: data?.bedStatuses.map((item) => item.status) ?? [],
    datasets: [{ label: "Beds", data: data?.bedStatuses.map((item) => item.count) ?? [], backgroundColor: [chartColors.primary, chartColors.primaryMid, chartColors.primarySoft, chartColors.brandSoft, chartColors.muted], borderRadius: 4, maxBarThickness: 46 }],
  }), [data]);
  const bookingData = useMemo(() => ({
    labels: data?.bookingStatuses.map((item) => item.status.replaceAll("_", " ")) ?? [],
    datasets: [{ label: "Bookings", data: data?.bookingStatuses.map((item) => item.count) ?? [], backgroundColor: [chartColors.primary, chartColors.primaryMid, chartColors.primarySoft, chartColors.muted, chartColors.brandSoft], borderColor: "#ffffff", borderWidth: 2 }],
  }), [data]);

  const summary = data?.summary;
  const stats = [
    ["Total Rooms / Beds", `${summary?.totalRooms ?? "—"} / ${summary?.totalBeds ?? "—"}`, "bi-door-open"],
    ["Available Beds", summary?.availableBeds ?? "—", "bi-check2-square"],
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
          <section className="dashboard-chart dashboard-chart--wide">
            <div className="dashboard-chart__head"><div className="dashboard-chart__text"><h2 className="dashboard-chart__title">Occupancy Trend</h2><p className="dashboard-chart__caption">Occupied beds as a percentage of all beds</p></div>
              <div className="dashboard-date-filters"><label className="calendar-date-filter"><span>From</span><input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} /></label><label className="calendar-date-filter"><span>To</span><input type="date" value={endDate} min={startDate} max={today} onChange={(event) => setEndDate(event.target.value)} /></label></div>
            </div>
            <div className="dashboard-chart__canvas">{data && <ChartCanvas type="line" data={trendData} options={lineOptions} />}</div>
          </section>
          <section className="dashboard-chart">
            <div className="dashboard-chart__head"><div className="dashboard-chart__text"><h2 className="dashboard-chart__title">Bed Status</h2><p className="dashboard-chart__caption">Beds by status on the selected date</p></div><label className="calendar-date-filter"><span>Date</span><input type="date" value={statusDate} max={today} onChange={(event) => setStatusDate(event.target.value)} /></label></div>
            <div className="dashboard-chart__canvas">{data && <ChartCanvas type="bar" data={bedData} options={barOptions} />}</div>
          </section>
          <section className="dashboard-chart">
            <div className="dashboard-chart__head"><div className="dashboard-chart__text"><h2 className="dashboard-chart__title">Booking Status</h2><p className="dashboard-chart__caption">All time booking status distribution</p></div></div>
            <div className="dashboard-chart__canvas">{data && <ChartCanvas type="pie" data={bookingData} options={pieOptions} />}</div>
          </section>
        </div>
      </div>
    </MainLayout>
  );
}

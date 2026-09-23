import { useEffect, useMemo, useRef } from "react";
import { Chart, registerables } from "chart.js";

import MainLayout from "../components/MainLayout";
import {
  kpiStats,
  bookingTrendChartData,
  roomTypeChartData,
  bookingStatusChartData,
  roomDemandChartData,
} from "../data/dashboardData";

Chart.register(...registerables);

Chart.defaults.font.family =
  "'Segoe UI', -apple-system, BlinkMacSystemFont, 'SF Pro Text', Avenir, 'Helvetica Neue', Helvetica, Arial, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.color = "#64748b";

function ChartCanvas({ type, data, options }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const chart = new Chart(canvasRef.current, { type, data, options });

    return () => chart.destroy();
  }, [type, data, options]);

  return <canvas ref={canvasRef} />;
}

export default function Dashboard() {
  const sharedOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 8,
            boxHeight: 8,
            color: "#111827",
            padding: 14,
          },
        },
        tooltip: {
          backgroundColor: "#111827",
          padding: 10,
          cornerRadius: 6,
          titleFont: { size: 12, weight: 600 },
          bodyFont: { size: 11 },
        },
      },
    }),
    []
  );

  const lineOptions = useMemo(
    () => ({
      ...sharedOptions,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: "#64748b" },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#e2e8f0" },
          border: { display: false },
          ticks: { color: "#64748b", stepSize: 50 },
        },
      },
    }),
    [sharedOptions]
  );

  const barOptions = useMemo(
    () => ({
      ...sharedOptions,
      plugins: {
        ...sharedOptions.plugins,
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: "#64748b" },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#e2e8f0" },
          border: { display: false },
          ticks: { color: "#64748b", stepSize: 100 },
        },
      },
    }),
    [sharedOptions]
  );

  const pieOptions = useMemo(
    () => ({
      ...sharedOptions,
      plugins: {
        ...sharedOptions.plugins,
        legend: {
          ...sharedOptions.plugins.legend,
          position: "bottom",
        },
      },
    }),
    [sharedOptions]
  );

  const radarOptions = useMemo(
    () => ({
      ...sharedOptions,
      plugins: {
        ...sharedOptions.plugins,
        legend: {
          ...sharedOptions.plugins.legend,
          position: "bottom",
        },
      },
      scales: {
        r: {
          beginAtZero: true,
          suggestedMax: 100,
          angleLines: { color: "#e2e8f0" },
          grid: { color: "#e2e8f0" },
          pointLabels: { color: "#111827", font: { size: 11, weight: 600 } },
          ticks: {
            color: "#64748b",
            backdropColor: "transparent",
            stepSize: 20,
          },
        },
      },
    }),
    [sharedOptions]
  );

  return (
    <MainLayout>
      <div className="dashboard">
        {/* HEADER */}
        <div className="dashboard-header">
          <div className="dashboard-header__text">
            <h1 className="dashboard-header__title">Dashboard</h1>
            <p className="dashboard-header__subtitle">
              Room booking overview and performance at a glance
            </p>
          </div>

          <span className="dashboard-header__badge">
            <i className="bi bi-calendar3" aria-hidden="true" />
            Last 12 months
          </span>
        </div>

        {/* KPI CARDS */}
        <div className="dashboard-kpis">
          {kpiStats.map((stat) => (
            <article className="dashboard-kpi" key={stat.id}>
              <span className="dashboard-kpi__icon">
                <i className={`bi ${stat.icon}`} aria-hidden="true" />
              </span>

              <div className="dashboard-kpi__body">
                <p className="dashboard-kpi__label">{stat.label}</p>
                <p className="dashboard-kpi__value">{stat.value}</p>
                <p
                  className={`dashboard-kpi__trend ${
                    stat.isUp ? "is-up" : "is-down"
                  }`}
                >
                  <i
                    className={`bi ${
                      stat.isUp ? "bi-arrow-up-right" : "bi-arrow-down-right"
                    }`}
                    aria-hidden="true"
                  />
                  {stat.trend}
                </p>
              </div>
            </article>
          ))}
        </div>

        {/* CHARTS */}
        <div className="dashboard-charts">
          {/* LINE CHART */}
          <section className="dashboard-chart dashboard-chart--wide">
            <div className="dashboard-chart__head">
              <div className="dashboard-chart__text">
                <h2 className="dashboard-chart__title">Booking and Allocations</h2>
                <p className="dashboard-chart__caption">
                  Booked and allocated rooms per month
                </p>
              </div>
            </div>

            <div className="dashboard-chart__canvas">
              <ChartCanvas
                type="line"
                data={bookingTrendChartData}
                options={lineOptions}
              />
            </div>
          </section>

          {/* BAR CHART */}
          <section className="dashboard-chart">
            <div className="dashboard-chart__head">
              <div className="dashboard-chart__text">
                <h2 className="dashboard-chart__title">Room Status</h2>
                <p className="dashboard-chart__caption">
                  Total room status
                </p>
              </div>
            </div>

            <div className="dashboard-chart__canvas">
              <ChartCanvas
                type="bar"
                data={roomTypeChartData}
                options={barOptions}
              />
            </div>
          </section>

          {/* PIE CHART */}
          <section className="dashboard-chart">
            <div className="dashboard-chart__head">
              <div className="dashboard-chart__text">
                <h2 className="dashboard-chart__title">Booking Status</h2>
                <p className="dashboard-chart__caption">
                  Distribution of bookings by current status
                </p>
              </div>
            </div>

            <div className="dashboard-chart__canvas">
              <ChartCanvas
                type="pie"
                data={bookingStatusChartData}
                options={pieOptions}
              />
            </div>
          </section>

          {/* RADAR CHART */}
          <section className="dashboard-chart dashboard-chart--wide">
            <div className="dashboard-chart__head">
              <div className="dashboard-chart__text">
                <h2 className="dashboard-chart__title">Weekly Room Demand</h2>
                <p className="dashboard-chart__caption">
                  Occupancy demand by day of week (percentage)
                </p>
              </div>
            </div>

            <div className="dashboard-chart__canvas">
              <ChartCanvas
                type="radar"
                data={roomDemandChartData}
                options={radarOptions}
              />
            </div>
          </section>
        </div>
      </div>
    </MainLayout>
  );
}

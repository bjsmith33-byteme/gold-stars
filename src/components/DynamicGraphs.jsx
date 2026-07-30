import { useMemo, useState } from "react";
import ButtonGroup from "react-bootstrap/ButtonGroup";
import Button from "react-bootstrap/Button";
import { Chart } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  BarController,
  LineController,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { personChartSeries } from "../lib/aggregate.js";
import { useBsTheme } from "../lib/theme.js";

// Register only the pieces we use (leaner than ...registerables). The generic <Chart>
// needs both controllers so we can switch type at runtime.
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  BarController,
  LineController,
  Filler,
  Tooltip,
  Legend,
);

// Bootstrap's --bs-warning gold, used for the single aggregate series.
const GOLD = "#ffc107";

// Colorblind-safe categorical palette (Okabe–Ito) for the faceted per-area series,
// paired with distinct point symbols so lines stay distinguishable without relying on
// color alone (the marker also drives the legend swatch in line mode).
const PALETTE = ["#e69f00", "#56b4e9", "#009e73", "#cc79a7", "#0072b2", "#d55e00", "#f0e442"];
const POINT_STYLES = ["circle", "rect", "triangle", "rectRot", "star", "crossRot", "rectRounded"];

/** Theme-aware tick/grid colors so the chart reads on both the cream and brown surfaces. */
function axisColors(theme) {
  return theme === "dark"
    ? { tick: "rgba(235, 225, 200, 0.8)", grid: "rgba(235, 205, 135, 0.13)" }
    : { tick: "rgba(60, 45, 15, 0.75)", grid: "rgba(130, 100, 30, 0.12)" };
}

/** Interactive "stars over time" chart for one person's stats (personStats output).
 *  Two toggles: line/bar, and aggregate (one gold series) vs. faceted (one series per
 *  knowledge area). Designed to drop into the UserStats card as a section. */
export function DynamicGraphs({ stats }) {
  const theme = useBsTheme();
  const [chartType, setChartType] = useState("bar"); // "bar" | "line"
  const [faceted, setFaceted] = useState(false);

  const series = useMemo(() => personChartSeries(stats), [stats]);
  const { tick, grid } = axisColors(theme);
  const stacked = faceted && chartType === "bar";

  const data = useMemo(() => {
    if (faceted) {
      return {
        labels: series.labels,
        datasets: series.faceted.map((f, i) => {
          const color = PALETTE[i % PALETTE.length];
          return {
            label: f.category,
            data: f.counts,
            backgroundColor: color,
            borderColor: color,
            borderWidth: 2,
            tension: 0.3,
            pointStyle: POINT_STYLES[i % POINT_STYLES.length],
            pointRadius: chartType === "line" ? 4 : 0,
            pointHoverRadius: 6,
          };
        }),
      };
    }
    return {
      labels: series.labels,
      datasets: [
        {
          label: "Stars",
          data: series.aggregate,
          backgroundColor: chartType === "bar" ? GOLD : "rgba(255, 193, 7, 0.18)",
          borderColor: GOLD,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: chartType === "line" ? 2 : 0,
          fill: chartType === "line",
        },
      ],
    };
  }, [series, faceted, chartType]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          display: faceted,
          position: "bottom",
          labels: { color: tick, boxWidth: 12, usePointStyle: chartType === "line" },
        },
      },
      scales: {
        x: { stacked, ticks: { color: tick }, grid: { display: false } },
        y: {
          stacked,
          beginAtZero: true,
          ticks: { color: tick, precision: 0 },
          grid: { color: grid },
        },
      },
    }),
    [faceted, stacked, chartType, tick, grid],
  );

  return (
    <div className="mb-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-1">
        <div className="small fw-semibold text-body-secondary">Stars over time</div>
        <div className="d-flex gap-2">
          <ButtonGroup size="sm">
            <Button
              variant={chartType === "bar" ? "warning" : "outline-warning"}
              onClick={() => setChartType("bar")}
            >
              Bar
            </Button>
            <Button
              variant={chartType === "line" ? "warning" : "outline-warning"}
              onClick={() => setChartType("line")}
            >
              Line
            </Button>
          </ButtonGroup>
          <ButtonGroup size="sm">
            <Button
              variant={!faceted ? "warning" : "outline-warning"}
              onClick={() => setFaceted(false)}
            >
              Total
            </Button>
            <Button
              variant={faceted ? "warning" : "outline-warning"}
              onClick={() => setFaceted(true)}
            >
              By area
            </Button>
          </ButtonGroup>
        </div>
      </div>
      <div style={{ position: "relative", height: "12rem" }}>
        <Chart key={`${chartType}-${faceted}-${theme}`} type={chartType} data={data} options={options} />
      </div>
    </div>
  );
}

export default DynamicGraphs;

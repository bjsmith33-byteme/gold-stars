import React from "react";
import { useBsTheme } from "../lib/theme.js";

/**
 * StarChartPosterboard
 *
 * A transparent-background "posterboard" star chart drawn as inline SVG. Gold/red/blue
 * stars keep fixed colors in every theme; only the marker "ink" (ruled lines + names +
 * title) swaps between dark and chalk-light so it stays visible on both light and dark
 * surfaces.
 *
 * Ink follows the app's Bootstrap theme (<html data-bs-theme>) by default, so it tracks the
 * ThemeToggle — not the OS setting. Pass theme="light" | "dark" to force it.
 *
 *   <StarChartPosterboard />                 // follows the app theme (recommended)
 *   <StarChartPosterboard theme="light" />   // force dark ink, for light backgrounds
 *   <StarChartPosterboard theme="dark" />    // force chalk ink, for dark backgrounds
 */
export default function StarChartPosterboard({ theme = "auto", className = "", style = {} }) {
  const appTheme = useBsTheme();
  const resolved = theme === "auto" ? appTheme : theme;
  const ink = resolved === "dark" ? "#f5f0e0" : "#1a1a1a";

  // Unique ids so the shared <defs> (star + gradients) never collide across instances.
  const uid = React.useId().replace(/[:]/g, "");
  const starId = `${uid}-star`;
  const fadeH = `${uid}-fadeH`;
  const fadeDarkEnd = `${uid}-fadeDarkEnd`;

  return (
    <div className={className} style={style}>
      <svg
        style={{ "--sc-ink": ink }}
        width="100%"
        viewBox="0 0 680 430"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
      >
        <title>Star chart posterboard</title>
        <desc>
          A posterboard with ruler-straight sharpie-drawn rows for William, Edna, Nancy, and Wayne,
          gold star stickers marking their counts with a few stars swapped for red or blue, light
          grey tape at each corner, and the header "you're a superstar!" flanked by two large
          hand-drawn blue stars.
        </desc>
        <defs>
          <path
            id={starId}
            d="M0,-14 L3.527,-4.854 L13.32,-4.33 L5.706,1.854 L8.23,11.32 L0,6 L-8.23,11.32 L-5.706,1.854 L-13.32,-4.33 L-3.527,-4.854 Z"
          />
          <linearGradient id={fadeH} gradientUnits="userSpaceOnUse" x1="40" y1="0" x2="630" y2="0">
            <stop offset="0%" stopColor="var(--sc-ink)" stopOpacity="0.95" />
            <stop offset="60%" stopColor="var(--sc-ink)" stopOpacity="0.85" />
            <stop offset="88%" stopColor="var(--sc-ink)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--sc-ink)" stopOpacity="0.22" />
          </linearGradient>
          <linearGradient id={fadeDarkEnd} gradientUnits="userSpaceOnUse" x1="40" y1="0" x2="630" y2="0">
            <stop offset="0%" stopColor="var(--sc-ink)" stopOpacity="0.95" />
            <stop offset="50%" stopColor="var(--sc-ink)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--sc-ink)" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        <rect x="20" y="20" width="640" height="380" rx="6" fill="none" stroke="#d8c393" strokeWidth="3" />

        <rect x="4" y="6" width="58" height="22" rx="2" fill="#d9d9d9" opacity="0.75" transform="rotate(-12 33 17)" />
        <rect x="620" y="4" width="58" height="22" rx="2" fill="#d9d9d9" opacity="0.75" transform="rotate(10 649 15)" />
        <rect x="6" y="386" width="58" height="22" rx="2" fill="#d9d9d9" opacity="0.75" transform="rotate(8 35 397)" />
        <rect x="614" y="388" width="58" height="22" rx="2" fill="#d9d9d9" opacity="0.75" transform="rotate(-9 643 399)" />

        <g transform="translate(95,58)">
          <path
            d="M-1.19,-33.98 L7.83,-11.61 L29.8,-8.54 L11.28,4.10 L17.49,27.98 L-0.52,14.99 L-17.86,22.85 L-12.50,3.58 L-29.67,-11.99 L-7.83,-11.61 Z"
            fill="#3d7fd6"
            stroke="#204d8c"
            strokeWidth="1"
          />
          <path
            d="M-1.19,-33.98 L7.83,-11.61 L29.8,-8.54 L11.28,4.10 L17.49,27.98 L-0.52,14.99 L-17.86,22.85 L-12.50,3.58 L-29.67,-11.99 L-7.83,-11.61 Z"
            fill="none"
            stroke="#204d8c"
            strokeWidth="0.7"
            opacity="0.5"
            transform="rotate(3) scale(1.03)"
          />
          <ellipse cx="6" cy="-9" rx="2.6" ry="1.7" fill="#8fb2e0" opacity="0.85" transform="rotate(15 6 -9)" />
          <ellipse cx="-9" cy="11" rx="2.3" ry="1.6" fill="#8fb2e0" opacity="0.85" transform="rotate(-20 -9 11)" />
        </g>

        <g transform="translate(585,58)">
          <path
            d="M1.08,-30.98 L8.36,-9.96 L32.02,-7.98 L13.70,6.10 L13.62,25.60 L-1.25,11.93 L-21.41,23.78 L-13.69,2.91 L-28.53,-9.27 L-8.00,-10.25 Z"
            fill="#3d7fd6"
            stroke="#204d8c"
            strokeWidth="1"
          />
          <path
            d="M1.08,-30.98 L8.36,-9.96 L32.02,-7.98 L13.70,6.10 L13.62,25.60 L-1.25,11.93 L-21.41,23.78 L-13.69,2.91 L-28.53,-9.27 L-8.00,-10.25 Z"
            fill="none"
            stroke="#204d8c"
            strokeWidth="0.7"
            opacity="0.5"
            transform="rotate(-4) scale(1.03)"
          />
          <ellipse cx="-6" cy="-7" rx="2.5" ry="1.6" fill="#8fb2e0" opacity="0.85" transform="rotate(10 -6 -7)" />
          <ellipse cx="10" cy="10" rx="2.2" ry="1.5" fill="#8fb2e0" opacity="0.85" transform="rotate(-15 10 10)" />
        </g>

        <text
          x="340"
          y="62"
          textAnchor="middle"
          fontFamily="'Segoe Print','Bradley Hand',cursive"
          fontWeight="700"
          fontSize="32"
          fill="var(--sc-ink)"
          transform="rotate(-1 340 62)"
        >
          YOU'RE A SUPERSTAR!
        </text>

        <g fontFamily="'Segoe Print','Bradley Hand',cursive" fontWeight="700" fontSize="30" fill="var(--sc-ink)">
          <text x="50" y="135" transform="rotate(-1 50 135)">William</text>
          <text x="50" y="205" transform="rotate(1 50 205)">Edna</text>
          <text x="50" y="275" transform="rotate(-1 50 275)">Nancy</text>
          <text x="50" y="345" transform="rotate(1 50 345)">Wayne</text>
        </g>

        {/* William: 8 stars, 4th swapped to red */}
        <g>
          <use href={`#${starId}`} transform="translate(190,120) rotate(-6) scale(1.05)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(232,118) rotate(8)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(274,122) rotate(-4)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(316,119) rotate(12) scale(1.1)" fill="#e14b3f" stroke="#a3271e" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(358,123) rotate(-9)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(400,120) rotate(5)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(442,122) rotate(-7)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(484,119) rotate(9)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
        </g>

        {/* Edna: 5 gold + 1 blue */}
        <g>
          <use href={`#${starId}`} transform="translate(190,190) rotate(6) scale(1.05)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(232,193) rotate(-8)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(274,189) rotate(4)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(316,192) rotate(-10)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(358,190) rotate(7)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(400,192) rotate(-14) scale(1.1)" fill="#3d7fd6" stroke="#204d8c" strokeWidth="1" />
        </g>

        {/* Nancy: 10 stars, 3rd swapped to red */}
        <g>
          <use href={`#${starId}`} transform="translate(190,260) rotate(-5) scale(1.05)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(232,263) rotate(9)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(274,259) rotate(-11) scale(1.1)" fill="#e14b3f" stroke="#a3271e" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(316,262) rotate(8)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(358,260) rotate(-9)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(400,263) rotate(5)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(442,259) rotate(-7)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(484,262) rotate(10)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(526,260) rotate(-4)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(568,263) rotate(6)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
        </g>

        {/* Wayne: 6 gold stars */}
        <g>
          <use href={`#${starId}`} transform="translate(190,330) rotate(7) scale(1.05)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(232,333) rotate(-9)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(274,329) rotate(5)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(316,332) rotate(-6)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(358,330) rotate(8)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
          <use href={`#${starId}`} transform="translate(400,333) rotate(-5)" fill="#f0c33c" stroke="#b8862a" strokeWidth="1" />
        </g>

        <line x1="40" y1="155" x2="630" y2="155" stroke={`url(#${fadeH})`} strokeWidth="4" strokeLinecap="round" />

        <line x1="40" y1="223.9" x2="630" y2="223.9" stroke={`url(#${fadeH})`} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="40" y1="226.1" x2="630" y2="226.1" stroke={`url(#${fadeH})`} strokeWidth="1.8" strokeLinecap="round" />

        <line x1="40" y1="295" x2="630" y2="295" stroke={`url(#${fadeDarkEnd})`} strokeWidth="4" strokeLinecap="round" />

        <line x1="40" y1="365" x2="630" y2="363.2" stroke={`url(#${fadeH})`} strokeWidth="2.6" strokeLinecap="round" />
        <line x1="40" y1="365" x2="630" y2="366.8" stroke={`url(#${fadeH})`} strokeWidth="2.6" strokeLinecap="round" />

        <use href={`#${starId}`} transform="translate(614,300) rotate(16) scale(1.1)" fill="#3d7fd6" stroke="#204d8c" strokeWidth="1" />
      </svg>
    </div>
  );
}

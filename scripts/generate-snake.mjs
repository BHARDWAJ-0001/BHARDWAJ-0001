
import fs from "node:fs";
import path from "node:path";

const token = process.env.GITHUB_TOKEN;
const username = process.env.GITHUB_USER || "BHARDWAJ-0001";

if (!token) throw new Error("GITHUB_TOKEN is missing");

const today = new Date();
today.setUTCHours(23, 59, 59, 999);

const from = new Date(today);
from.setUTCDate(from.getUTCDate() - 364);

const query = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            weekday
            contributionCount
            contributionLevel
          }
        }
      }
    }
  }
}`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    query,
    variables: {
      login: username,
      from: from.toISOString(),
      to: today.toISOString(),
    },
  }),
});

const result = await response.json();

if (!response.ok || result.errors) {
  throw new Error(JSON.stringify(result.errors || result));
}

const calendar =
  result.data?.user?.contributionsCollection?.contributionCalendar;

if (!calendar?.weeks?.length) {
  throw new Error("No contribution calendar data returned.");
}

const weeks = calendar.weeks;
const cell = 9;
const gap = 4;
const step = cell + gap;
const pad = 18;
const labelHeight = 18;
const width = pad * 2 + weeks.length * step - gap;
const height = pad * 2 + labelHeight + 7 * step - gap;

const colors = {
  NONE: "#101a2d",
  FIRST: "#123f64",
  SECOND: "#087db0",
  THIRD: "#00b4df",
  FOURTH: "#70efff",
};

const days = [];
const cells = [];
const points = [];

weeks.forEach((week, x) => {
  week.contributionDays.forEach((day) => {
    const y = day.weekday;
    const px = pad + x * step;
    const py = pad + labelHeight + y * step;

    days.push({ x: px, y: py, day });
    cells.push(
      `<rect x="${px}" y="${py}" width="${cell}" height="${cell}" ` +
      `fill="${colors[day.contributionLevel] || colors.NONE}" ` +
      `stroke="#0a1221" stroke-width="0.6">` +
      `<title>${day.date}: ${day.contributionCount} contributions</title>` +
      `</rect>`
    );
  });
});

// Follow the calendar cells in a continuous zig-zag path.
for (let row = 0; row < 7; row++) {
  const ordered = row % 2 === 0
    ? [...days].filter((d) => d.day.weekday === row).sort((a, b) => a.x - b.x)
    : [...days].filter((d) => d.day.weekday === row).sort((a, b) => b.x - a.x);

  for (const item of ordered) {
    points.push(`${item.x + cell / 2},${item.y + cell / 2}`);
  }
}

if (points.length < 2) {
  throw new Error("Not enough calendar points to draw the snake.");
}

const pathData = points
  .map((point, i) => `${i === 0 ? "M" : "L"} ${point}`)
  .join(" ");

const duration = Math.max(35, points.length * 0.12);
const bodyCount = 9;
const body = [];

for (let i = bodyCount; i >= 1; i--) {
  const shade = i % 3 === 0 ? "#168fce" : "#36cfff";
  body.push(`
    <g>
      <rect x="-4.2" y="-4.2" width="8.4" height="8.4"
        fill="${shade}" stroke="#9af3ff" stroke-width="0.7"
        filter="url(#glow)"/>
      <animateMotion
        dur="${duration}s"
        begin="-${i * 0.13}s"
        repeatCount="indefinite"
        rotate="auto"
        path="${pathData}"/>
    </g>`);
}

const head = `
  <g filter="url(#glow)">
    <rect x="-4.8" y="-4.8" width="9.6" height="9.6"
      fill="#a3f7ff" stroke="#ffffff" stroke-width="0.8"/>
    <rect x="-2.9" y="-2.4" width="1.7" height="1.7" fill="#071322"/>
    <rect x="1.0" y="-2.4" width="1.7" height="1.7" fill="#071322"/>
    <animateMotion
      dur="${duration}s"
      repeatCount="indefinite"
      rotate="auto"
      path="${pathData}"/>
  </g>`;

const svg = `
<svg xmlns="http://www.w3.org/2000/svg"
  width="${width}" height="${height}"
  viewBox="0 0 ${width} ${height}">
  <title>${username}'s GitHub contribution snake</title>
  <desc>Animated pixel snake over real GitHub contribution data.</desc>
  <defs>
    <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="1.7" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="#080f1d" rx="8"/>
  <g>${cells.join("")}</g>
  <g transform="translate(0 0)">
    ${body.join("")}
    ${head}
  </g>
</svg>`;

fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync(
  path.join("dist", "github-contribution-grid-snake.svg"),
  svg
);
fs.writeFileSync(
  path.join("dist", "github-contribution-grid-snake-dark.svg"),
  svg
);

console.log(
  `Generated snake for ${username}: ${calendar.totalContributions} contributions`
);

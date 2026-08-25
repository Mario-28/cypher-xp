/**
 * Dependency-free SVG chart geometry. Returns plain data objects that the
 * Handlebars template turns into SVG elements — no canvas, no libraries.
 */

function round(n) { return Math.round(n * 10) / 10; }

/** Vertical bar chart geometry. items: [{ label, value }] */
export function barChart(items, { width = 560, height = 190, padLeft = 34, padBottom = 26, padTop = 14, padRight = 8 } = {}) {
  const max = Math.max(1, ...items.map(i => i.value));
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const step = items.length ? innerW / items.length : innerW;
  const barW = Math.min(48, step * 0.62);

  const bars = items.map((item, i) => {
    const h = Math.round((item.value / max) * innerH);
    const x = padLeft + i * step + (step - barW) / 2;
    const y = padTop + innerH - h;
    return {
      x: round(x), y: round(y), width: round(barW), height: h,
      value: item.value, label: item.label,
      labelX: round(x + barW / 2), labelY: height - 8,
      valueX: round(x + barW / 2), valueY: round(y - 4)
    };
  });

  const gridLines = [0.25, 0.5, 0.75, 1].map(f => ({
    y: round(padTop + innerH * (1 - f)),
    value: Math.round(max * f),
    x1: padLeft, x2: width - padRight
  }));

  return { bars, gridLines, width, height, max, padLeft, baseY: padTop + innerH };
}

/**
 * Grouped bar chart geometry for multi-actor comparison.
 * groups: [{ label }] (e.g. actors) · series: [{ key, label, color, values }]
 * Each group gets one bar per series, side by side.
 */
export function groupedBarChart(groups, series, { width = 560, height = 200, padLeft = 34, padBottom = 26, padTop = 14, padRight = 8 } = {}) {
  const max = Math.max(1, ...series.flatMap(s => s.values));
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const groupStep = groups.length ? innerW / groups.length : innerW;
  const seriesCount = Math.max(1, series.length);
  const barW = Math.min(22, (groupStep * 0.72) / seriesCount);
  const groupWidth = barW * seriesCount;

  const bars = [];
  groups.forEach((group, gi) => {
    const groupX = padLeft + gi * groupStep + (groupStep - groupWidth) / 2;
    series.forEach((serie, si) => {
      const value = serie.values[gi] ?? 0;
      const h = Math.round((value / max) * innerH);
      const x = groupX + si * barW;
      const y = padTop + innerH - h;
      bars.push({
        x: round(x), y: round(y), width: round(Math.max(2, barW - 1)), height: h,
        color: serie.color, value,
        title: `${group.label} — ${serie.label}: ${value}`
      });
    });
  });

  const labels = groups.map((g, gi) => ({
    label: g.label,
    x: round(padLeft + gi * groupStep + groupStep / 2),
    y: height - 8
  }));

  const gridLines = [0.25, 0.5, 0.75, 1].map(f => ({
    y: round(padTop + innerH * (1 - f)),
    value: Math.round(max * f),
    x1: padLeft, x2: width - padRight
  }));

  const legend = series.map(s => ({ label: s.label, color: s.color }));

  return { bars, labels, gridLines, legend, width, height, max, padLeft, baseY: padTop + innerH };
}

/** Donut chart geometry. segments: [{ label, value, color }] */
export function donutChart(segments, { size = 180, thickness = 32 } = {}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const cx = size / 2, cy = size / 2;
  const rOuter = size / 2 - 2;
  const rInner = rOuter - thickness;

  if (total <= 0) return { paths: [], total: 0, size, cx, cy };

  let angle = -90;
  const paths = [];
  for (const seg of segments) {
    if (seg.value <= 0) continue;
    const sweep = Math.min(359.99, (seg.value / total) * 360);
    const start = angle;
    const end = angle + sweep;
    paths.push({
      ...seg,
      percent: Math.round((seg.value / total) * 100),
      path: annularSector(cx, cy, rOuter, rInner, start, end)
    });
    angle = end;
  }
  return { paths, total, size, cx, cy };
}

function polar(cx, cy, r, deg) {
  const rad = deg * Math.PI / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function annularSector(cx, cy, rOuter, rInner, startDeg, endDeg) {
  const largeArc = (endDeg - startDeg) > 180 ? 1 : 0;
  const [x1, y1] = polar(cx, cy, rOuter, startDeg);
  const [x2, y2] = polar(cx, cy, rOuter, endDeg);
  const [x3, y3] = polar(cx, cy, rInner, endDeg);
  const [x4, y4] = polar(cx, cy, rInner, startDeg);
  return `M ${round(x1)} ${round(y1)} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${round(x2)} ${round(y2)} L ${round(x3)} ${round(y3)} A ${rInner} ${rInner} 0 ${largeArc} 0 ${round(x4)} ${round(y4)} Z`;
}

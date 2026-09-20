import React, { useState, useMemo, useRef } from 'react';
import { Calendar, TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import type { DailyVisitItem } from '../../types/database';

interface VisitsChartProps {
  data: DailyVisitItem[];
  days: number;
  onDaysChange: (days: number) => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}

export const VisitsChart: React.FC<VisitsChartProps> = ({
  data,
  days,
  onDaysChange,
  loading,
  error,
  onRetry,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse and calculate metrics
  const { totalVisits, maxVisits, avgVisits, peakDay } = useMemo(() => {
    if (!data || data.length === 0) {
      return { totalVisits: 0, maxVisits: 0, avgVisits: 0, peakDay: null };
    }
    let total = 0;
    let max = 0;
    let peak: DailyVisitItem | null = null;
    data.forEach((item) => {
      total += item.visits;
      if (item.visits > max) {
        max = item.visits;
        peak = item;
      }
    });
    const avg = data.length > 0 ? (total / data.length).toFixed(1) : '0';
    return {
      totalVisits: total,
      maxVisits: max,
      avgVisits: avg,
      peakDay: peak,
    };
  }, [data]);

  // Dimensions in SVG coordinate space
  const svgWidth = 720;
  const svgHeight = 240;
  const padding = { top: 25, right: 25, bottom: 40, left: 45 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  // Compute Y ceiling (at least 4 to ensure clean integer grid lines)
  const yCeil = useMemo(() => {
    if (maxVisits <= 0) return 4;
    if (maxVisits <= 4) return 4;
    if (maxVisits <= 10) return 10;
    // Round up to next multiple of 5 or 10
    const step = Math.ceil(maxVisits / 4);
    const magnitude = Math.pow(10, Math.floor(Math.log10(step)));
    const roundedStep = Math.ceil(step / magnitude) * magnitude;
    return roundedStep * 4;
  }, [maxVisits]);

  // Map points to SVG coordinates
  const points = useMemo(() => {
    if (!data || data.length === 0) return [];
    const count = data.length;
    return data.map((item, index) => {
      const x = count === 1 ? padding.left + plotWidth / 2 : padding.left + (index / (count - 1)) * plotWidth;
      const y = padding.top + plotHeight - (item.visits / yCeil) * plotHeight;
      return { x, y, item, index };
    });
  }, [data, yCeil, plotWidth, plotHeight, padding.left, padding.top]);

  // Generate SVG path for the line
  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y}`;
    }

    // Monotone cubic or smooth bezier curve
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i != points.length - 2 ? points[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }, [points]);

  // Generate SVG path for the gradient area under the line
  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const baselineY = padding.top + plotHeight;
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    return `${linePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
  }, [linePath, points, padding.top, plotHeight]);

  // Mouse move handler for interactive tooltip
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseSvgX = ((e.clientX - rect.left) / rect.width) * svgWidth;

    let closestIdx = 0;
    let minDistance = Infinity;

    points.forEach((p, idx) => {
      const dist = Math.abs(p.x - mouseSvgX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = idx;
      }
    });

    setHoveredIndex(closestIdx);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  const formatDisplayDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatFullDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const hoveredPoint = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;

  return (
    <div className="bg-white comic-border p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">
              Visits Per Day
            </h2>
            <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-gray-100 text-gray-600 rounded">
              Unique Sessions
            </span>
          </div>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
            Daily unique storefront visitor sessions
          </p>
        </div>

        {/* Range Selector Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex bg-gray-100 p-1 comic-border border-gray-200">
            <button
              onClick={() => onDaysChange(7)}
              className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all ${
                days === 7
                  ? 'bg-brand-black text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => onDaysChange(30)}
              className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all ${
                days === 30
                  ? 'bg-brand-black text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Last 30 Days
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 p-4 bg-gray-50 comic-border border-gray-100">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Total Visits</p>
          <p className="text-xl font-black text-gray-900">{totalVisits}</p>
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Daily Average</p>
          <p className="text-xl font-black text-gray-900">{avgVisits}</p>
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Peak Visits</p>
          <p className="text-xl font-black text-gray-900">{maxVisits}</p>
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Period</p>
          <p className="text-xs font-black uppercase text-gray-700 mt-1">
            {data.length > 0
              ? `${formatDisplayDate(data[0].date)} – ${formatDisplayDate(data[data.length - 1].date)}`
              : `${days} Days`}
          </p>
        </div>
      </div>

      {/* Content States */}
      {error ? (
        <div className="p-8 text-center bg-red-50 comic-border border-red-200">
          <AlertCircle className="mx-auto text-brand-red mb-2" size={32} />
          <p className="font-black uppercase text-xs tracking-tight text-red-800 mb-1">
            Failed to load visitor analytics
          </p>
          <p className="text-xs text-red-600 mb-4">
            Could not retrieve analytics data from the server.
          </p>
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-brand-red text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand-black transition-all inline-flex items-center gap-1.5 comic-border border-white"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      ) : loading ? (
        <div className="p-12 text-center space-y-4">
          <div className="h-44 w-full bg-gray-100 animate-pulse comic-border border-gray-200 flex items-center justify-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Loading visitor analytics...
            </span>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="p-12 text-center bg-gray-50 comic-border border-dashed border-2 border-gray-200">
          <Calendar className="mx-auto text-gray-300 mb-2" size={36} />
          <p className="font-black uppercase text-xs tracking-tight text-gray-500">
            No visitor data yet
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Storefront visitor visits will automatically plot here as sessions are recorded.
          </p>
        </div>
      ) : (
        <div ref={containerRef} className="relative w-full overflow-hidden select-none">
          {/* Floating Hover Tooltip */}
          {hoveredPoint && (
            <div
              className="absolute pointer-events-none z-20 bg-brand-black text-white px-3 py-2 text-xs comic-border border-white shadow-lg transform -translate-x-1/2 -translate-y-full transition-all duration-75"
              style={{
                left: `${(hoveredPoint.x / svgWidth) * 100}%`,
                top: `${(hoveredPoint.y / svgHeight) * 100}%`,
                marginTop: '-12px',
              }}
            >
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                {formatFullDate(hoveredPoint.item.date)}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-brand-red inline-block" />
                <span className="font-black text-sm">{hoveredPoint.item.visits}</span>
                <span className="text-[10px] font-bold text-gray-300">
                  {hoveredPoint.item.visits === 1 ? 'visit' : 'visits'}
                </span>
              </div>
            </div>
          )}

          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto block"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <defs>
              <linearGradient id="visitsAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E63946" stopOpacity="0.22" />
                <stop offset="90%" stopColor="#E63946" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Y-axis Horizontal Gridlines and Labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const yVal = Math.round(yCeil * (1 - ratio));
              const yPos = padding.top + plotHeight * ratio;
              return (
                <g key={ratio}>
                  <line
                    x1={padding.left}
                    y1={yPos}
                    x2={padding.left + plotWidth}
                    y2={yPos}
                    stroke="#F1F5F9"
                    strokeWidth="1.5"
                    strokeDasharray={ratio === 1 ? 'none' : '3 3'}
                  />
                  <text
                    x={padding.left - 10}
                    y={yPos + 3.5}
                    textAnchor="end"
                    className="text-[10px] fill-gray-400 font-bold"
                    style={{ fontSize: '10px' }}
                  >
                    {yVal}
                  </text>
                </g>
              );
            })}

            {/* Area Fill */}
            {areaPath && <path d={areaPath} fill="url(#visitsAreaGrad)" />}

            {/* Line Path */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#E63946"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* X-axis Tick Labels */}
            {points.map((p, idx) => {
              // On 30-day view, skip some labels to prevent visual crowding
              const showLabel =
                days === 7 ||
                idx === 0 ||
                idx === points.length - 1 ||
                idx % Math.ceil(points.length / 7) === 0;

              if (!showLabel) return null;

              return (
                <text
                  key={p.item.date}
                  x={p.x}
                  y={padding.top + plotHeight + 20}
                  textAnchor="middle"
                  className="fill-gray-400 font-bold uppercase tracking-wider"
                  style={{ fontSize: '9.5px' }}
                >
                  {formatDisplayDate(p.item.date)}
                </text>
              );
            })}

            {/* Interactive Crosshair and Hover Dots */}
            {hoveredPoint && (
              <g>
                {/* Vertical crosshair line */}
                <line
                  x1={hoveredPoint.x}
                  y1={padding.top}
                  x2={hoveredPoint.x}
                  y2={padding.top + plotHeight}
                  stroke="#E63946"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  opacity="0.6"
                />
                {/* Outer halo */}
                <circle
                  cx={hoveredPoint.x}
                  cy={hoveredPoint.y}
                  r="7"
                  fill="#E63946"
                  opacity="0.2"
                />
                {/* Center dot */}
                <circle
                  cx={hoveredPoint.x}
                  cy={hoveredPoint.y}
                  r="4.5"
                  fill="#FFFFFF"
                  stroke="#E63946"
                  strokeWidth="2.5"
                />
              </g>
            )}

            {/* Always visible small dots for each data point */}
            {points.map((p) => (
              <circle
                key={p.item.date}
                cx={p.x}
                cy={p.y}
                r="2.5"
                fill="#FFFFFF"
                stroke="#E63946"
                strokeWidth="1.5"
                className="transition-transform hover:scale-150"
              />
            ))}
          </svg>
        </div>
      )}
    </div>
  );
};

import { forwardRef, memo, useMemo } from "react";
import type { GraphDataPoint } from "@/lib/trip-types";
import { GRAPH_MIN_SCALE, GRAPH_WINDOW_SIZE_SECONDS } from "@/lib/config";

type ActiveRidesPanelProps = {
  tripCount: number;
  graphData: GraphDataPoint[];
  currentTime: number;
};

const GRAPH_WIDTH = 176;
const GRAPH_HEIGHT = 52;
const PADDING = { top: 4, right: 4, bottom: 14, left: 4 };

export const ActiveRidesPanel = memo(
  forwardRef<HTMLDivElement, ActiveRidesPanelProps>(function ActiveRidesPanel(
    { tripCount, graphData, currentTime },
    fpsRef
  ) {
    const { linePath, areaPath, maxCount } = useMemo(() => {
      if (graphData.length === 0) {
        return { linePath: "", areaPath: "", maxCount: 0 };
      }

      const timeStart = currentTime - GRAPH_WINDOW_SIZE_SECONDS;
      const timeEnd = currentTime;

      const windowData = graphData.filter((d) => d.time >= timeStart && d.time <= timeEnd);
      if (windowData.length === 0) {
        return { linePath: "", areaPath: "", maxCount: 0 };
      }

      const maxCount = Math.max(GRAPH_MIN_SCALE, ...windowData.map((d) => d.count));

      const chartWidth = GRAPH_WIDTH - PADDING.left - PADDING.right;
      const chartHeight = GRAPH_HEIGHT - PADDING.top - PADDING.bottom;

      const scaleX = (time: number) =>
        PADDING.left + ((time - timeStart) / (timeEnd - timeStart)) * chartWidth;

      const scaleY = (count: number) =>
        PADDING.top + chartHeight - (count / (maxCount * 1.1)) * chartHeight;

      const points = windowData.map((d) => ({
        x: scaleX(d.time),
        y: scaleY(d.count),
      }));

      const linePath = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");

      const areaPath =
        linePath +
        ` L ${points[points.length - 1].x} ${GRAPH_HEIGHT - PADDING.bottom}` +
        ` L ${points[0].x} ${GRAPH_HEIGHT - PADDING.bottom}` +
        ` Z`;

      return { linePath, areaPath, maxCount };
    }, [graphData, currentTime]);

    const hasData = linePath.length > 0;

    return (
      <div className="bg-black/45 backdrop-blur-md text-white/90 px-3 py-2 rounded-xl border border-white/10 shadow-[0_0_24px_rgba(0,0,0,0.6)] w-[200px]">
        <div className="text-[10px] uppercase tracking-widest text-white/60 text-right">Active Rides</div>
        <div className="mt-0.5 text-xl font-semibold tabular-nums text-right">{tripCount.toLocaleString()}</div>
        <div ref={fpsRef} className="mt-0.5 text-[10px] tracking-wide text-white/50 text-right">-- FPS</div>
        <div className="mt-2">
          <svg
            width={GRAPH_WIDTH}
            height={GRAPH_HEIGHT}
            viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
            className="overflow-visible"
          >
            <defs>
              <linearGradient id="graph-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(125, 207, 255, 0.4)" />
                <stop offset="100%" stopColor="rgba(125, 207, 255, 0)" />
              </linearGradient>
            </defs>

            {/* Time axis labels */}
            <text x={PADDING.left} y={GRAPH_HEIGHT - 2} textAnchor="start" fill="rgba(255, 255, 255, 0.4)" fontSize={8}>
              -3h
            </text>
            <text
              x={PADDING.left + (GRAPH_WIDTH - PADDING.left - PADDING.right) / 3}
              y={GRAPH_HEIGHT - 2}
              textAnchor="middle"
              fill="rgba(255, 255, 255, 0.4)"
              fontSize={8}
            >
              -2h
            </text>
            <text
              x={PADDING.left + (2 * (GRAPH_WIDTH - PADDING.left - PADDING.right)) / 3}
              y={GRAPH_HEIGHT - 2}
              textAnchor="middle"
              fill="rgba(255, 255, 255, 0.4)"
              fontSize={8}
            >
              -1h
            </text>
            <text
              x={GRAPH_WIDTH - PADDING.right}
              y={GRAPH_HEIGHT - 2}
              textAnchor="end"
              fill="rgba(255, 255, 255, 0.4)"
              fontSize={8}
            >
              Now
            </text>

            {hasData ? (
              <>
                <path d={areaPath} fill="url(#graph-gradient)" />
                <path
                  d={linePath}
                  fill="none"
                  stroke="rgba(125, 207, 255, 0.9)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {graphData.length > 0 && (
                  <circle
                    cx={GRAPH_WIDTH - PADDING.right}
                    cy={
                      PADDING.top +
                      (GRAPH_HEIGHT - PADDING.top - PADDING.bottom) -
                      (graphData[graphData.length - 1].count / (maxCount * 1.1)) *
                        (GRAPH_HEIGHT - PADDING.top - PADDING.bottom)
                    }
                    r={2.5}
                    fill="rgba(125, 207, 255, 1)"
                  />
                )}
              </>
            ) : (
              <text
                x={GRAPH_WIDTH / 2}
                y={(GRAPH_HEIGHT - PADDING.bottom) / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="rgba(255, 255, 255, 0.3)"
                fontSize={9}
              >
                No data
              </text>
            )}
          </svg>
        </div>
      </div>
    );
  })
);

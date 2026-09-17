import { MINUTES_PER_HOUR, type Plan } from "@/lib/plan";
import { planSummary } from "@/lib/plan-summary";
import { durationLabel, schedule } from "@/lib/plan-schedule";
import { plannerDateContext } from "../planner-date";

const RING_GEOMETRY = {
  viewBox: "0 0 260 260",
  center: 130,
  radius: 103,
  strokeWidth: 29,
  pathLength: 100,
  rotation: -90,
} as const;
const RING_SEGMENT = {
  gapBase: 1.15,
  gapScale: 12,
  minimumLength: 1.2,
} as const;

export function Ring({
  plan,
  date,
  large = false,
  onEdit,
}: {
  plan: Plan;
  date: string;
  large?: boolean;
  onEdit?: (id: string) => void;
}) {
  const { total } = planSummary(plan);
  const dateContext = plannerDateContext(date);
  const rows = schedule(plan).filter((row) => row.minutes !== null);
  const ringSegments = rows.map((block, index) => ({
    block,
    offset: rows
      .slice(0, index)
      .reduce((sum, previous) => sum + (previous.minutes ?? 0), 0),
  }));
  return (
    <div className={`ring-wrap ${large ? "large-ring" : ""}`}>
      <div className="ring-chart">
        <svg
          viewBox={RING_GEOMETRY.viewBox}
          role="img"
          aria-label={`계획 ${total ? durationLabel(total) : "지정한 시간 없음"}, ${plan.blocks.length}개 블록`}
        >
          <circle
            cx={RING_GEOMETRY.center}
            cy={RING_GEOMETRY.center}
            r={RING_GEOMETRY.radius}
            fill="none"
            stroke="#e5e8dc"
            strokeWidth={RING_GEOMETRY.strokeWidth}
          />
          {ringSegments.map(({ block: b, offset: ringOffset }) => {
            const minutes = b.minutes ?? 0;
            const fraction = minutes / (total || 1);
            const offset = ringOffset / (total || 1);
            return (
              <circle
                key={b.id}
                cx={RING_GEOMETRY.center}
                cy={RING_GEOMETRY.center}
                r={RING_GEOMETRY.radius}
                pathLength="100"
                fill="none"
                stroke={b.color ? `var(--chart-${b.color})` : "#b7c2b1"}
                strokeWidth={RING_GEOMETRY.strokeWidth}
                strokeDasharray={`${Math.max(fraction * RING_GEOMETRY.pathLength - Math.min(RING_SEGMENT.gapBase, fraction * RING_SEGMENT.gapScale), RING_SEGMENT.minimumLength)} ${RING_GEOMETRY.pathLength}`}
                strokeDashoffset={-offset * 100}
                transform={`rotate(${RING_GEOMETRY.rotation} ${RING_GEOMETRY.center} ${RING_GEOMETRY.center})`}
                className="ring-segment"
                strokeLinecap="round"
                onClick={() => onEdit?.(b.id)}
              >
                <title>{`${b.title} · ${durationLabel(b.minutes)}`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="ring-center">
          <span>
            {dateContext.isToday ? "오늘의 계획" : `${dateContext.name} 계획`}
          </span>
          <strong>
            {Math.floor(total / MINUTES_PER_HOUR) > 0 && (
              <>
                {Math.floor(total / MINUTES_PER_HOUR)}
                <span>시간</span>{" "}
              </>
            )}
            {total % MINUTES_PER_HOUR > 0 || total === 0 ? (
              <>
                {total % MINUTES_PER_HOUR}
                <span>분</span>
              </>
            ) : null}
          </strong>
          <small>{plan.blocks.length}개의 작은 블록</small>
        </div>
      </div>
    </div>
  );
}

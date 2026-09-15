import { ArrowUpRight } from "lucide-react";
import { COLORS, CATEGORIES, planSummary, type Plan } from "@/lib/plan";
import { durationLabel, timeLabel } from "@/lib/plan-schedule";
import { Ring } from "./ring";
import { plannerDateContext } from "../planner-date";
export function Overview({
  plan,
  date,
  loading = false,
  unavailable = false,
}: {
  plan: Plan;
  date: string;
  loading?: boolean;
  unavailable?: boolean;
}) {
  const dateContext = plannerDateContext(date);
  const heading = (
    <h2 id="overview-heading" className="section-label">
      차곡차곡, 나의 하루 <ArrowUpRight size={18} />
    </h2>
  );
  if (loading || unavailable)
    return (
      <section
        className="overview"
        aria-busy={loading}
        aria-labelledby="overview-heading"
      >
        {heading}
        <div className="overview-loading" role="status">
          {loading
            ? "계획 요약을 불러오는 중..."
            : "이 날짜의 계획을 표시할 수 없어요."}
        </div>
      </section>
    );
  const { total, complete, byColor } = planSummary(plan);
  return (
    <section className="overview" aria-labelledby="overview-heading">
      {heading}
      <Ring plan={plan} date={date} />
      <div className="legend">
        {COLORS.map((color) => {
          const minutes = byColor[color];
          if (!minutes) return null;
          return (
            <div key={color}>
              <span className={`dot ${color}`} />
              <span>{CATEGORIES[color]}</span>
              <b>{durationLabel(minutes)}</b>
            </div>
          );
        })}
      </div>
      {plan.start !== null && (
        <div className="summary-foot">
          <span>계획한 시간</span>
          <b>
            {timeLabel(plan.start)} — {timeLabel(plan.start + total)}
          </b>
        </div>
      )}
      <div className="completion-text">
        <span>
          {complete === plan.blocks.length && complete > 0
            ? `${dateContext.name}의 블록을 모두 채웠어요.`
            : "하나씩, 나의 속도로"}
        </span>
        <b>
          {complete} / {plan.blocks.length}
        </b>
      </div>
      <div className="note">
        <span>조금 느슨해도 괜찮아요.</span>
        <p>
          하루의 모양은 언제든
          <br />
          다시 만들 수 있으니까.
        </p>
      </div>
    </section>
  );
}

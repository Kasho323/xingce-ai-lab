import type { Lesson } from "@/core/types";
import styles from "./PracticeApp.module.css";
const n = (v: number) =>
  Number(v.toFixed(3)).toLocaleString("zh-CN", { maximumFractionDigits: 3 });
/** Data is explicit per question; no inference from prose or fallback invented diagrams. */
export function ReasoningVisual({
  lesson,
  step,
}: {
  lesson: Lesson;
  step: number;
}) {
  const v = lesson.illustration;
  if (!v || step === 0) return null;
  if (v.type === "implication")
    return (
      <div className={styles.modelVisual} aria-label="条件关系图">
        <small>条件关系 · 箭头表示可以推出</small>
        {v.edges
          .slice(
            0,
            step === lesson.steps.length - 1
              ? v.edges.length
              : Math.min(step, v.edges.length),
          )
          .map((e, i) => (
            <div key={i} className={styles.logicalEdge}>
              <span>{e.from}</span>
              <div>
                <small>{e.reason}</small>
                <b>↓</b>
              </div>
              <span>{e.to}</span>
            </div>
          ))}
        {step === lesson.steps.length - 1 && <p>{v.conclusion}</p>}
      </div>
    );
  if (v.type === "parts") {
    const one = v.gap / (v.secondParts - v.firstParts);
    return (
      <div className={styles.modelVisual} aria-label="数量份数线段图">
        <small>相同大小的格子表示相等的数量</small>
        {[
          [v.first, v.firstParts],
          [v.second, v.secondParts],
        ].map(([label, parts]) => (
          <div key={label} className={styles.partsRow}>
            <span>{label}</span>
            <div>
              {Array.from({ length: Number(parts) }, (_, i) => (
                <b key={i}>{step === lesson.steps.length - 1 ? n(one) : "x"}</b>
              ))}
            </div>
            {step === lesson.steps.length - 1 && <em>+ {v.removed}</em>}
          </div>
        ))}
        <p>
          相差 {v.secondParts - v.firstParts} 份 = {v.gap} {v.unit}
          <br />
          每份 = {v.gap} ÷ {v.secondParts - v.firstParts} = {n(one)} {v.unit}
        </p>
        {step === lesson.steps.length - 1 && (
          <p>
            各加回 {v.removed} {v.unit} → 原来分别为{" "}
            {n(v.firstParts * one + v.removed)}、
            {n(v.secondParts * one + v.removed)} {v.unit}
          </p>
        )}
      </div>
    );
  }
  const rows =
    v.type === "growth"
      ? [
          { label: v.baseLabel, value: v.base },
          { label: v.currentLabel, value: v.current },
        ]
      : [
          { label: v.first + " / 天", value: v.a },
          { label: v.second + " / 天", value: v.b },
        ];
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <div
      className={styles.modelVisual}
      aria-label={v.type === "growth" ? "基期现期与变化量图" : "每天工作效率图"}
    >
      <small>
        {v.type === "growth"
          ? "先比较数量，再以基期为分母"
          : "合作同一段时间，每天完成量相加"}{" "}
        · 单位：{v.unit}
      </small>
      <svg
        viewBox="0 0 460 150"
        role="img"
        aria-label={rows.map((r) => `${r.label} ${n(r.value)}`).join("；")}
      >
        {rows.map((r, i) => (
          <g key={r.label}>
            <text x="0" y={42 + i * 65} fontSize="12" fill="#5d7165">
              {r.label}
            </text>
            <rect
              x="100"
              y={20 + i * 65}
              width={(270 * r.value) / max}
              height="35"
              rx="4"
              fill={i === 0 ? "#bccfc0" : "#4d8064"}
            />
            <text
              x={110 + (270 * r.value) / max}
              y={42 + i * 65}
              fontSize="13"
              fill="#294f38"
            >
              {n(r.value)}
            </text>
          </g>
        ))}
      </svg>
      {v.type === "growth" ? (
        <>
          <p>
            变化量 = 现期 − 基期
            <br />
            {n(v.current)} − {n(v.base)} = {n(v.current - v.base)} {v.unit}
          </p>
          {step === lesson.steps.length - 1 && (
            <p>
              增长率 = 变化量 ÷ 基期
              <br />
              {n(v.current - v.base)} ÷ {n(v.base)} ≈{" "}
              {n((v.current / v.base - 1) * 100)}%
            </p>
          )}
        </>
      ) : (
        <>
          <p>
            一天合作完成 {n(v.a)} + {n(v.b)} = {n(v.a + v.b)} {v.unit}
          </p>
          {step === lesson.steps.length - 1 && (
            <p>
              {n(v.days)} 天完成 ({n(v.a)} + {n(v.b)}) × {n(v.days)} ={" "}
              {n((v.a + v.b) * v.days)} {v.unit}
            </p>
          )}
        </>
      )}
    </div>
  );
}

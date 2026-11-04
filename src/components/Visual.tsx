"use client";
import katex from "katex";
import type { Lesson } from "@/core/types";
export function Formula({ value }: { value: string }) {
  return (
    <div
      className="formula"
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(value, {
          throwOnError: false,
          trust: false,
          strict: "warn",
        }),
      }}
    />
  );
}
export function Visual({ lesson, step }: { lesson: Lesson; step: number }) {
  const d = lesson.data;
  if (lesson.kind === "growth")
    return (
      <svg viewBox="0 0 520 290" role="img" aria-label="基期量和现期量条形对比">
        <text x="28" y="30" className="svg-title">
          现期 = 基期 + 增长量
        </text>
        <text x="28" y="90">
          上年
        </text>
        <rect x="95" y="65" width="280" height="44" rx="6" fill="#b8c9ee" />
        <text x="200" y="93">
          {d.base} 万册
        </text>
        <text x="28" y="160">
          本年
        </text>
        <rect x="95" y="135" width="280" height="44" rx="6" fill="#486cba" />
        <text x="200" y="163" fill="white">
          {d.base} 万册
        </text>
        {step >= 1 && (
          <>
            <rect
              x="375"
              y="135"
              width="70"
              height="44"
              rx="6"
              fill="#d5a95c"
            />
            <text x="392" y="163">
              {d.current - d.base}
            </text>
            <path d="M375 192 v10 h70 v-10" fill="none" stroke="#af8140" />
            <text x="345" y="232">
              新增 {d.current - d.base} 万册
            </text>
          </>
        )}
        {step >= 2 && (
          <text x="95" y="270" fill="#345da5">
            以蓝色基期为 100%，新增部分占 {d.rate * 100}%
          </text>
        )}
      </svg>
    );
  if (lesson.kind === "work")
    return (
      <svg viewBox="0 0 520 290" role="img" aria-label="工程六等份效率图">
        <text x="28" y="30" className="svg-title">
          将总工程分成 6 份
        </text>
        {Array.from({ length: 6 }, (_, i) => (
          <g key={i}>
            <rect
              x={30 + i * 78}
              y="70"
              width="68"
              height="66"
              rx="7"
              fill={
                step >= 2
                  ? i < 1
                    ? "#486cba"
                    : i < 3
                      ? "#82b6a1"
                      : "#edf0f5"
                  : "#edf0f5"
              }
            />
            <text
              x={59 + i * 78}
              y="110"
              fill={step >= 2 && i < 3 ? "white" : "#617086"}
            >
              {i + 1}
            </text>
          </g>
        ))}
        <text x="30" y="176">
          甲每天 1 份 {step >= 1 ? "（1/6）" : ""}
        </text>
        <text x="270" y="176">
          乙每天 2 份 {step >= 1 ? "（1/3）" : ""}
        </text>
        {step >= 2 && (
          <text x="30" y="220" fill="#345da5">
            合作每天完成 3 份，即总工程的一半
          </text>
        )}
        {step >= 3 && (
          <text x="30" y="260" className="svg-title">
            6 份 ÷ 每天 3 份 = 2 天
          </text>
        )}
      </svg>
    );
  if (lesson.kind === "logic")
    return (
      <svg
        viewBox="0 0 520 310"
        role="img"
        aria-label="集训、练习、竞赛集合关系"
      >
        <text x="24" y="30" className="svg-title">
          包含关系与存在关系
        </text>
        <ellipse
          cx="213"
          cy="160"
          rx="155"
          ry="105"
          fill="#ecf1fc"
          stroke="#708fce"
        />
        <text x="115" y="88">
          完成练习 P
        </text>
        {step >= 1 && (
          <>
            <ellipse
              cx="150"
              cy="172"
              rx="70"
              ry="51"
              fill="#c6d6f5"
              stroke="#486cba"
            />
            <text x="112" y="178">
              集训 T
            </text>
          </>
        )}
        {step >= 2 && (
          <>
            <ellipse
              cx="363"
              cy="164"
              rx="112"
              ry="85"
              fill="#86b9a133"
              stroke="#65a68a"
              strokeDasharray="6 4"
            />
            <text x="372" y="146">
              竞赛 C
            </text>
            <circle cx="304" cy="166" r="6" fill="#b48536" />
            <text x="270" y="201">
              至少一人
            </text>
          </>
        )}
        <text x="35" y="298" fontSize="13">
          示意图只表达已知关系，不规定集合人数或实际面积。
        </text>
      </svg>
    );
  return (
    <div className="text-visual">
      这道题采用经审核的文字步骤。专用图示尚未确认。
    </div>
  );
}

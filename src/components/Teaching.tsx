"use client";
import { useState, useEffect } from "react";
import type { QuestionView } from "@/core/types";
import { statuses } from "@/core/types";
import { validateLesson } from "@/core/quality";
import { Visual, Formula } from "./Visual";
export async function post(action: string, body: unknown) {
  const r = await fetch("/api/" + action, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(data.error ?? data.errors?.join("；") ?? "操作失败");
  return data;
}
export function Teaching({
  q,
  onRefresh,
  notify,
}: {
  q: QuestionView;
  onRefresh: () => void;
  notify: (v: string) => void;
}) {
  const [step, setStep] = useState(0),
    [tab, setTab] = useState("基础解法"),
    [choice, setChoice] = useState(""),
    [result, setResult] = useState<{ correct: boolean | null } | null>(null),
    [hint, setHint] = useState(false),
    [full, setFull] = useState(false),
    [started, setStarted] = useState(Date.now()),
    [reason, setReason] = useState("读题错误"),
    [pending, setPending] = useState(false),
    [editor, setEditor] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    setStep(0);
    setChoice("");
    setResult(null);
    setHint(false);
    setFull(false);
    setStarted(Date.now());
    setConfirmed(false);
  }, [q.id]);
  useEffect(() => {
    setEditor(
      JSON.stringify(
        q.lesson ?? {
          kind: "text",
          answer: q.answer ?? "A",
          steps: [
            {
              title: "读题与条件提取",
              explanation: "",
              hint: "",
              highlights: [],
            },
            {
              title: "建立模型并检验",
              explanation: "",
              hint: "",
              highlights: [],
            },
          ],
          fast: "暂无经过论证的快速方法。",
          examiner: "基于题目结构的教学推断：待填写。",
          distractors: [],
          transfer: "待填写迁移思路；不得冒充真题。",
          data: {},
          claims: [],
        },
        null,
        2,
      ),
    );
    setConfirmed(false);
  }, [q.lesson]);
  const lesson = q.lesson;
  const check = lesson ? validateLesson(lesson, q.answer) : null;
  const approved =
    lesson &&
    ["APPROVED", "SOURCE_ADAPTED"].includes(q.quality) &&
    check?.errors.length === 0;
  async function submit() {
    try {
      setPending(true);
      const r = await post("attempt", {
        questionId: q.id,
        selected: choice,
        elapsed: Math.min(86400, Math.round((Date.now() - started) / 1000)),
        reason,
      });
      setResult(r);
      onRefresh();
    } catch (e) {
      notify(String(e));
    } finally {
      setPending(false);
    }
  }
  async function ai() {
    try {
      setPending(true);
      const r = await post("ai", { id: q.id });
      notify(
        r.errors.length ? r.errors.join("；") : "AI 草稿已生成，请审核后发布",
      );
      onRefresh();
    } catch (e) {
      notify(String(e));
    } finally {
      setPending(false);
    }
  }
  function highlight(text: string) {
    const words = approved ? lesson.steps[step].highlights : [];
    if (!words.length) return text;
    const escaped = words
      .filter(Boolean)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!escaped.length) return text;
    return text
      .split(new RegExp("(" + escaped.join("|") + ")", "g"))
      .map((s, i) => (words.includes(s) ? <mark key={i}>{s}</mark> : s));
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LEARNING WORKSPACE / 学习工作台</div>
          <h1>让每一步推理，看得见。</h1>
          <p>先理解条件，再建立模型，最后把方法带到下一道题。</p>
        </div>
        <span className="status">{statuses[q.status]}</span>
      </div>
      <div className="teaching-grid">
        <section className="panel question-panel">
          <div className="panel-label">
            01 / 原题与条件 <span>{q.module}</span>
          </div>
          <h2>{q.knowledge}</h2>
          <div className="question-meta">
            {q.source.exam} · 第 {q.number} 题
          </div>
          {q.material && <pre className="material">{q.material}</pre>}
          <p className="stem">{highlight(q.stem)}</p>
          <div className="options">
            {q.options.map((o) => (
              <button
                key={o.key}
                className={"option " + (choice === o.key ? "selected" : "")}
                onClick={() => setChoice(o.key)}
              >
                <b>{o.key}</b>
                <span>{o.text}</span>
              </button>
            ))}
          </div>
          <label className="field">
            本次易错点 / 错误原因
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {[
                "读题错误",
                "公式理解错误",
                "计算错误",
                "知识点不熟悉",
                "逻辑错误",
                "时间不足",
                "独立完成",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <button
            className="primary wide"
            disabled={!choice || pending}
            onClick={submit}
          >
            提交答案并记录
          </button>
          {result && (
            <div className={"feedback " + (result.correct ? "success" : "")}>
              {result.correct === null
                ? "答案待核验，本次只记录选择，不判定对错。"
                : result.correct
                  ? "回答正确。试着解释每一步为什么成立。"
                  : `本次选择 ${choice}；当前参考答案 ${q.answer}。请回到条件寻找差异。`}
            </div>
          )}
          <details className="source">
            <summary>来源、答案依据与修订历史</summary>
            <p>{q.source.name}</p>
            <p>
              考试：{q.source.exam || "未填写"} ·{" "}
              {q.source.year || "年份未填写"} ·{" "}
              {q.source.region || "机构未填写"}
            </p>
            <p>
              原件第 {q.page}—{q.endPage} 页 / 第 {q.number} 题
            </p>
            <p>
              答案：{q.answer || "待核验"}；依据：{q.evidence || "未提供"}
            </p>
            <p>{q.source.rights}</p>
            {q.source.url && (
              <a href={q.source.url} target="_blank" rel="noreferrer">
                核查来源链接 ↗
              </a>
            )}
            {q.source.filename && (
              <a
                href={`/api/file/${q.sourceId}#page=${q.page}`}
                target="_blank"
                rel="noreferrer"
              >
                打开原件 ↗
              </a>
            )}
            <button
              className="link"
              onClick={async () => {
                const data = await (
                  await fetch("/api/revisions/" + q.id)
                ).json();
                notify(
                  data.length
                    ? data
                        .map(
                          (x: { createdAt: string; reason: string }) =>
                            x.createdAt + " " + x.reason,
                        )
                        .join("\n")
                    : "原创种子题，无后续修订",
                );
              }}
            >
              查看审核历史
            </button>
          </details>
        </section>
        <section className="panel visual-panel">
          <div className="panel-label">
            02 / 可视化推演 <span>理解 → 建模 → 检验</span>
          </div>
          <div className="tabs">
            {["基础解法", "快速解法", "命题视角"].map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {approved ? (
            <>
              {tab === "基础解法" ? (
                <>
                  <div className="step-header">
                    <span className="step-count">
                      {String(step + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <small>
                        STEP {step + 1} / {lesson.steps.length}
                      </small>
                      <h2>{lesson.steps[step].title}</h2>
                    </div>
                  </div>
                  <div className="visual-canvas">
                    <Visual lesson={lesson} step={step} />
                  </div>
                  {lesson.steps[step].formula && (
                    <Formula value={lesson.steps[step].formula!} />
                  )}
                  <div className="progress">
                    {lesson.steps.map((_, i) => (
                      <button
                        aria-label={"第 " + (i + 1) + " 步"}
                        key={i}
                        className={i <= step ? "done" : ""}
                        onClick={() => {
                          setStep(i);
                          setHint(false);
                        }}
                      />
                    ))}
                  </div>
                  <div className="controls">
                    <button
                      disabled={step === 0}
                      onClick={() => {
                        setStep(step - 1);
                        setHint(false);
                      }}
                    >
                      ← 上一步
                    </button>
                    <button onClick={() => setHint(!hint)}>显示提示</button>
                    <button
                      className="primary"
                      disabled={step === lesson.steps.length - 1}
                      onClick={() => {
                        setStep(step + 1);
                        setHint(false);
                      }}
                    >
                      下一步 →
                    </button>
                  </div>
                  <div className="minor-controls">
                    <button className="link" onClick={() => setFull(!full)}>
                      查看完整解析
                    </button>
                    <button
                      className="link"
                      onClick={() => {
                        setStep(0);
                        setHint(false);
                        setFull(false);
                      }}
                    >
                      ↻ 重新演示
                    </button>
                  </div>
                  {hint && (
                    <div className="hint">{lesson.steps[step].hint}</div>
                  )}
                  {full &&
                    lesson.steps.map((s, i) => (
                      <div className="full-step" key={i}>
                        <b>
                          {i + 1}. {s.title}
                        </b>
                        <p>{s.explanation}</p>
                        {s.formula && <Formula value={s.formula} />}
                      </div>
                    ))}
                </>
              ) : tab === "快速解法" ? (
                <article className="article">
                  <span className="pill">理解原理后使用</span>
                  <h2>考场快速解法</h2>
                  <p>{lesson.fast}</p>
                  <div className="hint">
                    先判断适用条件，再使用技巧。方法不能替代读题。
                  </div>
                </article>
              ) : (
                <article className="article">
                  <span className="pill">基于题目结构的教学推断</span>
                  <h2>命题人视角</h2>
                  <p>{lesson.examiner}</p>
                  {lesson.distractors.map((d, i) => (
                    <p className="distractor" key={i}>
                      {d}
                    </p>
                  ))}
                  <h3>举一反三 · 模拟训练</h3>
                  <p>{lesson.transfer}</p>
                  <small>尚未导入可核验同考点真题时，不编造关联真题。</small>
                </article>
              )}
            </>
          ) : (
            <div className="empty">
              <h2>
                {q.quality === "BLOCKED" ? "解析已拦截" : "教学解析待审核"}
              </h2>
              <p>
                {check?.errors.join("；") ||
                  "此题尚无人工确认的教学步骤。请先核对参考解析与原件。"}
              </p>
              <p>{q.reference || "没有参考解析时，请勿猜测答案。"}</p>
              <button disabled={pending} className="primary" onClick={ai}>
                显式发送本题给 AI，生成待审草稿
              </button>
              <small>
                仅发送本题文本、材料、选项和参考解析；不发送原始文件。
              </small>
            </div>
          )}
          {!approved && (
            <details className="lesson-review">
              <summary>人工编辑并核验 AI 教学草稿</summary>
              <textarea
                rows={18}
                value={editor}
                onChange={(e) => setEditor(e.target.value)}
              />
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{" "}
                我已核对全部推导、公式适用条件、图文一致性及答案证据
              </label>
              <button
                disabled={!confirmed || pending}
                onClick={async () => {
                  try {
                    await post("lesson-review", {
                      id: q.id,
                      lesson: JSON.parse(editor),
                      confirmed,
                    });
                    notify("教学解析已审核发布");
                    onRefresh();
                  } catch (e) {
                    notify(String(e));
                  }
                }}
              >
                校验并发布解析
              </button>
            </details>
          )}
        </section>
        <aside className="teacher-column">
          <section className="panel teacher">
            <div className="panel-label">03 / 老师讲解</div>
            <div className="teacher-avatar">思</div>
            <span className="pill">从原理出发</span>
            <h2>{approved ? lesson.steps[step].title : "先核验，再学习"}</h2>
            <p>
              {approved
                ? lesson.steps[step].explanation
                : "资料导入不代表题目和答案已经正确。保留疑问，逐项与原件比对。"}
            </p>
            {approved && (
              <div className="teacher-tip">
                <b>停下来想一想</b>
                <p>{lesson.steps[step].hint}</p>
              </div>
            )}
          </section>
          <section className="panel principle">
            <h3>本题学习目标</h3>
            <p>能说明关系为什么成立，而不只记住结果。</p>
            <div className="quality-dot">
              {approved
                ? q.quality === "SOURCE_ADAPTED"
                  ? "资料解析整理 · 独立复核未完成"
                  : "教学步骤已复核"
                : "人工核验队列"}
            </div>
            <small>
              程序只检查结构、答案冲突与登记的计算；不能自动证明全部语言推理。
            </small>
          </section>
        </aside>
      </div>
    </>
  );
}

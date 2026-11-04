"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Check,
  BookOpen,
} from "lucide-react";
import type { QuestionView } from "@/core/types";
import type { StudyCatalog } from "@/core/cdb";
import {
  dueReviews,
  examProfile,
  shanghaiDate,
  dayDistance,
  syllabus,
  policyReading,
  type WritingExercise,
} from "@/core/guokao";
import styles from "./PracticeApp.module.css";

type Progress = Record<
  string,
  { done?: boolean; answer?: string; notes?: string }
>;
async function persist(key: string, value: Progress[string]) {
  const r = await fetch("/api/study/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "保存失败");
}
export function Today({
  catalog,
  bank,
  onStart,
  onWriting,
  onTopic,
}: {
  catalog: StudyCatalog | null;
  bank: QuestionView[];
  onStart: (ids: string[]) => void;
  onWriting: (id: string) => void;
  onTopic: (module: string, topic: string) => void;
}) {
  const [today, setToday] = useState("");
  const [date, setDate] = useState("");
  const [state, setState] = useState<Progress>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => {
    const update = () => setToday(shanghaiDate());
    update();
    const t = setInterval(update, 30000);
    fetch("/api/study/state")
      .then((r) => {
        if (!r.ok) throw Error("进度读取失败");
        return r.json();
      })
      .then(setState)
      .catch((e) => setError(e.message));
    return () => clearInterval(t);
  }, []);
  const plan = catalog?.dailyPlan ?? [];
  const selected =
    date ||
    (today < examProfile.startDate
      ? examProfile.startDate
      : today > "2026-11-28"
        ? "2026-11-28"
        : today);
  const day = plan.find((d) => d.date === selected);
  const index = plan.findIndex((d) => d.date === selected);
  const review = dueReviews(bank, selected);
  const minutes =
    day?.tasks.reduce(
      (s, t) => s + (state["task:" + t.id]?.done ? t.minutes : 0),
      0,
    ) ?? 0;
  async function toggle(id: string) {
    setBusy(id);
    setError("");
    try {
      const value = {
        ...state["task:" + id],
        done: !state["task:" + id]?.done,
      };
      await persist("task:" + id, value);
      setState((s) => ({ ...s, ["task:" + id]: value }));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <main className={styles.home}>
      <section className={styles.intro}>
        <div>
          <span className={styles.eyebrow}>DAILY STUDY · CITY LEVEL</span>
          <h1>今天，学会再往前走。</h1>
          <p>2027 年度国考 · 地市级　11 月 29 日考试　每天 4 小时</p>
        </div>
        <div className={styles.totals}>
          <strong>
            {today
              ? Math.max(0, dayDistance(today, examProfile.examDate))
              : "—"}
          </strong>
          <span>天后考试</span>
        </div>
      </section>
      {today && today >= examProfile.examDate && (
        <p className={styles.statsNote}>
          备考计划已到考试日。下方保留历史任务与记录，不再生成考后备考任务。
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <section className={styles.listPanel}>
        <div className={styles.listTitle}>
          <div>
            <button
              aria-label="前一天"
              disabled={index <= 0}
              onClick={() => setDate(plan[index - 1].date)}
            >
              <ChevronLeft size={16} />
            </button>
            <input
              aria-label="计划日期"
              type="date"
              min={examProfile.startDate}
              max="2026-11-28"
              value={selected}
              onChange={(e) => {
                if (plan.some((d) => d.date === e.target.value))
                  setDate(e.target.value);
              }}
            />
            <button
              aria-label="后一天"
              disabled={index < 0 || index === plan.length - 1}
              onClick={() => setDate(plan[index + 1].date)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <span>自评完成 {minutes} / 240 分钟</span>
        </div>
        {day ? (
          <>
            <h2 className={styles.dayTitle}>{day.title}</h2>
            <div className={styles.dayTasks}>
              {day.tasks.map((t, i) => {
                const qs = t.questionIds
                  .map((id) => bank.find((q) => q.id === id))
                  .filter((q): q is QuestionView => !!q);
                const attempted = qs.filter((q) => q.attempts?.length).length;
                const due = t.kind === "review" ? review : [];
                return (
                  <article className={styles.dayTask} key={t.id}>
                    <button
                      className={styles.taskCheck}
                      aria-label={`${state["task:" + t.id]?.done ? "取消完成" : "完成"} ${t.title}`}
                      aria-pressed={!!state["task:" + t.id]?.done}
                      disabled={!!busy}
                      onClick={() => toggle(t.id)}
                    >
                      {state["task:" + t.id]?.done ? (
                        <Check size={18} />
                      ) : (
                        i + 1
                      )}
                    </button>
                    <div>
                      <h3>
                        {t.title}
                        <small>{t.minutes} 分钟</small>
                      </h3>
                      <p>{t.action}</p>
                      <small>完成标准：{t.check}</small>
                      {t.id.endsWith("-foundation") && (
                        <p>
                          在本时段留 5 分钟读{" "}
                          <a
                            href={policyReading.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {policyReading.title}原文
                          </a>
                          ：
                          {
                            policyReading.focuses[
                              Math.max(0, index) % policyReading.focuses.length
                            ]
                          }
                        </p>
                      )}
                      <div className={styles.taskActions}>
                        {t.kind === "practice" && (
                          <>
                            <button
                              className={styles.primary}
                              disabled={!qs.length}
                              onClick={() => onStart(qs.map((q) => q.id))}
                            >
                              开始 {qs.length} 题 <ArrowRight size={15} />
                            </button>
                            <small>
                              已练 {attempted}/{qs.length}
                            </small>
                          </>
                        )}
                        {t.kind === "review" && (
                          <>
                            <button
                              disabled={!due.length}
                              onClick={() => onStart(due.map((q) => q.id))}
                            >
                              到期错题 {due.length} 道
                            </button>
                            {!due.length && (
                              <small>
                                暂无到期错题，回顾今天的错误或超时题。
                              </small>
                            )}
                          </>
                        )}
                        {t.writingId && (
                          <button
                            className={styles.primary}
                            onClick={() => onWriting(t.writingId!)}
                          >
                            打开申论原题 <ArrowRight size={15} />
                          </button>
                        )}
                        {t.topics?.map((topic) => {
                          const m = Object.entries(syllabus).find(
                            ([, v]) => topic in v,
                          )?.[0];
                          return m ? (
                            <button
                              key={topic}
                              className={styles.quiet}
                              onClick={() => onTopic(m, topic)}
                            >
                              {topic}
                            </button>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <p className={styles.empty}>计划尚未载入。</p>
        )}
      </section>
      <p className={styles.footnote}>
        任务安排固定保留，可查看补做；错题按最近作答进入 1 / 3 / 7
        天间隔复习。勾选是自评完成，正确率与用时按真实提交记录计算。最后一天可按体力减量，不要求硬撑题量。
      </p>
      <details className={styles.planOverview}>
        <summary>查看 26 天安排与题库说明</summary>
        <div className={styles.planDays}>
          {plan.map((d) => (
            <button key={d.date} onClick={() => setDate(d.date)}>
              {d.date.slice(5)} · {d.title}
            </button>
          ))}
        </div>
        <p>{catalog?.coverageNote}</p>
        <p>
          <a href={examProfile.announcement} target="_blank" rel="noreferrer">
            招考公告
          </a>{" "}
          ·{" "}
          <a href={examProfile.outline} target="_blank" rel="noreferrer">
            公共科目大纲转载
          </a>
          。专项顺序为教学安排，不是对未来命题的预测。
        </p>
      </details>
    </main>
  );
}

export function KnowledgeCoverage({
  bank,
  onTopic,
}: {
  bank: QuestionView[];
  onTopic: (module: string, topic: string) => void;
}) {
  return (
    <main className={styles.home}>
      <section className={styles.intro}>
        <div>
          <span className={styles.eyebrow}>KNOWLEDGE & TRANSFER</span>
          <h1>知道还缺什么，才好补什么。</h1>
          <p>覆盖主要模块与方法；已配题和仍需补充的考点分别标明。</p>
        </div>
      </section>
      <div className={styles.knowledgeList}>
        {Object.entries(syllabus).map(([m, topics]) => (
          <details key={m}>
            <summary>
              {m}
              <small>{Object.keys(topics).length} 个复习主题</small>
            </summary>
            {Object.entries(topics).map(([topic, guide]) => {
              const qs = bank.filter(
                (q) => q.module === m && q.knowledge === topic,
              );
              return (
                <article key={topic}>
                  <div>
                    <h3>{topic}</h3>
                    <p>{guide}</p>
                    {topic === "近期政策与时政" && (
                      <p>
                        <a
                          href={policyReading.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {policyReading.title} · 官方原文
                        </a>
                        （2026-11-03 核对；这是补充阅读，不代表完整时政范围。）
                      </p>
                    )}
                  </div>
                  {m !== "申论" && (
                    <button
                      onClick={() => onTopic(m, topic)}
                      disabled={!qs.length}
                    >
                      {qs.length ? `${qs.length} 道来源题` : "暂无直接配题"}
                    </button>
                  )}
                </article>
              );
            })}
          </details>
        ))}
      </div>
      <p className={styles.footnote}>
        归类是教学整理，可能交叉；“暂无直接配题”不会用模拟题补成真题。近期政策需按正式文件持续更新，历史题不能穷尽未来考点。
      </p>
    </main>
  );
}

export function WritingDesk({
  catalog,
  initialId,
}: {
  catalog: StudyCatalog | null;
  initialId: string;
}) {
  const list = catalog?.writing ?? [];
  const [id, setId] = useState(initialId || list[0]?.id || "");
  const q = list.find((q) => q.id === id) ?? list[0];
  return (
    <main className={styles.home}>
      <section className={styles.intro}>
        <div>
          <span className={styles.eyebrow}>READ · WRITE · REVISE</span>
          <h1>先把答案写出来。</h1>
          <p>地市级申论原材料与作答要求，保存草稿后再按材料复盘。</p>
        </div>
        <select
          aria-label="选择申论题"
          value={q?.id ?? ""}
          onChange={(e) => setId(e.target.value)}
        >
          {list.map((w) => (
            <option key={w.id} value={w.id}>
              {w.year} 年 · 第 {w.number} 题 · {w.topic}
            </option>
          ))}
        </select>
      </section>
      {q ? <WritingQuestion key={q.id} q={q} /> : <p>暂无完整申论材料。</p>}
    </main>
  );
}
function WritingQuestion({ q }: { q: WritingExercise }) {
  const [answer, setAnswer] = useState(""),
    [notes, setNotes] = useState(""),
    [saved, setSaved] = useState(""),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/study/state")
      .then((r) => {
        if (!r.ok) throw Error("草稿读取失败");
        return r.json();
      })
      .then((s) => {
        if (live) {
          setAnswer(s["writing:" + q.id]?.answer ?? "");
          setNotes(s["writing:" + q.id]?.notes ?? "");
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [q.id]);
  async function save() {
    setBusy(true);
    setError("");
    try {
      await persist("writing:" + q.id, { answer, notes });
      setSaved("草稿与复盘已保存到本地");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const count = Array.from(answer.replace(/\s/g, "")).length;
  return (
    <div className={styles.writingGrid}>
      <section className={styles.listPanel}>
        <div className={styles.writingBody}>
          <h2>
            {q.year} 地市级 · 第 {q.number} 题
          </h2>
          <p className={styles.longText}>{q.prompt}</p>
          <details className={styles.writingMaterial}>
            <summary>展开给定资料（完整公开文本）</summary>
            <p className={styles.longText}>{q.material}</p>
          </details>
          <a href={q.sourceUrl} target="_blank" rel="noreferrer">
            查看题目来源
          </a>
          <p className={styles.footnote}>
            公开整理/回忆版；参考方法为教学指导，不冒充官方评分答案。
          </p>
        </div>
      </section>
      <section className={styles.listPanel}>
        <div className={styles.writingBody}>
          <h2>我的作答</h2>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <textarea
            aria-label="申论作答"
            disabled={!loaded}
            value={answer}
            maxLength={20000}
            onChange={(e) => {
              setAnswer(e.target.value);
              setSaved("有修改尚未保存");
            }}
            placeholder="先独立写作，点击保存后再离开此页。"
          />
          <p className={count > q.maxChars ? styles.error : styles.statsNote}>
            {count} 字符（含标点，不含空白） · 要求{" "}
            {q.minChars ? `${q.minChars}–` : "不超过 "}
            {q.maxChars} 字
          </p>
          <button
            className={styles.primary}
            disabled={!loaded || busy}
            onClick={save}
          >
            {busy ? "保存中…" : "保存草稿与复盘"}
          </button>
          <span role="status"> {saved}</span>
          <details className={styles.writingMaterial}>
            <summary>作答后查看：拆解与检查</summary>
            <ol>
              {q.guide.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ol>
            {q.evidence && (
              <>
                <h3>材料怎样转成要点（教学示例）</h3>
                {q.evidence.map((e, i) => (
                  <p key={i}>
                    <b>材料线索：{e.quote}</b>
                    <br />
                    {e.point}
                  </p>
                ))}
              </>
            )}
            <p>
              每一条答案要点都写出材料依据；没有依据的漂亮句子不自动算得分点。修改稿应解决漏点、重复和表达不清的问题。
            </p>
          </details>
          <label>
            本题复盘
            <textarea
              aria-label="申论复盘"
              value={notes}
              maxLength={20000}
              onChange={(e) => {
                setNotes(e.target.value);
                setSaved("有修改尚未保存");
              }}
              placeholder="漏了哪条材料？哪句话可以更准确？下一稿怎么改？"
            />
          </label>
        </div>
      </section>
    </div>
  );
}

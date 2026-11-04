"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Search,
  X,
} from "lucide-react";
import type { QuestionView } from "@/core/types";
import type { StudyCatalog } from "@/core/cdb";
import { validateLesson } from "@/core/quality";
import {
  moduleAccuracy,
  newestAttempts,
  formatDuration,
} from "@/core/study-stats";
import { post } from "./Teaching";
import { Lab } from "./Lab";
import { Today, KnowledgeCoverage, WritingDesk } from "./GuokaoWorkspace";
import { SourceText } from "./SourceText";
import { transferQuestions, questionText } from "@/core/guokao";
import { ReasoningVisual } from "./ReasoningVisual";
import styles from "./PracticeApp.module.css";

const moduleNames = [
  "言语理解",
  "数量关系",
  "判断推理",
  "资料分析",
  "政治理论",
  "常识判断",
];
const moduleLabels = [
  "读懂 · 表达",
  "关系 · 运算",
  "条件 · 推理",
  "数据 · 比较",
  "理论 · 政策",
  "常识 · 判断",
];
type Attempt = NonNullable<QuestionView["attempts"]>[number];
type Reader = { resourceId: string; page: number; title: string };
const wrong = (q: QuestionView) =>
  q.attempts?.some((a) => a.correct === false && !a.mastered);

export function PracticeApp() {
  const [questions, setQuestions] = useState<QuestionView[]>([]);
  const [catalog, setCatalog] = useState<StudyCatalog | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [tab, setTab] = useState("今日"),
    [module, setModule] = useState("全部");
  const [search, setSearch] = useState(""),
    [knowledge, setKnowledge] = useState("");
  const [year, setYear] = useState("");
  const [filter, setFilter] = useState("全部"),
    [page, setPage] = useState(0);
  const [sequence, setSequence] = useState<string[]>([]),
    [index, setIndex] = useState(0);
  const [reader, setReader] = useState<Reader | null>(null),
    [manage, setManage] = useState(false);
  const [resume, setResume] = useState("");
  const [writingId, setWritingId] = useState("");
  function startIds(ids: string[]) {
    setSequence(ids);
    setIndex(0);
    window.scrollTo(0, 0);
  }
  function topic(m: string, k: string) {
    setTab("题库");
    setYear("");
    setModule(m);
    setKnowledge(k);
    setFilter("全部");
    setPage(0);
    setSearch("");
    setSequence([]);
  }
  function openWriting(id: string) {
    setWritingId(id);
    setTab("申论");
    setSequence([]);
  }

  useEffect(() => {
    Promise.all([fetch("/api/questions"), fetch("/api/study/catalog")])
      .then(async ([q, c]) => {
        if (!q.ok || !c.ok)
          throw new Error("读取题库失败，请重新启动学习系统。");
        setQuestions(await q.json());
        setCatalog(await c.json());
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    try {
      setResume(localStorage.getItem("gk:last-question") ?? "");
    } catch {
      /* optional convenience */
    }
  }, []);
  const bank = useMemo(() => {
    const ids = new Set(catalog?.questionIds ?? []);
    return questions.filter((q) => ids.has(q.id));
  }, [questions, catalog]);
  const visible = bank.filter(
    (q) =>
      (!year || String(q.source.year) === year) &&
      (module === "全部" || q.module === module) &&
      (!knowledge || q.knowledge === knowledge) &&
      (tab !== "错题" || wrong(q)) &&
      (filter !== "未练" || !q.attempts?.length) &&
      (!search ||
        (q.stem + q.knowledge + q.id)
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const topics = [
    ...new Set(
      bank
        .filter((q) => module === "全部" || q.module === module)
        .map((q) => q.knowledge),
    ),
  ];
  const active = questions.find((q) => q.id === sequence[index]);
  const done = bank.filter((q) => q.attempts?.length).length;
  function chooseModule(m: string) {
    setModule(m);
    setKnowledge("");
    setPage(0);
  }
  function start(id?: string) {
    const ids = visible.map((q) => q.id);
    setSequence(id && !ids.includes(id) ? [id] : ids);
    setIndex(id ? Math.max(0, ids.indexOf(id)) : 0);
    window.scrollTo(0, 0);
  }
  function saveAttempt(qid: string, a: Attempt) {
    setQuestions((qs) =>
      qs.map((q) =>
        q.id === qid
          ? {
              ...q,
              attempts: [a, ...(q.attempts ?? []).filter((v) => v.id !== a.id)],
            }
          : q,
      ),
    );
  }
  function navigate(next: number) {
    setIndex(next);
    const id = sequence[next];
    setResume(id);
    try {
      localStorage.setItem("gk:last-question", id);
    } catch {
      /* optional */
    }
  }
  if (manage)
    return (
      <>
        <div className={styles.managementBar}>
          <button onClick={() => setManage(false)}>
            <ArrowLeft size={16} /> 返回国考学习
          </button>
          <span>资料导入、核验与系统设置</span>
        </div>
        <Lab />
      </>
    );
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <button className={styles.brand} onClick={() => setSequence([])}>
          <span className={styles.brandMark}>行</span>
          <span>
            国考 · 地市级<small>XINGCE AI LAB</small>
          </span>
        </button>
        <nav aria-label="主导航">
          {["今日", "题库", "错题", "知识", "申论", "笔记"].map((t) => (
            <button
              key={t}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => {
                setTab(t);
                setSequence([]);
                setPage(0);
              }}
            >
              {t}
            </button>
          ))}
        </nav>
        <button className={styles.quiet} onClick={() => setManage(true)}>
          资料与设置
        </button>
      </header>
      {error && (
        <div role="alert" className={styles.error}>
          {error}
        </div>
      )}
      {loading ? (
        <div className={styles.empty}>正在读取本地题库…</div>
      ) : active ? (
        <QuestionRoom
          key={active.id}
          q={active}
          bank={bank}
          onTransfer={startIds}
          catalog={catalog}
          index={index}
          total={sequence.length}
          onBack={() => setSequence([])}
          onMove={navigate}
          onAttempt={saveAttempt}
          onRead={setReader}
        />
      ) : tab === "今日" ? (
        <Today
          catalog={catalog}
          bank={bank}
          onStart={startIds}
          onWriting={openWriting}
          onTopic={topic}
        />
      ) : tab === "知识" ? (
        <KnowledgeCoverage bank={bank} onTopic={topic} />
      ) : tab === "申论" ? (
        <WritingDesk key={writingId} catalog={catalog} initialId={writingId} />
      ) : tab === "笔记" ? (
        <main className={styles.home}>
          <div className={styles.intro}>
            <div>
              <span className={styles.eyebrow}>KNOWLEDGE NOTES</span>
              <h1>用题目找到知识缺口</h1>
              <p>
                做题后的「知识笔记」会定位到对应章节。这里可以直接翻阅两份笔记。
              </p>
            </div>
          </div>
          <div className={styles.books}>
            {catalog?.resources
              .filter((r) => r.id.startsWith("notes-"))
              .map((r) => (
                <button
                  key={r.id}
                  onClick={() =>
                    setReader({ resourceId: r.id, page: 3, title: r.name })
                  }
                >
                  <BookOpen size={30} />
                  <h2>{r.name.replace(".pdf", "")}</h2>
                  <p>
                    {r.id === "notes-xingce"
                      ? "言语、数量、判断、资料分析 · 随题补基础"
                      : "概括、对策、应用文、综合分析、大作文 · 写作时查阅"}
                  </p>
                  <span>
                    {r.pages} 页 <ArrowRight size={16} />
                  </span>
                </button>
              ))}
          </div>
          <p className={styles.footnote}>
            匹配的是知识方法，不表示题目出自笔记。政治理论和常识没有直接章节时，会明确提示。
          </p>
        </main>
      ) : (
        <main className={styles.home}>
          <section className={styles.intro}>
            <div>
              <span className={styles.eyebrow}>
                {tab === "错题"
                  ? "REVIEW & UNDERSTAND"
                  : "PRACTICE & UNDERSTAND"}
              </span>
              <h1>
                {tab === "错题" ? "把错题重新做会" : "一次练习，弄懂一个考点"}
              </h1>
              <p>
                {tab === "错题"
                  ? "保留上次错误原因。独立重做后，再标记为已掌握。"
                  : "按模块练题，逐步推导，遇到不懂的地方直接翻笔记。"}
              </p>
            </div>
            <div className={styles.totals}>
              <strong>
                {tab === "错题" ? bank.filter(wrong).length : bank.length}
              </strong>
              <span>{tab === "错题" ? "待复习" : "道来源题"}</span>
              <small>
                已练 {done} / {bank.length}
              </small>
            </div>
          </section>
          <section className={styles.modules} aria-label="题目模块">
            {moduleNames.map((m, i) => {
              const group = bank.filter(
                (q) => q.module === m && (tab !== "错题" || wrong(q)),
              );
              const accuracy = moduleAccuracy(
                bank.filter((q) => q.module === m),
              );
              return (
                <button
                  key={m}
                  className={module === m ? styles.selectedModule : ""}
                  onClick={() => chooseModule(module === m ? "全部" : m)}
                  aria-pressed={module === m}
                >
                  <span>{m}</span>
                  <strong>
                    {group.length}
                    <small> 题</small>
                  </strong>
                  <small>{moduleLabels[i]}</small>
                  <span className={styles.accuracy} aria-label={`${m}正确率`}>
                    正确率{" "}
                    <b>
                      {accuracy.percent === null ? "—" : `${accuracy.percent}%`}
                    </b>
                    <small>
                      {accuracy.total
                        ? `答对 ${accuracy.correct} / ${accuracy.total} 次`
                        : "暂无判分记录"}
                    </small>
                  </span>
                  <div className={styles.moduleProgress}>
                    <i
                      style={{
                        width: `${group.length ? (100 * group.filter((q) => q.attempts?.length).length) / group.length : 0}%`,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </section>
          <p className={styles.statsNote}>
            正确率按来源参考答案累计统计，含重做；直接学习、无答案和冲突题不计入。来源答案不等同官方认证。
          </p>
          <section className={styles.listPanel}>
            <div className={styles.listTitle}>
              <div>
                <h2>{module === "全部" ? "全部模块" : module}</h2>
                <span>{visible.length} 题</span>
              </div>
              <div>
                {resume && bank.some((q) => q.id === resume) && (
                  <button
                    className={styles.quiet}
                    onClick={() => start(resume)}
                  >
                    继续上次
                  </button>
                )}
                <button
                  className={styles.primary}
                  disabled={!visible.length}
                  onClick={() => start()}
                >
                  开始练习 <ArrowRight size={16} />
                </button>
              </div>
            </div>
            <div className={styles.filters}>
              <select
                aria-label="试卷年份"
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">全部年份 · 地市级</option>
                {Array.from({ length: 10 }, (_, i) => 2026 - i).map((y) => (
                  <option key={y} value={y}>
                    {y} 年地市级
                  </option>
                ))}
              </select>
              <label className={styles.search}>
                <Search size={16} />
                <input
                  aria-label="搜索题目"
                  value={search}
                  placeholder="搜索题目或知识点"
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <select
                aria-label="知识点筛选"
                value={knowledge}
                onChange={(e) => {
                  setKnowledge(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">全部知识点</option>
                {topics.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
              <select
                aria-label="练习状态"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option>全部</option>
                <option>未练</option>
              </select>
            </div>
            <div className={styles.rows}>
              {visible.slice(page * 12, page * 12 + 12).map((q, i) => (
                <button
                  key={q.id}
                  className={styles.row}
                  onClick={() => start(q.id)}
                >
                  <span className={styles.rowNumber}>
                    {String(page * 12 + i + 1).padStart(2, "0")}
                  </span>
                  <span className={styles.rowText}>
                    <span>{questionText(q.stem)}</span>
                    <small>
                      {q.source.year} 地市级 <b>·</b> {q.module} <b>·</b>{" "}
                      {q.knowledge}
                      <span className={styles.rowTime}>
                        {q.attempts?.length
                          ? `最近用时 ${formatDuration(newestAttempts(q.attempts)[0].elapsed)}`
                          : "用时 —"}
                      </span>
                      {tab === "错题" &&
                        ` · ${q.attempts?.find((a) => a.correct === false && !a.mastered)?.reason || "尚未记录错因"}`}
                    </small>
                  </span>
                  <span className={styles.rowState}>
                    {q.attempts?.length
                      ? wrong(q)
                        ? "待复习"
                        : "已练"
                      : "未练"}
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
            {!visible.length && (
              <div className={styles.empty}>
                {tab === "错题"
                  ? "当前条件下没有待复习错题。"
                  : "没有符合条件的题目。试试切换模块或清空搜索。"}
              </div>
            )}
            <footer className={styles.pagination}>
              <span>
                {visible.length ? page * 12 + 1 : 0}–
                {Math.min((page + 1) * 12, visible.length)} / {visible.length}
              </span>
              <div>
                <button
                  aria-label="上一页题目"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  aria-label="下一页题目"
                  disabled={(page + 1) * 12 >= visible.length}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </footer>
          </section>
          <p className={styles.footnote}>
            2017–2026
            年国考地市级公开整理/回忆版；不混入模拟题。原图、参考解析和来源在每题保留。尚未全部完成独立答案复核。
          </p>
        </main>
      )}
      {reader && (
        <PageReader
          reader={reader}
          catalog={catalog}
          onChange={setReader}
          onClose={() => setReader(null)}
        />
      )}
    </div>
  );
}

function QuestionRoom({
  q,
  bank,
  onTransfer,
  catalog,
  index,
  total,
  onBack,
  onMove,
  onAttempt,
  onRead,
}: {
  q: QuestionView;
  bank: QuestionView[];
  onTransfer: (ids: string[]) => void;
  catalog: StudyCatalog | null;
  index: number;
  total: number;
  onBack: () => void;
  onMove: (i: number) => void;
  onAttempt: (qid: string, a: Attempt) => void;
  onRead: (r: Reader) => void;
}) {
  const [choice, setChoice] = useState(""),
    [result, setResult] = useState<Attempt | null>(null);
  const [revealed, setRevealed] = useState(false),
    [step, setStep] = useState(0),
    [tab, setTab] = useState("分步推导");
  const [hint, setHint] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0),
    [reason, setReason] = useState("");
  const started = useRef(Date.now());
  useEffect(() => {
    const t = setInterval(() => {
      if (!revealed)
        setSeconds(Math.floor((Date.now() - started.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [revealed]);
  useEffect(() => {
    try {
      localStorage.setItem("gk:last-question", q.id);
    } catch {
      /* optional */
    }
  }, [q.id]);
  const lesson = q.lesson;
  const validation = lesson ? validateLesson(lesson, q.answer) : null;
  const usable =
    lesson &&
    validation?.errors.length === 0 &&
    ["SOURCE_ADAPTED", "APPROVED"].includes(q.quality);
  const current = lesson?.steps[step];
  const previousWrong = q.attempts?.find(
    (a) => a.correct === false && !a.mastered && a.id !== result?.id,
  );
  async function submit() {
    if (!choice || busy || result || revealed) return;
    setBusy(true);
    setError("");
    try {
      const a = await post("attempt", {
        questionId: q.id,
        selected: choice,
        elapsed: Math.min(
          86400,
          Math.max(0, Math.floor((Date.now() - started.current) / 1000)),
        ),
      });
      setResult(a);
      setSeconds(a.elapsed);
      setRevealed(true);
      onAttempt(q.id, a);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function updateReason(value: string) {
    if (!result) return;
    setReason(value);
    setBusy(true);
    setError("");
    try {
      const a = await post("attempt-update", {
        id: result.id,
        reason: value,
        mastered: false,
      });
      setResult(a);
      onAttempt(q.id, a);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function mastered() {
    setBusy(true);
    setError("");
    try {
      for (const a of q.attempts ?? [])
        if (a.correct === false && !a.mastered)
          onAttempt(
            q.id,
            await post("attempt-update", {
              id: a.id,
              reason: a.reason,
              mastered: true,
            }),
          );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  function highlight(text: string) {
    return (
      <SourceText
        text={text}
        highlights={revealed && usable ? (current?.highlights ?? []) : []}
      />
    );
  }
  const source = () =>
    q.id.startsWith("gk-")
      ? setTab("出处")
      : onRead({
          resourceId: lesson?.sourceResourceId ?? "",
          page: lesson?.answerPage ?? q.page,
          title: "试卷原解析",
        });
  return (
    <main className={styles.room}>
      <div className={styles.roomBar}>
        <button className={styles.quiet} onClick={onBack}>
          <ArrowLeft size={16} /> 题目列表
        </button>
        <span>
          {q.module} <b> / </b> {index + 1} / {total}
        </span>
        <span className={styles.clock}>
          <Clock3 size={15} />{" "}
          {String(Math.floor(seconds / 60)).padStart(2, "0")}:
          {String(seconds % 60).padStart(2, "0")}
        </span>
      </div>
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      <div className={styles.workspace}>
        <section className={styles.questionPanel} aria-label="题目与作答">
          <div className={styles.questionHeading}>
            <span>{q.source.year} 年地市级 · 公开整理/回忆版</span>
            <small>{q.knowledge}</small>
          </div>
          {(q.material || !!lesson?.assets?.length) && (
            <div className={styles.material}>
              <div className={styles.materialLabel}>阅读材料</div>
              {q.material && <p>{highlight(q.material)}</p>}
              {lesson?.assets?.map((name) => (
                <figure key={name}>
                  <img
                    src={`/api/study/asset/${name}`}
                    alt="原试卷数据图表，点击查看完整原页"
                    onClick={() => {
                      const a = catalog?.assets?.find((a) => a.name === name);
                      if (a)
                        onRead({
                          resourceId: a.resourceId,
                          page: a.page,
                          title: "原试卷图表",
                        });
                    }}
                  />
                  <figcaption>原试卷图表 · 点击查看原页</figcaption>
                </figure>
              ))}
            </div>
          )}
          <h1 className={styles.stem}>{highlight(q.stem)}</h1>
          <div
            role="radiogroup"
            aria-label="选择答案"
            className={styles.options}
          >
            {q.options.map((o) => (
              <button
                key={o.key}
                role="radio"
                aria-checked={choice === o.key}
                disabled={!!result || revealed}
                className={`${choice === o.key ? styles.chosen : ""} ${revealed && q.answer === o.key ? styles.correctOption : ""} ${result?.correct === false && choice === o.key ? styles.wrongOption : ""}`}
                onClick={() => setChoice(o.key)}
              >
                <span>{o.key}</span>
                <span>
                  <SourceText text={o.text} />
                </span>
                {revealed && q.answer === o.key && <Check size={18} />}
              </button>
            ))}
          </div>
          {!result ? (
            <div className={styles.submitBar}>
              <button
                className={styles.primary}
                disabled={!choice || busy || revealed}
                onClick={submit}
              >
                {revealed
                  ? "学习模式 · 本次不计分"
                  : busy
                    ? "正在保存…"
                    : "提交答案"}
              </button>
              {!revealed && (
                <button
                  className={styles.quiet}
                  onClick={() => setRevealed(true)}
                >
                  直接学习解析
                </button>
              )}
            </div>
          ) : (
            <div
              className={`${styles.feedback} ${result.correct ? styles.feedbackGood : ""}`}
              role="status"
            >
              <strong>
                {result.correct
                  ? "回答正确"
                  : result.correct === null
                    ? "答案待确认"
                    : "这道题需要再想一遍"}
              </strong>
              <span>
                你的选择 {result.selected} · 资料答案 {q.answer ?? "待核验"}
              </span>
              <span>本次用时 {formatDuration(result.elapsed)}</span>
              {result.correct === false && (
                <select
                  aria-label="记录错误原因"
                  value={reason}
                  disabled={busy}
                  onChange={(e) => void updateReason(e.target.value)}
                >
                  <option value="">记录这次错因</option>
                  {[
                    "读题错误",
                    "公式理解错误",
                    "计算错误",
                    "知识点不熟悉",
                    "逻辑错误",
                    "时间不足",
                  ].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              )}
              {result.correct && previousWrong && (
                <button disabled={busy} onClick={mastered}>
                  已能独立完成，标记掌握
                </button>
              )}
            </div>
          )}
          {previousWrong && (
            <p className={styles.previous}>
              上次错因：{previousWrong.reason || "未填写"} · 上次选择{" "}
              {previousWrong.selected}
            </p>
          )}
          {!!q.attempts?.length && (
            <details className={styles.attemptHistory}>
              <summary>
                作答记录 · {q.attempts.length} 次 · 最近用时{" "}
                {formatDuration(newestAttempts(q.attempts)[0].elapsed)}
              </summary>
              <ul>
                {newestAttempts(q.attempts).map((a) => (
                  <li key={a.id}>
                    <time dateTime={a.createdAt}>
                      {new Date(a.createdAt).toLocaleString("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    <span>
                      {a.selected} ·{" "}
                      {a.correct === null
                        ? "待核验"
                        : a.correct
                          ? "答对"
                          : "答错"}
                    </span>
                    <strong>{formatDuration(a.elapsed)}</strong>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className={styles.questionFooter}>
            <small>公开整理/回忆版 · 参考答案未全面复核</small>
            <button
              className={styles.quiet}
              onClick={() => {
                setRevealed(true);
                setTab("出处");
              }}
            >
              出处
            </button>
          </div>
        </section>
        <section className={styles.teachingPanel} aria-label="教学解析">
          {!revealed ? (
            <div className={styles.beforeAnswer}>
              <span className={styles.boardIcon}>思</span>
              <h2>先想一想，再看推导</h2>
              <p>
                先判断题目在问什么。
                <br />
                你会从哪个条件开始？
              </p>
              <button onClick={() => setHint(!hint)}>
                {hint ? "收起提示" : "给我一点提示"}
              </button>
              {hint && (
                <p className={styles.hint}>
                  {usable
                    ? lesson.steps[0].hint
                    : "先圈出设问、已知条件和限制词。"}
                </p>
              )}
              <small>提交后展开解析，也可以直接进入教学。</small>
            </div>
          ) : (
            <>
              <div
                className={styles.lessonTabs}
                role="tablist"
                aria-label="解析入口"
              >
                {["分步推导", "考场方法", "同类真题", "知识笔记", "出处"].map(
                  (t) => (
                    <button
                      role="tab"
                      aria-selected={tab === t}
                      key={t}
                      onClick={() => setTab(t)}
                    >
                      {t}
                    </button>
                  ),
                )}
              </div>
              <div className={styles.lessonContent}>
                {!usable ? (
                  <div className={styles.error}>
                    解析暂不能展示：{validation?.errors.join("；") || "待审核"}
                    。请核对原资料。
                    <p>
                      <a href={q.source.url} target="_blank" rel="noreferrer">
                        打开来源核查
                      </a>
                    </p>
                    <details>
                      <summary>对照来源参考解析（不代表冲突已解决）</summary>
                      <p>
                        <SourceText text={q.reference} />
                      </p>
                    </details>
                  </div>
                ) : tab === "分步推导" ? (
                  <>
                    <div className={styles.stepHeading}>
                      <span>推演板</span>
                      <small>
                        {step + 1} / {lesson.steps.length}
                      </small>
                      <button
                        className={styles.quiet}
                        onClick={() => {
                          setStep(0);
                          setHint(false);
                        }}
                      >
                        重新演示
                      </button>
                    </div>
                    <div className={styles.stepTrack}>
                      {lesson.steps.map((s, i) => (
                        <button
                          key={i}
                          aria-label={`步骤 ${i + 1}：${s.title}`}
                          aria-current={step === i ? "step" : undefined}
                          onClick={() => {
                            setStep(i);
                            setHint(false);
                          }}
                        >
                          {i < step ? <Check size={14} /> : i + 1}
                        </button>
                      ))}
                    </div>
                    <ol className={styles.reasoningBoard}>
                      {lesson.steps.slice(0, step + 1).map((s, i) => (
                        <li
                          key={i}
                          className={i === step ? styles.activeNode : ""}
                        >
                          <span className={styles.nodeDot}>{i + 1}</span>
                          <div>
                            <h3>{s.title}</h3>
                            {i === step ? (
                              <p>
                                <SourceText text={s.explanation} />
                              </p>
                            ) : (
                              <details>
                                <summary>回看这一步</summary>
                                <p>
                                  <SourceText text={s.explanation} />
                                </p>
                              </details>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                    <ReasoningVisual lesson={lesson} step={step} />
                    {lesson.teachingTable && (
                      <div className={styles.teachingTable}>
                        <strong>{lesson.teachingTable.title}</strong>
                        <table>
                          <thead>
                            <tr>
                              {lesson.teachingTable.headers.map((h, i) => (
                                <th key={i}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {lesson.teachingTable.rows
                              .slice(
                                0,
                                step === lesson.steps.length - 1
                                  ? undefined
                                  : step + 1,
                              )
                              .map((row, i) => (
                                <tr key={i}>
                                  {row.map((cell, j) => (
                                    <td key={j}>{cell}</td>
                                  ))}
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        <small>随步骤逐行展开；数字对应本题条件。</small>
                      </div>
                    )}
                    {!!lesson.diagram?.series?.length && step > 0 && (
                      <div className={styles.chart} aria-label="原题数据比较">
                        <small>题目数值比较（保留正负号）</small>
                        {lesson.diagram.series.map((s, i, rows) => (
                          <div key={i}>
                            <span>{s.label}</span>
                            <div>
                              <i
                                style={{
                                  width: `${(Math.abs(s.value) / (Math.max(...rows.map((r) => Math.abs(r.value))) || 1)) * 100}%`,
                                  background:
                                    s.value < 0 ? "#ae694f" : undefined,
                                }}
                              />
                            </div>
                            <b>{s.value}</b>
                          </div>
                        ))}
                      </div>
                    )}
                    {hint && <p className={styles.hint}>{current?.hint}</p>}
                    <div className={styles.stepControls}>
                      <button
                        disabled={step === 0}
                        onClick={() => {
                          setStep(step - 1);
                          setHint(false);
                        }}
                      >
                        <ChevronLeft size={16} /> 上一步
                      </button>
                      <button
                        className={styles.quiet}
                        onClick={() => setHint(!hint)}
                      >
                        思考提示
                      </button>
                      <button
                        className={styles.primary}
                        disabled={step === lesson.steps.length - 1}
                        onClick={() => {
                          setStep(step + 1);
                          setHint(false);
                        }}
                      >
                        下一步 <ChevronRight size={16} />
                      </button>
                    </div>
                    {step === lesson.steps.length - 1 && (
                      <div className={styles.transfer}>
                        <strong>合上解析，复述一遍</strong>
                        <p>{lesson.transfer}</p>
                        <button onClick={() => setTab("同类真题")}>
                          同考点真题迁移
                        </button>
                        <button
                          onClick={() => onMove(Math.min(total - 1, index + 1))}
                          disabled={index + 1 === total}
                        >
                          做下一题 <ArrowRight size={16} />
                        </button>
                      </div>
                    )}
                  </>
                ) : tab === "同类真题" ? (
                  <>
                    <h2>{q.knowledge} · 换一道真题检验</h2>
                    <p>
                      优先选择不同年份、相同教学考点的来源题。先独立做，再比较条件、方法和易错点。
                    </p>
                    {transferQuestions(q, bank).map((x) => (
                      <button
                        className={styles.transferRow}
                        key={x.id}
                        onClick={() =>
                          onTransfer([
                            x.id,
                            ...transferQuestions(x, bank).map((v) => v.id),
                          ])
                        }
                      >
                        <b>
                          {x.source.year} 年地市级 · {x.knowledge}
                        </b>
                        <span>{questionText(x.stem)}</span>
                        <ArrowRight size={16} />
                      </button>
                    ))}
                    {!transferQuestions(q, bank).length && (
                      <p>
                        当前没有另一道同考点的完整来源题；不使用生成题补位。
                      </p>
                    )}
                  </>
                ) : tab === "考场方法" ? (
                  <>
                    <span className={styles.sectionKicker}>方法与适用条件</span>
                    <p className={styles.longText}>
                      <SourceText text={lesson.fast} />
                    </p>
                    <h3>命题视角</h3>
                    <p className={styles.longText}>
                      <SourceText text={lesson.examiner} />
                    </p>
                    {!!lesson.distractors.length && (
                      <>
                        <h3>选项为什么会干扰</h3>
                        {lesson.distractors.map((s, i) => (
                          <p key={i}>
                            <SourceText text={s} />
                          </p>
                        ))}
                      </>
                    )}
                    <small>命题分析是基于题目结构的教学推断。</small>
                  </>
                ) : tab === "知识笔记" ? (
                  <>
                    <span className={styles.sectionKicker}>{q.knowledge}</span>
                    <h2>{lesson.notebook?.title || "暂未匹配笔记"}</h2>
                    <p>
                      {lesson.notebook?.reason || "请先看本题解析与原始资料。"}
                    </p>
                    {lesson.notebook &&
                      lesson.notebook.relation !== "not-covered" && (
                        <div className={styles.noteLink}>
                          <BookOpen size={25} />
                          <div>
                            <strong>
                              行测三色笔记 · PDF 第 {lesson.notebook.page}–
                              {lesson.notebook.endPage} 页
                            </strong>
                            <p>
                              {lesson.notebook.relation === "direct"
                                ? "对应方法章节"
                                : "相关基础方法，非直接覆盖"}
                            </p>
                            <button
                              className={styles.primary}
                              onClick={() =>
                                onRead({
                                  resourceId: lesson.notebook!.resourceId,
                                  page: lesson.notebook!.page,
                                  title: lesson.notebook!.title,
                                })
                              }
                            >
                              打开对应笔记 <ArrowRight size={16} />
                            </button>
                          </div>
                        </div>
                      )}
                    <button onClick={source}>查看试卷原解析</button>
                  </>
                ) : (
                  <>
                    <h3>来源与解析依据</h3>
                    <p>{q.source.name}</p>
                    {q.id.startsWith("gk-") ? (
                      <p>
                        {q.number}
                        <br />
                        <a href={q.source.url} target="_blank" rel="noreferrer">
                          打开可核查来源
                        </a>
                      </p>
                    ) : (
                      <p>
                        原题：PDF 第 {q.page}–{q.endPage} 页<br />
                        原解析：PDF 第 {lesson.answerPage ?? q.page}–
                        {lesson.answerEndPage ?? q.endPage} 页
                      </p>
                    )}
                    <p>{q.evidence}</p>
                    <p>
                      {lesson.provenance === "independently-checked"
                        ? "已补充分步推导与针对性复算。"
                        : "按原资料解析整理为分步教学，尚未完成逐题独立复核。"}{" "}
                      自动检查涵盖答案一致性、登记算式和结构，不等同于完整数学证明。
                    </p>
                    {!q.id.startsWith("gk-") && (
                      <button onClick={source}>打开原解析页</button>
                    )}
                    <details className={styles.sourceDetails}>
                      <summary>查看资料参考解析文字</summary>
                      <p>
                        <SourceText text={q.reference} />
                      </p>
                    </details>
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </div>
      <div className={styles.roomBottom}>
        <button disabled={index === 0} onClick={() => onMove(index - 1)}>
          <ChevronLeft size={16} /> 上一题
        </button>
        <span>{q.knowledge}</span>
        <button
          disabled={index + 1 === total}
          onClick={() => onMove(index + 1)}
        >
          下一题 <ChevronRight size={16} />
        </button>
      </div>
    </main>
  );
}

function PageReader({
  reader,
  catalog,
  onChange,
  onClose,
}: {
  reader: Reader;
  catalog: StudyCatalog | null;
  onChange: (r: Reader) => void;
  onClose: () => void;
}) {
  const resource = catalog?.resources.find((r) => r.id === reader.resourceId);
  const [failed, setFailed] = useState(false),
    [loaded, setLoaded] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null),
    dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [reader.page, reader.resourceId]);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = [
          ...(dialogRef.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href],input",
          ) ?? []),
        ];
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
          e.preventDefault();
          items[0]?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      before?.focus();
    };
  }, []);
  return (
    <div className={styles.readerBackdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.reader}
        role="dialog"
        aria-modal="true"
        aria-label={reader.title}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <h2>{reader.title}</h2>
            <small>{resource?.name ?? "资料未收录"}</small>
          </div>
          <button ref={closeRef} aria-label="关闭笔记" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className={styles.readerTools}>
          <button
            disabled={reader.page <= 1}
            onClick={() => onChange({ ...reader, page: reader.page - 1 })}
          >
            <ChevronLeft size={16} /> 上一页
          </button>
          <label>
            PDF 页码{" "}
            <input
              aria-label="PDF 页码"
              type="number"
              min={1}
              max={resource?.pages ?? 1}
              value={reader.page}
              onChange={(e) => {
                const p = Number(e.target.value);
                if (
                  Number.isInteger(p) &&
                  p >= 1 &&
                  p <= (resource?.pages ?? 1)
                )
                  onChange({ ...reader, page: p });
              }}
            />{" "}
            / {resource?.pages ?? "—"}
          </label>
          <button
            disabled={!resource || reader.page >= resource.pages}
            onClick={() => onChange({ ...reader, page: reader.page + 1 })}
          >
            下一页 <ChevronRight size={16} />
          </button>
        </div>
        <div className={styles.readerBody}>
          {resource ? (
            <>
              {!loaded && !failed && <p>正在读取原页…</p>}
              {failed && (
                <p role="alert">
                  页面加载失败。
                  <a
                    target="_blank"
                    rel="noreferrer"
                    href={`/api/study/file/${resource.id}#page=${reader.page}`}
                  >
                    直接打开原 PDF
                  </a>
                </p>
              )}
              <img
                key={resource.id + reader.page}
                src={`/api/study/page/${resource.id}?page=${reader.page}`}
                alt={`${resource.name} PDF 第 ${reader.page} 页`}
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
              />
            </>
          ) : (
            <p>未找到原资料，请在「资料与设置」检查本地文件。</p>
          )}
        </div>
      </div>
    </div>
  );
}

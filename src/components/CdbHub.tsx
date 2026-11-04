"use client";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileText,
  Flag,
  GraduationCap,
  Target,
} from "lucide-react";
import type { QuestionView } from "@/core/types";
import {
  studyPrinciples,
  type StudyCatalog,
  type StudyProgress,
  type StudyResource,
} from "@/core/cdb";

export function CdbHub({
  questions,
  onLearn,
  onMistakes,
  notify,
}: {
  questions: QuestionView[];
  onLearn: (id: string) => void;
  onMistakes: () => void;
  notify: (s: string) => void;
}) {
  const [catalog, setCatalog] = useState<StudyCatalog | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [tab, setTab] = useState("学习路线"),
    [progress, setProgress] = useState<Record<string, StudyProgress>>({}),
    [busy, setBusy] = useState(""),
    [resource, setResource] = useState<StudyResource | null>(null),
    [page, setPage] = useState(1),
    [notes, setNotes] = useState(""),
    [priority, setPriority] = useState("全部"),
    [search, setSearch] = useState(""),
    [questionGroup, setQuestionGroup] = useState<string[] | null>(null),
    [module, setModule] = useState("全部"),
    [writing, setWriting] = useState(""),
    [outline, setOutline] = useState(""),
    [examDate, setExamDate] = useState(""),
    [budget, setBudget] = useState(180),
    [elapsed, setElapsed] = useState(0),
    [running, setRunning] = useState(false);
  useEffect(() => {
    Promise.all([
      fetch("/api/cdb/catalog").then((r) => {
        if (!r.ok) throw new Error("资料目录读取失败");
        return r.json();
      }),
      fetch("/api/cdb/state").then((r) => {
        if (!r.ok) throw new Error("学习进度读取失败");
        return r.json();
      }),
    ])
      .then(([c, p]) => {
        setCatalog(c);
        setProgress(p);
        setWriting(p["writing:summary"]?.answer ?? "");
        setOutline(p["writing:outline"]?.answer ?? "");
        try {
          const profile = JSON.parse(p["profile:exam"]?.notes ?? "{}");
          setExamDate(profile.examDate ?? "");
          setBudget(profile.budget ?? 180);
        } catch {
          /* No saved profile. */
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (resource && tab === "精选资料")
      document
        .getElementById("cdb-reader")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [resource, tab]);
  async function save(key: string, value: StudyProgress) {
    setBusy(key);
    try {
      const r = await fetch("/api/cdb/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setProgress((p) => ({ ...p, [key]: { ...p[key], ...value } }));
      return true;
    } catch (e) {
      notify(String(e));
      return false;
    } finally {
      setBusy("");
    }
  }
  function read(r: StudyResource, p?: number) {
    setResource(r);
    setPage(
      Math.max(
        1,
        Math.min(
          r.pages,
          p ?? progress["resource:" + r.id]?.page ?? r.startPage,
        ),
      ),
    );
    setNotes(progress["resource:" + r.id]?.notes ?? "");
    setTab("精选资料");
  }
  function practice(ids?: string[]) {
    setQuestionGroup(ids ?? null);
    setModule("全部");
    setTab("精选练习");
  }
  if (loading)
    return (
      <section className="panel empty">
        正在读取你的国开行备考资料与进度…
      </section>
    );
  if (error) return <section className="panel empty">{error}</section>;
  if (!catalog)
    return (
      <section className="panel empty">
        <h1>国开行备考</h1>
        <p>
          此电脑还没有本地精选资料目录。个人资料保存在
          data/cdb，不随代码公开发布。
        </p>
      </section>
    );
  const done = catalog.tasks.filter(
    (t) => progress["task:" + t.id]?.done,
  ).length;
  const localQuestions = questions.filter((q) =>
    catalog.questionIds.includes(q.id),
  );
  const shownQuestions = localQuestions.filter(
    (q) =>
      (!questionGroup || questionGroup.includes(q.id)) &&
      (module === "全部" || q.module === module),
  );
  const resources = catalog.resources.filter(
    (r) =>
      (priority === "全部" || r.priority === priority) &&
      (r.name + r.module + r.reason).includes(search),
  );
  const dateToday = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
  }).format(new Date());
  const days = examDate
    ? Math.round(
        (Date.parse(examDate + "T00:00:00Z") -
          Date.parse(dateToday + "T00:00:00Z")) /
          86400000,
      )
    : null;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CDB STUDY ROOM / 这几天，专注国开行</div>
          <h1>资料少一点，真正学会多一点。</h1>
          <p>
            精选资料、代表题、写作练习和复盘放在一起。先按下面的顺序学，做会再扩量。
          </p>
        </div>
        <span className="status">个人资料专区 · 非官方题库</span>
      </div>
      <div className="cdb-overview">
        <section className="cdb-focus">
          <GraduationCap size={30} />
          <div>
            <h2>先完成一轮小诊断</h2>
            <p>
              用代表题找出薄弱点，再去读对应讲义。不会的地方，我们逐步拆开。
            </p>
            <button
              className="primary"
              onClick={() => practice(catalog.tasks[0]?.questionIds)}
            >
              从精选题开始 <ArrowUpRight size={16} />
            </button>
          </div>
        </section>
        <section className="panel cdb-counts">
          <div>
            <strong>{catalog.resources.length}</strong>
            <span>份精选资料</span>
          </div>
          <div>
            <strong>{localQuestions.length}</strong>
            <span>道复核代表题</span>
          </div>
          <div>
            <strong>
              {done}/{catalog.tasks.length}
            </strong>
            <span>项学习任务</span>
          </div>
        </section>
      </div>
      <div className="cdb-tabs">
        {["学习路线", "精选练习", "精选资料", "写作工作台", "资料疑点"].map(
          (t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={tab === t ? "active" : ""}
            >
              {t}
              {t === "资料疑点" && <span>{catalog.issues.length}</span>}
            </button>
          ),
        )}
      </div>
      {tab === "学习路线" ? (
        <>
          <section className="panel cdb-profile">
            <label>
              我的实际考试日期
              <input
                aria-label="我的考试日期"
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
            </label>
            <label>
              每天可用分钟
              <input
                type="number"
                min={30}
                max={600}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
              />
            </label>
            <button
              disabled={!!busy}
              onClick={async () => {
                if (budget < 30 || budget > 600) {
                  notify("每天学习预算请填30—600分钟");
                  return;
                }
                if (
                  await save("profile:exam", {
                    notes: JSON.stringify({ examDate, budget }),
                  })
                )
                  notify("学习安排已保存");
              }}
            >
              保存安排
            </button>
            <div>
              {days === null
                ? "还没填写日期，按阶段推进即可。"
                : days < 0
                  ? "已填日期已过，请核对。"
                  : days === 0
                    ? "今天考试，优先检查通知和错题收口。"
                    : `距离你填写的考试日期还有 ${days} 天。`}
              <small>
                各阶段是学习顺序，可按每天 {budget} 分钟拆开；不是官方科目配时。
              </small>
            </div>
          </section>
          <div className="cdb-principles">
            {studyPrinciples.map((p, i) => (
              <section key={p.title}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </div>
              </section>
            ))}
          </div>
          {[1, 2, 3].map((stage) => (
            <section className="cdb-stage" key={stage}>
              <div className="section-title">
                <h2>
                  阶段 {stage} ·{" "}
                  {
                    ["定位与打底", "建立模型与动笔", "限时迁移与收口"][
                      stage - 1
                    ]
                  }
                </h2>
                <small>
                  建议约{" "}
                  {catalog.tasks
                    .filter((t) => t.stage === stage)
                    .reduce((s, t) => s + t.minutes, 0)}{" "}
                  分钟，可分次完成
                </small>
              </div>
              {catalog.tasks
                .filter((t) => t.stage === stage)
                .map((t) => (
                  <article
                    className={
                      "panel cdb-task " +
                      (progress["task:" + t.id]?.done ? "completed" : "")
                    }
                    key={t.id}
                  >
                    <label className="cdb-check">
                      <input
                        type="checkbox"
                        checked={progress["task:" + t.id]?.done ?? false}
                        disabled={!!busy}
                        onChange={(e) =>
                          save("task:" + t.id, { done: e.target.checked })
                        }
                      />
                      <span>{t.title}</span>
                    </label>
                    <span className="cdb-time">
                      <Clock3 size={12} />
                      {t.minutes} 分钟
                    </span>
                    <p>{t.action}</p>
                    <div className="cdb-selfcheck">
                      <CheckCircle2 size={15} />
                      <span>学会的标准：{t.check}</span>
                    </div>
                    <div className="cdb-task-actions">
                      <button
                        onClick={() => {
                          const r = catalog.resources.find(
                            (r) => r.id === t.resourceId,
                          );
                          if (r) read(r, t.startPage);
                        }}
                      >
                        阅读第 {t.startPage}—{t.endPage} 页
                      </button>
                      {t.questionIds.length > 0 && (
                        <button
                          className="primary"
                          onClick={() => practice(t.questionIds)}
                        >
                          做对应代表题
                        </button>
                      )}
                      {t.id.includes("writing") && (
                        <button onClick={() => setTab("写作工作台")}>
                          去动笔
                        </button>
                      )}
                      {t.id === "review" && (
                        <button onClick={onMistakes}>打开错题本</button>
                      )}
                    </div>
                  </article>
                ))}
            </section>
          ))}
          <details className="panel cdb-audit">
            <summary>这次资料筛选的范围与依据</summary>
            <p>
              清点 {catalog.stats.files} 个文件，其中 PDF {catalog.stats.pdfs}{" "}
              份；PDF/DOCX/TXT 共提取 {catalog.stats.pages} 个页面/逻辑页。
              {catalog.stats.textFiles} 份有可提取文字，
              {catalog.stats.imageOnly}{" "}
              份只读到图片。已全文提取可读文字，并重点核对精选章节与代表题；不等于逐页人工核验全部资料。
            </p>
            <p>
              优先选择近期整理卷中能复核的题、短篇技巧和写作入门；面试视频、性格测试、过旧试卷、深度专业讲义及重复材料暂缓。共发现{" "}
              {catalog.stats.duplicateGroups}{" "}
              组字节相同文件。未把所有题目自动入库。
            </p>
            <p>{catalog.official.note}</p>
            <a href={catalog.official.url} target="_blank" rel="noreferrer">
              查看招聘公告出处（核对日 {catalog.official.checkedAt}）↗
            </a>
          </details>
        </>
      ) : tab === "精选练习" ? (
        <>
          <div className="panel">
            <div className="section-title">
              <h2>先做会这些代表题</h2>
              <button className="link" onClick={() => practice()}>
                显示全部 {localQuestions.length} 题
              </button>
            </div>
            <p className="muted">
              题目来自你提供的整理资料，年份与真题身份未认证。解析包含原资料整理与补充推导，具体依据见每题出处；已发现的疑问题不进入练习。
            </p>
            <div className="filter-chips">
              {["全部", "数量关系", "资料分析", "判断推理", "英语能力"].map(
                (m) => (
                  <button
                    key={m}
                    className={module === m ? "active" : ""}
                    onClick={() => setModule(m)}
                  >
                    {m}
                  </button>
                ),
              )}
            </div>
            {shownQuestions.length ? (
              shownQuestions.map((q) => (
                <button
                  key={q.id}
                  className="question-row"
                  onClick={() => onLearn(q.id)}
                >
                  <span className="module-icon">{q.module.slice(0, 2)}</span>
                  <div>
                    <div className="row-tags">
                      <span>{q.knowledge}</span>
                      <small>用户资料 · 已复核代表题</small>
                    </div>
                    <h3>{q.stem}</h3>
                    <small>
                      {q.number} · 原文件第 {q.page}—{q.endPage} 页 ·{" "}
                      {q.attempts?.length ?? 0} 次作答
                    </small>
                  </div>
                  <ArrowUpRight size={16} />
                </button>
              ))
            ) : (
              <p className="empty">当前分组暂无题目。</p>
            )}
          </div>
        </>
      ) : tab === "精选资料" ? (
        <>
          <section className="panel">
            <div className="filters">
              <input
                placeholder="搜索资料或知识点"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {["全部", "先学", "有帮助", "按需"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="cdb-resource-grid">
              {resources.map((r) => (
                <article
                  key={r.id}
                  className={
                    "cdb-resource " + (resource?.id === r.id ? "active" : "")
                  }
                >
                  <span className={"pill priority-" + r.priority}>
                    {r.priority}
                  </span>
                  <small>
                    {r.module} · {r.pages} 页
                  </small>
                  <h3>{r.name}</h3>
                  <p>{r.reason}</p>
                  <div className="cdb-resource-goal">
                    <b>读完要能做到</b>
                    <p>{r.goal}</p>
                  </div>
                  <button onClick={() => read(r)}>
                    <BookOpen size={14} />{" "}
                    {progress["resource:" + r.id]?.page
                      ? "继续第 " + progress["resource:" + r.id].page + " 页"
                      : "开始读第 " + r.startPage + " 页"}
                  </button>
                  {r.questionIds.length > 0 && (
                    <button
                      className="link"
                      onClick={() => practice(r.questionIds)}
                    >
                      配套 {r.questionIds.length} 道代表题 →
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>
          {resource && (
            <section id="cdb-reader" className="panel cdb-reader">
              <div className="section-title">
                <h2>{resource.name}</h2>
                <a
                  href={`/api/cdb/file/${resource.id}#page=${page}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  新窗口打开原件 ↗
                </a>
              </div>
              <p className="muted">
                来自你的本地资料 · {resource.originalPath ?? resource.path}
              </p>
              {resource.warnings.length > 0 && (
                <div className="hint">{resource.warnings.join(" ")}</div>
              )}
              <div className="cdb-reader-controls">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  上一页
                </button>
                <label>
                  定位原文件第{" "}
                  <input
                    aria-label="阅读页码"
                    type="number"
                    min={1}
                    max={resource.pages}
                    value={page}
                    onChange={(e) =>
                      setPage(
                        Math.max(
                          1,
                          Math.min(resource.pages, Number(e.target.value) || 1),
                        ),
                      )
                    }
                  />{" "}
                  / {resource.pages} 页
                </label>
                <button
                  disabled={page >= resource.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </button>
              </div>
              <img
                key={resource.id + "-" + page}
                alt={resource.name + " · 原文件第 " + page + " 页"}
                className="cdb-original-page"
                src={`/api/cdb/page/${resource.id}?page=${page}`}
                loading="lazy"
              />
              <a
                className="link"
                href={`/api/cdb/page/${resource.id}?page=${page}`}
                target="_blank"
                rel="noreferrer"
              >
                放大查看这一页 ↗
              </a>
              <p className="muted">
                上方为原文件页面的直接渲染，保留原图、表格与公式。首次打开一页需要稍等。定位按
                PDF 文件页，而非页脚印刷页；需要缩放或搜索时可新窗口打开原件。
              </p>
              <label className="field">
                用自己的话记录一个关键关系或疑问
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="例如：我原来把现期当成分母；现在先圈出“比哪一年”再列式。"
                />
              </label>
              <button
                className="primary"
                disabled={!!busy}
                onClick={async () => {
                  if (await save("resource:" + resource.id, { page, notes }))
                    notify("阅读位置和笔记已保存");
                }}
              >
                保存阅读进度与笔记
              </button>
            </section>
          )}
        </>
      ) : tab === "写作工作台" ? (
        <>
          <div className="cdb-writing-grid">
            <section className="panel">
              <div className="panel-label">
                先审题，再动笔 <span>离开前请点击保存草稿</span>
              </div>
              <h2>从一道材料概括题开始</h2>
              <p>
                打开备考指南第25页的“社区支持农业”材料，按原件要求概括概念内涵，不超过150字。先独立写，不先看模板。
              </p>
              <button
                onClick={() => {
                  const r = catalog.resources.find(
                    (r) => r.module === "备考导航",
                  );
                  if (r) read(r, 25);
                }}
              >
                阅读原材料第25页
              </button>
              <label className="field">
                我的150字概括
                <textarea
                  rows={9}
                  value={writing}
                  onChange={(e) => setWriting(e.target.value)}
                  placeholder="先圈定对象，再概括参与者、运作方式和核心特征。"
                />
              </label>
              <div className="section-title">
                <small
                  className={
                    writing.replace(/\s/g, "").length > 150 ? "over-limit" : ""
                  }
                >
                  当前 {writing.replace(/\s/g, "").length}{" "}
                  字符（含标点，去空白；仅作字数辅助）
                </small>
                <button
                  className="primary"
                  disabled={!!busy}
                  onClick={async () => {
                    if (await save("writing:summary", { answer: writing }))
                      notify("写作草稿已保存");
                  }}
                >
                  保存草稿
                </button>
              </div>
              <details className="cdb-writing-hints">
                <summary>写完后再看引导与自检</summary>
                <p>
                  先检查是否回答“概念内涵”，再检查生产者与消费者、事先约定或投入、共同参与或风险分担、本地生态与可持续等材料要素。根据原文整合，避免把背景或个人态度写成定义。这是教学提示，不是官方评分标准或标准答案。
                </p>
                {[
                  "对象与设问一致",
                  "关键要素有原文依据",
                  "分类合并而非整段照抄",
                  "无材料外虚构数据",
                  "字数符合原题要求",
                ].map((x, i) => (
                  <label key={x}>
                    <input
                      type="checkbox"
                      checked={progress["writing:check-" + i]?.done ?? false}
                      disabled={!!busy}
                      onChange={(e) =>
                        save("writing:check-" + i, { done: e.target.checked })
                      }
                    />
                    {x}
                  </label>
                ))}
              </details>
            </section>
            <section className="panel">
              <h2>再写一个论证提纲</h2>
              <p className="muted">
                用“观点—材料依据—解释—回应问题”组织段落，不套万能开头。这里保存练习，不自动打分。
              </p>
              <textarea
                rows={12}
                value={outline}
                onChange={(e) => setOutline(e.target.value)}
                placeholder={
                  "观点：\n材料事实：\n它为什么支持观点：\n条件或局限：\n回扣题目："
                }
              />
              <button
                className="primary"
                disabled={!!busy}
                onClick={async () => {
                  if (await save("writing:outline", { answer: outline }))
                    notify("提纲已保存");
                }}
              >
                保存提纲
              </button>
              <div className="cdb-stopwatch">
                <Clock3 size={20} />
                <strong>
                  {Math.floor(elapsed / 60)
                    .toString()
                    .padStart(2, "0")}
                  :{(elapsed % 60).toString().padStart(2, "0")}
                </strong>
                <button onClick={() => setRunning((r) => !r)}>
                  {running ? "暂停" : "开始计时"}
                </button>
                <button
                  onClick={() => {
                    setRunning(false);
                    setElapsed(0);
                  }}
                >
                  重置
                </button>
              </div>
              <small>计时仅用于当前页面练习，离开专区后不继续。</small>
            </section>
          </div>
        </>
      ) : (
        <>
          <div className="hint">
            这里的疑点不会悄悄改成“正确答案”。保留原件和问题说明，先学已复核题；原资料并非权威答案。
          </div>
          {catalog.issues.map((issue) => (
            <section className="panel cdb-issue" key={issue.title}>
              <Flag size={17} />
              <div>
                <h2>{issue.title}</h2>
                <p>{issue.detail}</p>
                <button
                  onClick={() => {
                    const r = catalog.resources.find(
                      (r) => r.id === issue.resourceId,
                    );
                    if (r) read(r, issue.page);
                  }}
                >
                  核对原文件第 {issue.page} 页
                </button>
              </div>
            </section>
          ))}
        </>
      )}
    </>
  );
}

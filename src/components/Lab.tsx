"use client";
import { useState, useEffect, useCallback } from "react";
import {
  FlaskConical,
  LayoutDashboard,
  Library,
  Files,
  Upload,
  Workflow,
  BookOpen,
  ChartNoAxesCombined,
  Settings,
  ArrowUpRight,
  ChevronRight,
  Search,
  ShieldCheck,
} from "lucide-react";
import { type QuestionView, statuses, modules } from "@/core/types";
import { knowledgeTree } from "@/core/knowledge";
import { Teaching, post } from "./Teaching";
import { ImportReview } from "./ImportReview";

const nav = [
  { id: "dashboard", name: "学习仪表盘", icon: LayoutDashboard },
  { id: "questions", name: "题库与练习", icon: Library },
  { id: "sources", name: "试卷与来源", icon: Files },
  { id: "import", name: "导入与核验", icon: Upload },
  { id: "teach", name: "可视化教学", icon: Workflow },
  { id: "knowledge", name: "知识图谱", icon: BookOpen },
  { id: "mistakes", name: "我的错题本", icon: BookOpen },
  { id: "stats", name: "学习统计", icon: ChartNoAxesCombined },
  { id: "settings", name: "系统设置", icon: Settings },
];
type Source = {
  id: string;
  name: string;
  exam: string;
  year: number | null;
  region: string;
  url: string;
  filename: string | null;
  _count: { questions: number; drafts: number };
};
export function Lab() {
  const [page, setPage] = useState("import"),
    [questions, setQuestions] = useState<QuestionView[]>([]),
    [active, setActive] = useState("demo-growth"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true),
    [filter, setFilter] = useState("全部"),
    [scope, setScope] = useState("全部"),
    [search, setSearch] = useState(""),
    [year, setYear] = useState(""),
    [region, setRegion] = useState(""),
    [sources, setSources] = useState<Source[]>([]),
    [settings, setSettings] = useState<{
      configured: boolean;
      model: string;
      base: string;
    } | null>(null);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/questions");
      if (!r.ok) throw new Error("读取题库失败，请确认已执行 npm run setup");
      setQuestions(await r.json());
      setError("");
      const s = await fetch("/api/sources");
      setSources(await s.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => {});
  }, [load]);
  const q = questions.find((x) => x.id === active) ?? questions[0];
  const attempts = questions.flatMap((q) =>
    (q.attempts ?? []).map((a) => ({ ...a, q })),
  );
  const judged = attempts.filter((a) => a.correct !== null);
  const mistakes = questions.filter((q) =>
    q.attempts?.some((a) => a.correct === false),
  );
  const learn = (id: string) => {
    setActive(id);
    setPage("teach");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const visible = questions.filter(
    (q) =>
      (filter === "全部" || q.module === filter) &&
      (scope === "全部" ||
        (scope === "模拟训练" && q.status === "SIMULATION") ||
        (scope === "真实资料" && q.status !== "SIMULATION")) &&
      (!year || String(q.source.year) === year) &&
      (!region || q.source.region.includes(region)) &&
      (q.stem + q.knowledge + q.source.name + q.source.exam).includes(search),
  );
  const rows = (qs: QuestionView[]) =>
    qs.length ? (
      <div className="question-list">
        {qs.map((q) => (
          <button
            className="question-row"
            key={q.id}
            onClick={() => learn(q.id)}
          >
            <span className="module-icon">{q.module.slice(0, 2)}</span>
            <div>
              <div className="row-tags">
                <span>{q.knowledge}</span>
                <small>{statuses[q.status]}</small>
              </div>
              <h3>{q.stem}</h3>
              <small>
                {q.source.name} · 第 {q.page} 页 / 第 {q.number} 题
              </small>
            </div>
            <ChevronRight size={18} />
          </button>
        ))}
      </div>
    ) : (
      <div className="empty">
        暂无符合条件的题目。可先导入你自己的合法资料。
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <div className="brand-icon">
            <FlaskConical size={26} />
          </div>
          <div>
            <b>行测思维实验室</b>
            <span>XINGCE AI LAB</span>
          </div>
        </a>
        <div className="sidebar-section">我的学习空间</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "active" : ""}
              onClick={() => setPage(n.id)}
            >
              <n.icon size={18} />
              {n.name}
              {n.id === "teach" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ShieldCheck size={18} />
          <div>
            <b>真实性优先</b>
            <p>来源可追溯 · 推理可核验</p>
          </div>
        </div>
        <div className="version">
          LOCAL WORKSPACE <span>MVP 0.1</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            个人学习空间 <span>/</span> {nav.find((n) => n.id === page)?.name}
          </div>
          <div className="topbar-right">
            <span className="online-dot" />
            本地数据 · 私人使用 <div className="avatar">学</div>
          </div>
        </header>
        <main>
          {error && (
            <div className="error">
              {error}
              <button onClick={load}>重试</button>
            </div>
          )}
          {loading ? (
            <div className="empty">正在读取本地学习空间…</div>
          ) : page === "teach" && q ? (
            <Teaching q={q} onRefresh={load} notify={setMessage} />
          ) : page === "import" ? (
            <ImportReview notify={setMessage} onRefresh={load} />
          ) : page === "dashboard" ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR THINKING, MADE VISIBLE</div>
                  <h1>
                    不只做对一道题，
                    <br />
                    更要理解一类题。
                  </h1>
                  <p>从原理出发，让每一次练习都有迹可循。</p>
                </div>
                <button className="outline" onClick={() => setPage("import")}>
                  <Upload size={16} /> 导入我的试卷
                </button>
              </div>
              <div className="stats-grid">
                <div className="stat-card">
                  <span>已练习</span>
                  <strong>
                    {attempts.length}
                    <small> 次</small>
                  </strong>
                  <p>保留每一次作答过程</p>
                </div>
                <div className="stat-card">
                  <span>已判定正确率</span>
                  <strong>
                    {judged.length
                      ? Math.round(
                          (judged.filter((a) => a.correct).length /
                            judged.length) *
                            100,
                        ) + "%"
                      : "—"}
                  </strong>
                  <p>待核验答案不计入统计</p>
                </div>
                <div className="stat-card">
                  <span>待巩固错题</span>
                  <strong>
                    {mistakes.filter((q) => !q.attempts?.[0]?.mastered).length}
                    <small> 道</small>
                  </strong>
                  <p>理解错误，重新建立联系</p>
                </div>
                <div className="stat-card">
                  <span>已核验真题</span>
                  <strong>
                    {questions.filter((q) => q.status === "VERIFIED").length}
                    <small> 道</small>
                  </strong>
                  <p>原创演示题不计入真题</p>
                </div>
              </div>
              <div className="dashboard-columns">
                <section className="feature-card">
                  <div className="eyebrow">VISUAL THINKING LAB</div>
                  <h2>
                    把抽象公式，
                    <br />
                    变成看得见的关系。
                  </h2>
                  <p>
                    条件提取、模型建立、逐步推演。
                    <br />
                    从“知道答案”走向“自己会解”。
                  </p>
                  <button
                    className="primary"
                    onClick={() => learn("demo-growth")}
                  >
                    进入可视化教学 <ArrowUpRight size={17} />
                  </button>
                  <div className="mini-chart">
                    <i />
                    <i />
                    <i />
                    <div>基期 + 增长量 = 现期</div>
                  </div>
                </section>
                <section className="panel start-card">
                  <div className="panel-label">
                    开始一次思维实验 <span>3 个严谨模板</span>
                  </div>
                  {[
                    {
                      id: "demo-growth",
                      n: "01",
                      title: "增长率从哪里来？",
                      desc: "资料分析 · 基期与现期",
                    },
                    {
                      id: "demo-work",
                      n: "02",
                      title: "为什么可以把效率相加？",
                      desc: "数量关系 · 工程问题",
                    },
                    {
                      id: "demo-logic",
                      n: "03",
                      title: "“有些”能推出“所有”吗？",
                      desc: "判断推理 · 集合与逻辑",
                    },
                  ].map((x) => (
                    <button
                      className="start-row"
                      key={x.id}
                      onClick={() => learn(x.id)}
                    >
                      <span>{x.n}</span>
                      <div>
                        <b>{x.title}</b>
                        <small>{x.desc}</small>
                      </div>
                      <ChevronRight size={18} />
                    </button>
                  ))}
                  <div className="demo-note">
                    以上均为项目原创模拟题，不是历年真题。
                  </div>
                </section>
              </div>
              <section className="panel recent-panel">
                <div className="section-title">
                  <h2>我的题库</h2>
                  <button className="link" onClick={() => setPage("questions")}>
                    查看全部 →
                  </button>
                </div>
                {rows(questions.slice(0, 3))}
              </section>
            </>
          ) : page === "questions" ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">QUESTION LIBRARY</div>
                  <h1>题目有出处，学习有依据。</h1>
                  <p>真实资料与原创模拟题分开筛选；状态随题展示。</p>
                </div>
                <button className="primary" onClick={() => setPage("import")}>
                  导入资料
                </button>
              </div>
              <section className="panel">
                <div className="filters">
                  <Search size={18} />
                  <input
                    placeholder="搜索题干、考试或知识点"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                  >
                    {["全部", "真实资料", "模拟训练"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <input
                    placeholder="年份"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  />
                  <input
                    placeholder="地区 / 机构"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                  />
                </div>
                <div className="filter-chips">
                  {["全部", ...modules].map((m) => (
                    <button
                      className={filter === m ? "active" : ""}
                      key={m}
                      onClick={() => setFilter(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {rows(visible)}
              </section>
            </>
          ) : page === "sources" ? (
            <>
              <h1>试卷与来源</h1>
              <p className="muted">
                原始文件保存在本地 uploads，默认不进入 Git。
              </p>
              {sources.map((s) => (
                <section className="panel source-card" key={s.id}>
                  <h2>{s.name}</h2>
                  <p>
                    {s.exam || "考试未填写"} · {s.year || "年份未填写"} ·{" "}
                    {s.region || "机构未填写"}
                  </p>
                  <span>
                    {s._count.questions} 道已入库 · {s._count.drafts} 条提取记录
                  </span>
                  {s.filename && (
                    <a
                      href={"/api/file/" + s.id}
                      target="_blank"
                      rel="noreferrer"
                    >
                      打开原始文件 ↗
                    </a>
                  )}
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noreferrer">
                      核查来源 ↗
                    </a>
                  )}
                </section>
              ))}
            </>
          ) : page === "knowledge" ? (
            <>
              <h1>行测知识地图</h1>
              <p className="muted">
                点击考点查看本地关联题。标记数量只统计实际入库内容。
              </p>
              <div className="knowledge-grid">
                {Object.entries(knowledgeTree).map(([m, ks]) => (
                  <section className="panel" key={m}>
                    <h2>{m}</h2>
                    <div className="knowledge-items">
                      {ks.map((k) => (
                        <button
                          key={k}
                          onClick={() => {
                            setSearch(k);
                            setFilter("全部");
                            setScope("全部");
                            setPage("questions");
                          }}
                        >
                          {k}
                          <span>
                            {questions.filter((q) => q.knowledge === k).length}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </>
          ) : page === "mistakes" ? (
            <>
              <h1>我的错题本</h1>
              <p className="muted">
                保留错误原因与重做记录，掌握状态由你确认。
              </p>
              {mistakes.length ? (
                mistakes.map((q) => (
                  <section className="panel mistake-card" key={q.id}>
                    <span className="pill">{q.knowledge}</span>
                    <h3>{q.stem}</h3>
                    {q.attempts?.map((a) => (
                      <div className="attempt" key={a.id}>
                        <span>
                          {new Date(a.createdAt).toLocaleString("zh-CN")} · 选{" "}
                          {a.selected} · {a.correct ? "正确" : "错误"} ·{" "}
                          {a.elapsed} 秒
                        </span>
                        <p>
                          原因：{a.reason || "未记录"}{" "}
                          {a.mastered ? " · 已掌握" : ""}
                        </p>
                        <button
                          className="link"
                          onClick={async () => {
                            try {
                              await post("attempt-update", {
                                id: a.id,
                                reason: a.reason,
                                mastered: !a.mastered,
                              });
                              await load();
                            } catch (e) {
                              setMessage(String(e));
                            }
                          }}
                        >
                          {a.mastered ? "撤销掌握" : "标记已掌握"}
                        </button>
                      </div>
                    ))}
                    <button className="primary" onClick={() => learn(q.id)}>
                      重新学习与作答 →
                    </button>
                  </section>
                ))
              ) : (
                <div className="panel empty">
                  还没有错题记录。先完成一次练习。
                </div>
              )}
            </>
          ) : page === "stats" ? (
            <>
              <h1>学习统计</h1>
              <p className="muted">
                基于本地真实作答记录；无作答时不生成虚构进度。
              </p>
              <section className="panel">
                <table>
                  <thead>
                    <tr>
                      <th>知识点</th>
                      <th>作答次数</th>
                      <th>正确率</th>
                      <th>平均用时</th>
                      <th>错误次数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(new Set(questions.map((q) => q.knowledge))).map(
                      (k) => {
                        const a = attempts.filter((a) => a.q.knowledge === k),
                          j = a.filter((x) => x.correct !== null);
                        return (
                          <tr key={k}>
                            <td>{k}</td>
                            <td>{a.length}</td>
                            <td>
                              {j.length
                                ? Math.round(
                                    (j.filter((x) => x.correct).length /
                                      j.length) *
                                      100,
                                  ) + "%"
                                : "—"}
                            </td>
                            <td>
                              {a.length
                                ? Math.round(
                                    a.reduce((s, x) => s + x.elapsed, 0) /
                                      a.length,
                                  ) + " 秒"
                                : "—"}
                            </td>
                            <td>
                              {a.filter((x) => x.correct === false).length}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </section>
              <h2>建议复习</h2>
              {rows(mistakes)}
            </>
          ) : (
            <>
              <h1>系统设置</h1>
              <section className="panel settings">
                <h2>AI 模型接口</h2>
                <span className="status">
                  {settings?.configured ? "已配置" : "未配置 · 本地演示可用"}
                </span>
                <p>当前服务：{settings?.base}</p>
                <p>模型：{settings?.model || "未设置"}</p>
                <p>
                  在项目 .env 中配置 AI_BASE_URL、AI_MODEL、AI_API_KEY
                  后重启。密钥只在服务器读取，不返回浏览器。
                </p>
                <p>
                  生成前必须点击“显式发送本题给
                  AI”。生成结果需人工审核，冲突不得发布。
                </p>
              </section>
              <section className="panel settings">
                <h2>当前版本边界</h2>
                <p>
                  已实现：本地题库、PDF/DOCX
                  文本提取与人工校对、原件追溯、三类专用教学模板、答案冲突检查、错题与统计。
                </p>
                <p>
                  后续：扫描件
                  OCR、复杂表格与图形自动结构化、完整模拟考试、个性化复习计划、银行题库。系统当前为本机单用户，请保持仅监听
                  127.0.0.1。
                </p>
              </section>
            </>
          )}
        </main>
        <footer>
          行测思维实验室 <span>认真理解每一步，独立解决下一题。</span>
          <span>原创演示与真题严格区分</span>
        </footer>
      </div>
      {message && (
        <div className="modal-backdrop" onClick={() => setMessage("")}>
          <section
            role="dialog"
            aria-label="操作反馈"
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>操作反馈</h2>
            <pre>{message}</pre>
            <button className="primary" onClick={() => setMessage("")}>
              知道了
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

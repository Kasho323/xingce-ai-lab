"use client";
import { useState, useEffect } from "react";
import { modules, statuses, type DraftData } from "@/core/types";
import { post } from "./Teaching";
type Draft = {
  id: string;
  payload: DraftData;
  warnings: string[];
  sourceId: string;
  source: { name: string; filename: string | null; rawText: string };
};
export function ImportReview({
  notify,
  onRefresh,
}: {
  notify: (s: string) => void;
  onRefresh: () => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [confirm, setConfirm] = useState(false);
  async function load() {
    const r = await fetch("/api/drafts");
    setDrafts(await r.json());
  }
  useEffect(() => {
    void load();
  }, []);
  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/upload", {
        method: "POST",
        body: new FormData(e.currentTarget),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      notify(
        d.duplicate
          ? "此文件已经上传，请在审核队列或试卷列表查看"
          : `已生成 ${d.count} 条待审条目`,
      );
      await load();
      onRefresh();
    } catch (e) {
      notify(String(e));
    } finally {
      setBusy(false);
    }
  }
  function update(id: string, key: string, value: unknown) {
    setDrafts((ds) =>
      ds.map((d) =>
        d.id === id ? { ...d, payload: { ...d.payload, [key]: value } } : d,
      ),
    );
  }
  async function approve(ids: string[]) {
    setBusy(true);
    let saved = 0;
    const errors: string[] = [];
    try {
      for (const id of ids) {
        const draft = drafts.find((d) => d.id === id)!;
        try {
          const r = await post("review", {
            id,
            payload: draft.payload,
            confirmed: confirm,
          });
          saved++;
          if (r.duplicate)
            errors.push(`第 ${draft.payload.number} 题：重复题已跳过`);
        } catch (e) {
          errors.push(`第 ${draft.payload.number} 题：${String(e)}`);
        }
      }
      notify(
        `已处理 ${saved} 条。` +
          (errors.length ? "\n" + errors.join("\n") : ""),
      );
      await load();
      onRefresh();
      setSelected([]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">IMPORT & VERIFY / 资料工作台</div>
          <h1>从你的资料，建立可靠题库。</h1>
          <p>
            原件留存 → 提取题目 → 对照审核 → 入库。导入结果不会自动认证为真题。
          </p>
        </div>
        <span className="status">{drafts.length} 条待核验</span>
      </div>
      <form className="panel upload-form" onSubmit={upload}>
        <div className="upload-zone">
          <b>选择你的试卷或题目资料</b>
          <p>PDF / DOCX / JPG / PNG / TXT · 最大 20 MB、PDF 最多 150 页</p>
          <input
            aria-label="选择试卷文件"
            type="file"
            name="file"
            accept=".pdf,.docx,.png,.jpg,.jpeg,.txt"
            required
          />
          <small>
            图片和扫描件保留原件，当前需人工录入。DOC 请先转换为 DOCX。
          </small>
        </div>
        <div className="form-grid">
          <label>
            资料名称
            <input name="name" placeholder="可留空，使用文件名" />
          </label>
          <label>
            考试名称
            <input name="exam" placeholder="如：2024 年国考行政职业能力测验" />
          </label>
          <label>
            年份
            <input name="year" placeholder="2024" pattern="[0-9]{4}" />
          </label>
          <label>
            地区 / 机构
            <input name="region" placeholder="如：国家公务员局" />
          </label>
          <label className="span2">
            可核查的来源链接
            <input
              name="url"
              type="url"
              placeholder="https://…（用户资料可留空）"
            />
          </label>
        </div>
        <button className="primary" disabled={busy}>
          {busy ? "正在处理…" : "上传并提取题目 →"}
        </button>
      </form>
      <div className="review-heading">
        <h2>
          逐题审核 <small>选中 {selected.length} 条</small>
        </h2>
        <label>
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
          />{" "}
          我已对照原件核对所选题目的文本、选项、页码、图形与答案依据
        </label>
        <button
          className="primary"
          disabled={!confirm || !selected.length || busy}
          onClick={() => approve(selected)}
        >
          批量审核入库
        </button>
      </div>
      {drafts.length === 0 && (
        <div className="panel empty">
          暂无待审核题目。先上传你有权使用的资料。
        </div>
      )}
      {drafts.map((d) => (
        <section className="panel draft-card" key={d.id}>
          <div className="draft-toolbar">
            <label>
              <input
                type="checkbox"
                checked={selected.includes(d.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, d.id]
                      : selected.filter((id) => id !== d.id),
                  )
                }
              />{" "}
              第 {d.payload.number} 题 · {d.source.name}
            </label>
            <a
              href={"/api/file/" + d.sourceId + "#page=" + d.payload.page}
              target="_blank"
              rel="noreferrer"
            >
              对照原始文件 ↗
            </a>
            <button
              onClick={async () => {
                await post("draft-add", { sourceId: d.sourceId });
                await load();
              }}
            >
              人工补充漏题
            </button>
          </div>
          <div className="hint">{d.warnings.join(" ")}</div>
          <div className="form-grid">
            <label>
              题号
              <input
                value={d.payload.number}
                onChange={(e) => update(d.id, "number", e.target.value)}
              />
            </label>
            <label>
              起始页
              <input
                type="number"
                min="1"
                value={d.payload.page}
                onChange={(e) => update(d.id, "page", Number(e.target.value))}
              />
            </label>
            <label>
              结束页
              <input
                type="number"
                min="1"
                value={d.payload.endPage}
                onChange={(e) =>
                  update(d.id, "endPage", Number(e.target.value))
                }
              />
            </label>
            <label>
              类别
              <select
                value={d.payload.module}
                onChange={(e) => update(d.id, "module", e.target.value)}
              >
                {modules.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="span2">
              共享材料 / 表格（文字保真，图形请对照原件）
              <textarea
                value={d.payload.material}
                rows={3}
                onChange={(e) => update(d.id, "material", e.target.value)}
              />
            </label>
            <label className="span2">
              题干
              <textarea
                rows={4}
                value={d.payload.stem}
                onChange={(e) => update(d.id, "stem", e.target.value)}
              />
            </label>
            {(["A", "B", "C", "D"] as const).map((k) => (
              <label key={k}>
                选项 {k}
                <input
                  value={d.payload.options.find((o) => o.key === k)?.text ?? ""}
                  onChange={(e) => {
                    const opts = d.payload.options.filter((o) => o.key !== k);
                    update(
                      d.id,
                      "options",
                      [...opts, { key: k, text: e.target.value }].sort((a, b) =>
                        a.key.localeCompare(b.key),
                      ),
                    );
                  }}
                />
              </label>
            ))}
            <label>
              答案（无法确认留空）
              <select
                value={d.payload.answer ?? ""}
                onChange={(e) => update(d.id, "answer", e.target.value || null)}
              >
                <option value="">待核验</option>
                {["A", "B", "C", "D"].map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <label>
              知识点
              <input
                value={d.payload.knowledge}
                onChange={(e) => update(d.id, "knowledge", e.target.value)}
              />
            </label>
            <label>
              真实性标记
              <select
                value={d.payload.status}
                onChange={(e) => update(d.id, "status", e.target.value)}
              >
                {Object.entries(statuses).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              答案证据
              <input
                value={d.payload.evidence}
                onChange={(e) => update(d.id, "evidence", e.target.value)}
                placeholder="原文件页码、答案出处、核验过程"
              />
            </label>
            <label className="span2">
              参考解析
              <textarea
                value={d.payload.reference}
                onChange={(e) => update(d.id, "reference", e.target.value)}
              />
            </label>
          </div>
          <details>
            <summary>查看原始提取文本（不可改写的原记录）</summary>
            <pre>{d.payload.rawText || d.source.rawText}</pre>
          </details>
          <div className="controls">
            <button
              disabled={busy}
              onClick={async () => {
                try {
                  await post("draft-save", { id: d.id, payload: d.payload });
                  notify("草稿已保存");
                } catch (e) {
                  notify(String(e));
                }
              }}
            >
              保存草稿
            </button>
            <button
              disabled={busy}
              onClick={async () => {
                await post("draft-reject", { id: d.id });
                await load();
              }}
            >
              丢弃条目
            </button>
            <button
              className="primary"
              disabled={!confirm || busy}
              onClick={() => approve([d.id])}
            >
              审核并入库
            </button>
          </div>
        </section>
      ))}
    </>
  );
}

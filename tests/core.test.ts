import { describe, it, expect } from "vitest";
import { extractQuestions } from "../src/core/extract";
import { demos } from "../src/core/demos";
import { validateLesson, publishable } from "../src/core/quality";
import { fingerprint } from "../src/server/fingerprint";
describe("题目边界与来源", () => {
  it("一页多题与答案区分离", () => {
    const r = extractQuestions([
      {
        page: 3,
        text: "根据下列材料：某馆数据\n1. 上年200本今年250本，增长率？\nA. 20% B. 25% C. 50% D. 125%\n2. 今年与上年之比？\nA. 20% B. 25% C. 50% D. 125%\n参考答案\n1. B\n2. D\n",
      },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0].data.answer).toBe("B");
    expect(r[1].data.answer).toBe("D");
    expect(r[0].data.page).toBe(3);
    expect(r[1].data.material).toContain("某馆数据");
    expect(r[0].data.options).toHaveLength(4);
  });
  it("跨页题保留范围且不编答案", () => {
    const r = extractQuestions([
      { page: 1, text: "1. 一个跨页的题干\nA. 甲 B. 乙" },
      { page: 2, text: "C. 丙 D. 丁" },
    ]);
    expect(r[0].data.endPage).toBe(2);
    expect(r[0].data.answer).toBeNull();
  });
  it("没有题号时不将整页伪装成题目", () =>
    expect(
      extractQuestions([{ page: 1, text: "一段模糊扫描识别文字" }]),
    ).toEqual([]));
  it("重复检测忽略空格和全半角", () =>
    expect(fingerprint("题干 ２００", [])).toBe(fingerprint("题干200", [])));
  it("资料分析同问法但材料不同不得误判重复", () =>
    expect(fingerprint("以下哪项正确", [], "材料甲")).not.toBe(
      fingerprint("以下哪项正确", [], "材料乙"),
    ));
});
describe("教学质量与发布门禁", () => {
  for (const d of demos)
    it(d.id + " 的计算与答案一致", () =>
      expect(publishable(d.lesson, d.question.answer, true).status).toBe(
        "APPROVED",
      ),
    );
  it("参考答案冲突拦截", () =>
    expect(validateLesson(demos[0].lesson, "A").status).toBe("BLOCKED"));
  it("未确认答案拦截", () =>
    expect(validateLesson(demos[0].lesson, null).status).toBe("BLOCKED"));
  it("没有人工审核不能发布", () =>
    expect(publishable(demos[0].lesson, "B", false).status).toBe(
      "REVIEW_REQUIRED",
    ));
  it("计算错误拦截", () => {
    const l = structuredClone(demos[0].lesson);
    l.claims[0].result = 51;
    expect(validateLesson(l, "B").status).toBe("BLOCKED");
  });
  it("除零拦截", () => {
    const l = structuredClone(demos[0].lesson);
    l.claims = [{ op: "divide", a: 1, b: 0, result: 0 }];
    expect(validateLesson(l, "B").status).toBe("BLOCKED");
  });
  it("图示与数据不一致拦截", () => {
    const l = structuredClone(demos[0].lesson);
    l.data.rate = 0.2;
    expect(validateLesson(l, "B").status).toBe("BLOCKED");
  });
  it("图示缺少关键比例时拦截", () => {
    const l = structuredClone(demos[0].lesson);
    delete l.data.rate;
    expect(validateLesson(l, "B").status).toBe("BLOCKED");
  });
  it("未经确认的逻辑模板拦截", () => {
    const l = structuredClone(demos[2].lesson);
    l.data.template = 2;
    expect(validateLesson(l, "C").status).toBe("BLOCKED");
  });
  it("用有限模型验证逻辑题必然选项和反例", () => {
    const models: number[][] = [];
    for (let t = 0; t < 8; t++)
      for (let p = 0; p < 8; p++)
        for (let c = 0; c < 8; c++) {
          if ((t & ~p) === 0 && (p & c) !== 0) models.push([t, p, c]);
        }
    expect(models.every(([, p, c]) => (c & p) !== 0)).toBe(true);
    expect(
      models.some(
        ([t, p, c]) => (p & ~t) !== 0 && (t & c) === 0 && (c & ~t) !== 0,
      ),
    ).toBe(true);
  });
});

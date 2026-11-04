import { z } from "zod";
export const modules = [
  "资料分析",
  "数量关系",
  "判断推理",
  "言语理解",
  "常识与政治",
  "政治理论",
  "常识判断",
  "英语能力",
  "经济金融",
] as const;
export const statuses: Record<string, string> = {
  RECALLED: "历年题公开整理/回忆版 · 参考答案未全面复核",
  VERIFIED: "已核验真题",
  SOURCE_PENDING: "来源明确 · 答案待核验",
  USER_UPLOAD: "用户上传 · 非官方认证",
  SIMULATION: "原创模拟训练",
};
export const stepSchema = z.object({
  title: z.string().min(1),
  explanation: z.string().min(10),
  formula: z.string().optional(),
  hint: z.string().min(1),
  highlights: z.array(z.string()).default([]),
});
export const lessonSchema = z.object({
  kind: z.enum(["growth", "work", "logic", "text"]),
  answer: z.enum(["A", "B", "C", "D"]),
  steps: z.array(stepSchema).min(2),
  fast: z.string(),
  examiner: z.string(),
  distractors: z.array(z.string()),
  transfer: z.string(),
  provenance: z.enum(["source-adapted", "independently-checked"]).optional(),
  notebook: z
    .object({
      resourceId: z.string(),
      page: z.number().int().positive(),
      endPage: z.number().int().positive(),
      title: z.string(),
      relation: z.enum(["direct", "related", "not-covered"]),
      reason: z.string(),
    })
    .optional(),
  sourceResourceId: z.string().optional(),
  answerPage: z.number().int().positive().optional(),
  answerEndPage: z.number().int().positive().optional(),
  teachingTable: z
    .object({
      title: z.string(),
      headers: z.array(z.string()).min(2).max(6),
      rows: z.array(z.array(z.string()).min(2).max(6)).min(1).max(15),
    })
    .optional(),
  assets: z.array(z.string().regex(/^[a-zA-Z0-9_-]+\.png$/)).optional(),
  illustration: z
    .discriminatedUnion("type", [
      z.object({
        type: z.literal("parts"),
        first: z.string(),
        second: z.string(),
        firstParts: z.number().int().min(1).max(12),
        secondParts: z.number().int().min(1).max(12),
        gap: z.number().positive(),
        removed: z.number().nonnegative(),
        unit: z.string(),
      }),
      z.object({
        type: z.literal("growth"),
        base: z.number().positive(),
        current: z.number().nonnegative(),
        baseLabel: z.string(),
        currentLabel: z.string(),
        unit: z.string(),
      }),
      z.object({
        type: z.literal("work"),
        a: z.number().positive(),
        b: z.number().positive(),
        days: z.number().positive(),
        first: z.string(),
        second: z.string(),
        unit: z.string(),
      }),
      z.object({
        type: z.literal("implication"),
        edges: z
          .array(
            z.object({ from: z.string(), to: z.string(), reason: z.string() }),
          )
          .min(1),
        conclusion: z.string(),
      }),
    ])
    .optional(),
  diagram: z
    .object({
      type: z.enum(["evidence", "calculation"]),
      nodes: z
        .array(z.object({ label: z.string().min(1), text: z.string().min(1) }))
        .min(2),
      series: z
        .array(z.object({ label: z.string(), value: z.number().finite() }))
        .optional(),
    })
    .optional(),
  data: z.record(z.string(), z.number()).default({}),
  claims: z
    .array(
      z.object({
        op: z.enum(["add", "subtract", "multiply", "divide"]),
        a: z.number(),
        b: z.number(),
        result: z.number(),
      }),
    )
    .default([]),
});
export type Lesson = z.infer<typeof lessonSchema>;
export const draftSchema = z.object({
  number: z.string().min(1),
  page: z.number().int().positive(),
  endPage: z.number().int().positive(),
  // A complete analogy stem can be as short as “花椒：麻”. Completeness also
  // depends on the four options and evidence, not an arbitrary stem length.
  stem: z.string().trim().min(1),
  material: z.string().default(""),
  options: z
    .array(
      z.object({ key: z.enum(["A", "B", "C", "D"]), text: z.string().min(1) }),
    )
    .length(4)
    .refine(
      (x) => new Set(x.map((o) => o.key)).size === 4,
      "选项必须为 A、B、C、D",
    ),
  answer: z.enum(["A", "B", "C", "D"]).nullable(),
  evidence: z.string().default(""),
  module: z.enum(modules),
  knowledge: z.string().default("待分类"),
  reference: z.string().default(""),
  rawText: z.string(),
  status: z
    .enum([
      "VERIFIED",
      "SOURCE_PENDING",
      "USER_UPLOAD",
      "SIMULATION",
      "RECALLED",
    ])
    .default("USER_UPLOAD"),
});
export type DraftData = z.infer<typeof draftSchema>;
export type QuestionView = DraftData & {
  id: string;
  sourceId: string;
  quality: string;
  lesson: Lesson | null;
  source: {
    id: string;
    name: string;
    exam: string;
    year: number | null;
    region: string;
    url: string;
    filename: string | null;
    rights: string;
  };
  attempts?: {
    id: string;
    selected: string;
    correct: boolean | null;
    reason: string;
    elapsed: number;
    mastered: boolean;
    createdAt: string;
  }[];
};

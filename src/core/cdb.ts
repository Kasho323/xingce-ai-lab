export type StudyResource = {
  id: string;
  name: string;
  path: string;
  originalPath?: string;
  extension: string;
  pages: number;
  textChars: number;
  scanPages: number[];
  priority: "先学" | "有帮助" | "按需";
  module: string;
  reason: string;
  goal: string;
  startPage: number;
  endPage: number;
  warnings: string[];
  questionIds: string[];
  hash: string;
};
export type StudyTask = {
  id: string;
  stage: number;
  title: string;
  minutes: number;
  resourceId: string;
  startPage: number;
  endPage: number;
  action: string;
  check: string;
  questionIds: string[];
};
export type StudyIssue = {
  title: string;
  detail: string;
  resourceId: string;
  page: number;
};
export type StudyCatalog = {
  dailyPlan?: import("./guokao").StudyDay[];
  writing?: import("./guokao").WritingExercise[];
  papers?: import("./guokao").StudyPaper[];
  coverageNote?: string;
  createdAt: string;
  root: string;
  resources: StudyResource[];
  tasks: StudyTask[];
  issues: StudyIssue[];
  stats: {
    files: number;
    pdfs: number;
    pages: number;
    textFiles: number;
    imageOnly: number;
    deferred: number;
    duplicateGroups: number;
  };
  questionIds: string[];
  official: { url: string; note: string; checkedAt: string };
  assets?: { name: string; resourceId: string; page: number }[];
};
export type StudyProgress = {
  done?: boolean;
  page?: number;
  notes?: string;
  answer?: string;
};
export const studyPrinciples = [
  {
    title: "先测，再补",
    body: "先做少量代表题，用错误定位知识缺口。不要先从头读完几千页资料。",
  },
  {
    title: "材料驱动写作",
    body: "先审清对象、任务和字数，再把材料信息归类。结构和论证比套用万能句更重要。",
  },
  {
    title: "复盘必须能复述",
    body: "合上解析，写清比较基准、关键关系或排除理由；只认出答案不算掌握。",
  },
];

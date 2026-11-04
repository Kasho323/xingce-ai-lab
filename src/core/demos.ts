import type { DraftData, Lesson } from "./types";
const base = {
  page: 1,
  endPage: 1,
  material: "",
  evidence: "项目原创；答案已通过确定性计算或逻辑论证复核。不是历年真题。",
  status: "SIMULATION" as const,
  reference: "",
  rawText: "",
};
export const demos: { id: string; question: DraftData; lesson: Lesson }[] = [
  {
    id: "demo-growth",
    question: {
      ...base,
      number: "01",
      stem: "某图书馆上年借阅量为 200 万册，本年为 250 万册。本年借阅量比上年增长了百分之几？",
      module: "资料分析",
      knowledge: "增长率",
      options: [
        { key: "A", text: "20%" },
        { key: "B", text: "25%" },
        { key: "C", text: "50%" },
        { key: "D", text: "125%" },
      ],
      answer: "B",
    },
    lesson: {
      kind: "growth",
      answer: "B",
      data: { base: 200, current: 250, rate: 0.25 },
      steps: [
        {
          title: "先找到比较的起点",
          explanation:
            "“比上年增长”表示以上年为比较基础。上年 200 万册是基期量，本年 250 万册是现期量。所求是增加的部分占上年的比例。",
          hint: "谁跟谁比较？“比”后面的上年是分母。",
          highlights: ["200", "250", "比上年"],
        },
        {
          title: "把现期拆成两部分",
          explanation:
            "本年借阅量 = 上年原有的量 + 增加的量。先把共同的 200 万册对齐，剩余的 50 万册就是增长量。",
          formula: "250 = 200 + 50",
          hint: "增长量是差，不是比例。",
          highlights: ["200", "250"],
        },
        {
          title: "用基期衡量新增部分",
          explanation:
            "每 200 万册增加 50 万册，所以增长率是 50 ÷ 200。分子分母单位相同，相除后没有“万册”单位。",
          formula: "r=\\frac{250-200}{200}=\\frac{50}{200}=25\\%",
          hint: "不要用现期 250 作分母。",
          highlights: ["百分之几"],
        },
        {
          title: "检验并迁移",
          explanation:
            "200 × (1 + 25%) = 250，回代成立，选择 B。增长量 50 万册与增长率 25% 是不同概念。",
          formula: "200(1+25\\%)=250",
          hint: "用结果回到题目条件检验。",
          highlights: [],
        },
      ],
      fast: "选项比较：50 是 200 的四分之一，因此直接得到 25%。这里数字可整除；数字复杂时要确认估算误差小于选项间距，不能机械约分到错误精度。",
      examiner:
        "教学推断：通过“比上年”检查比较基准，通过同一组数据区分增长量与增长率。关键突破口是确定基期。",
      distractors: [
        "A：以现期作分母，50÷250=20%。",
        "B：以基期作分母，正确。",
        "C：把增长量数值 50 误写成百分数。",
        "D：把现期与基期之比 125% 当作增长率。",
      ],
      transfer:
        "把问法改为“增长了多少万册”，答案是 50 万册；改为“本年是上年的百分之几”，答案是 125%。这三问共用数据，但所求不同。",
      claims: [
        { op: "subtract", a: 250, b: 200, result: 50 },
        { op: "divide", a: 50, b: 200, result: 0.25 },
      ],
    },
  },
  {
    id: "demo-work",
    question: {
      ...base,
      number: "02",
      stem: "一项工程，甲单独完成需要 6 天，乙单独完成需要 3 天。两人效率恒定且合作无损耗，同时开工，几天可以完成？",
      module: "数量关系",
      knowledge: "工程问题",
      options: [
        { key: "A", text: "1 天" },
        { key: "B", text: "2 天" },
        { key: "C", text: "3 天" },
        { key: "D", text: "4.5 天" },
      ],
      answer: "B",
    },
    lesson: {
      kind: "work",
      answer: "B",
      data: { a: 6, b: 3, days: 2 },
      steps: [
        {
          title: "把工作总量看成一整份",
          explanation:
            "总工作量没有给具体数值，可以设为 1。题目明确效率恒定、合作无损耗，才能将每天完成的份额相加。",
          hint: "先检查合作效率可相加的条件。",
          highlights: ["效率恒定", "无损耗"],
        },
        {
          title: "时间换成每天的效率",
          explanation:
            "甲 6 天完成 1 份，每天完成 1/6；乙 3 天完成 1 份，每天完成 1/3。注意效率与用时成反比。",
          formula: "v_甲=\\frac16,\\quad v_乙=\\frac13",
          hint: "用时更少的人每天做得更多。",
          highlights: ["6", "3"],
        },
        {
          title: "合并每天完成的工作",
          explanation:
            "用六等份表示整项工程，甲每天完成一格，乙每天完成两格，合作每天完成三格，也就是总工程的一半。",
          formula: "v=\\frac16+\\frac13=\\frac12",
          hint: "先通分，再相加。",
          highlights: [],
        },
        {
          title: "从效率还原用时",
          explanation:
            "每天做一半，2 天做完。甲完成 2/6，乙完成 2/3，两者合计为 1。选择 B。",
          formula: "t=\\frac{1}{1/2}=2",
          hint: "合作用时应小于较快一人的 3 天。",
          highlights: [],
        },
      ],
      fast: "赋值法：取 6 为总工作量，则甲每天做 1，乙每天做 2，合作 6÷3=2 天。总量可以任选正数，但必须统一单位；效率变化或合作损耗时不能直接相加。",
      examiner:
        "教学推断：条件“效率恒定且无损耗”保证效率相加，题目检查时间到效率的转换。",
      distractors: [
        "A：可能重复加倍合作效率。",
        "B：每天完成一半，正确。",
        "C：只计算乙的单独用时。",
        "D：将两人的天数取平均，混淆时间与效率。",
      ],
      transfer:
        "若甲先做 1 天，再由两人合作，剩余 5/6，合作还需 (5/6)÷(1/2)=5/3 天。先扣已完成工作，再计算剩余时间。",
      claims: [
        { op: "add", a: 1 / 6, b: 1 / 3, result: 0.5 },
        { op: "divide", a: 1, b: 0.5, result: 2 },
      ],
    },
  },
  {
    id: "demo-logic",
    question: {
      ...base,
      number: "03",
      stem: "所有参加集训的同学都完成了基础练习。有些完成基础练习的同学参加了竞赛。根据以上条件，以下哪项必然成立？",
      module: "判断推理",
      knowledge: "翻译推理",
      options: [
        { key: "A", text: "所有完成基础练习的同学都参加了集训" },
        { key: "B", text: "有些参加集训的同学参加了竞赛" },
        { key: "C", text: "有些参加竞赛的同学完成了基础练习" },
        { key: "D", text: "所有参加竞赛的同学都参加了集训" },
      ],
      answer: "C",
    },
    lesson: {
      kind: "logic",
      answer: "C",
      data: { template: 1 },
      steps: [
        {
          title: "区分全称与存在条件",
          explanation:
            "“所有”描述集合包含关系，“有些”说明至少存在一个对象。问题问“必然”，只要存在反例，选项就不能成立。",
          hint: "有些表示至少一个，不能扩大成所有。",
          highlights: ["所有", "有些", "必然"],
        },
        {
          title: "翻译第一个条件",
          explanation:
            "集训者都在完成练习者之中，即“集训 → 完成练习”。逆向关系没有得到保证，不能从完成练习推出参加集训。",
          formula: "T\\subseteq P",
          hint: "箭头不能随意掉头。",
          highlights: ["所有参加集训"],
        },
        {
          title: "抓住已存在的交集",
          explanation:
            "第二条件保证练习者与竞赛者有交集。同一个交集对象既参加竞赛，也完成练习，所以 C 必然成立。",
          formula: "P\\cap C\\ne\\varnothing",
          hint: "“有些 P 是 C”可换位为“有些 C 是 P”。",
          highlights: ["有些完成基础练习"],
        },
        {
          title: "构造反例排除其他项",
          explanation:
            "可以让参加集训者只有甲，参加竞赛者只有乙，两人均完成练习。所有条件都成立，但 A、B、D 都不成立。图中交集点不代表它必须属于集训集合。",
          hint: "一个符合全部条件的反例足以否定“必然”。",
          highlights: [],
        },
      ],
      fast: "先看带“有些”的条件：存在命题可以换位，因此 C 直接成立。只适用于“有些 A 是 B”的肯定存在命题；“所有 A 是 B”不能据此换成“所有 B 是 A”。",
      examiner:
        "教学推断：用共同的“完成练习”诱导错误连接集训与竞赛，检查集合包含与存在命题换位。",
      distractors: [
        "A：把充分条件错误倒置。",
        "B：将两个与练习有关的集合强行连接。",
        "C：同一交集对象换位，正确。",
        "D：将存在条件扩大为全称并强行连接集合。",
      ],
      transfer:
        "若增加“所有完成练习的同学都参加集训”，练习与集训成为同一集合，这时 B 才可以由存在条件推出。",
      claims: [],
    },
  },
];

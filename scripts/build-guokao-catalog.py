from pathlib import Path
from datetime import date, timedelta
from collections import Counter
import json, re, shutil
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'data/guokao'
def read(p):return json.loads(p.read_text(encoding='utf8'))
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf8')
entries=read(OUT/'candidates.json'); issues=read(OUT/'issues.json')
overrides=read(OUT/'lesson-overrides.json') if (OUT/'lesson-overrides.json').exists() else {}
ready=[]
for e in entries:
    if e['id'] in overrides:e['lesson'].update(overrides[e['id']])
    images=set(re.findall(r'\[\[asset:([^\]]+)\]\]',json.dumps(e,ensure_ascii=False)))
    missing=[x for x in images if not (OUT/'assets'/x).is_file()]
    if missing:issues.append({'id':e['id'],'reason':'原图/公式缺失，暂不进入练习','assets':missing});continue
    ready.append(e)
save(OUT/'bank.json',ready);save(OUT/'quarantine.json',issues)
notesdir=OUT/'originals';notesdir.mkdir(exist_ok=True)
oldpath=ROOT/'data/cdb/catalog.json'
if not oldpath.exists():oldpath=ROOT/'data/archive/cdb-2026-11-03/catalog.json'
old=read(oldpath)
resources=[r for r in old['resources'] if r['id'].startswith('notes-')]
for r in resources:
    oldfile=oldpath.parent/'originals'/r['path']
    dest=notesdir/r['path']
    if not dest.exists():shutil.copy2(oldfile,dest)
    r['questionIds']=[];r['reason']='个人知识笔记，供国考方法复习';r['goal']='按真题暴露出的知识缺口定位阅读'

writing=read(OUT/'writing.json')
for w in writing:
    if w['year']==2023 and w['number'] in [2,4]:w['topic']='贯彻执行'
    if w['year']==2023 and w['number']==1:w['topic']='归纳概括'
    w['guide'].append('这是基于公开回忆材料的教学方法，未取得官方评分细则，不据此自动估分。')

# Specific material-to-point examples are teaching interpretations, not official keys.
evidence={
 'gk-writing-2024-1':[('和村民一起动手','以共创代替单向授课，尊重村民主体，形成参与和认同。'),('毛竹和石头','就地取材、低成本改造，把审美提升落到村民日常生活。'),('传统习俗','保护与活化本土文脉，结合非遗活动和现代展示形成持续运营。')],
 'gk-writing-2025-1':[('柳川河','顺应土壤、水源等自然条件选择适宜品种。'),('漏斗架','通过传统栽培结构利用空间、光照，兼顾抗风、水土保持。'),('喜阴植物','利用葡萄架小气候发展复合种植与休闲活动。'),('农家肥','利用本地有机资源，形成低投入、绿色循环的生产方式。'),('碳库','保留多年生植被并让修剪物回归土壤，增加碳储存。')],
 'gk-writing-2025-4':[('第一发球员','案由：科学家掌握源头知识，公众理解有助科学发展；现有评价与传播链仍有障碍。'),('评价体系','建议：将科普贡献纳入合理评价与激励，减轻对从事科普的偏见。'),('二传手','建议：建立科学家与专业传播人员协作机制，兼顾准确和通俗。'),('二次传播','建议：做好后续传播审核与纠错，减少伪科学和信息失真。')]
}
for w in writing:
    if w['id'] in evidence:
        w['evidence']=[{'quote':q,'point':p} for q,p in evidence[w['id']]]
        assert all(e['quote'] in w['material'] for e in w['evidence'])

focus=[
 ('增长率、基期现期','逻辑填空'),('图推·数量、图推·对称','工程问题、比例赋值'),('主旨概括、意图判断','比重'),('翻译推理、日常结论','行程问题'),('定义判断、类比推理','平均数、倍数'),('排列组合、概率','语句排序、语句衔接'),
 ('整卷','复盘'),('图推·位置、图推·样式','利润问题、方程建模'),('加强论证、削弱论证','增长量、混合增长'),('细节判断、标题选择','容斥原理、最值问题'),('排列约束','综合判断、读表与比较'),('图推·空间重构、图推·笔画与连通','几何问题、整除余数'),('逻辑填空、主旨概括','日期周期、年龄问题'),
 ('整卷','复盘'),('比重、平均数','翻译推理、解释评价'),('图推·属性与功能、图推·综合规律','排列组合、概率'),('意图判断、细节判断','增长率、增长量'),('定义判断、类比推理','工程问题、行程问题'),('排列约束、加强论证、削弱论证','利润问题、最值问题'),('语句衔接、语句排序','综合判断、倍数'),
 ('整卷','复盘'),('申论整卷','复盘'),('错因查漏','真题迁移'),('整卷','复盘'),('高频错题','方法回忆'),('考前回收','节奏与准备')]
reserved={6:2021,13:2023,20:2025,23:2026}
used=set();days=[]
def select(topics,n,extra=False):
    candidates=[e for e in ready if e['source']['year'] not in reserved.values() and (e['question']['knowledge'] in topics or (extra and e['question']['module'] in topics)) and e['id'] not in used]
    if not candidates:
        # A second pass is deliberate review, never a generated replacement question.
        candidates=[e for e in ready if e['source']['year'] not in reserved.values() and (e['question']['knowledge'] in topics or (extra and e['question']['module'] in topics))]
    candidates.sort(key=lambda e:(-e['source']['year'],e['id']))
    # Round-robin across requested topics, then fill with remaining candidates.
    picked=[]
    while candidates and len(picked)<n:
        for t in topics:
            found=next((e for e in candidates if e['question']['knowledge']==t or e['question']['module']==t),None)
            if found and len(picked)<n:picked.append(found);candidates.remove(found)
        if not topics:break
    used.update(e['id'] for e in picked)
    return [e['id'] for e in picked]
for i,(a,b) in enumerate(focus):
    dt=str(date(2026,11,3)+timedelta(days=i));tasks=[]
    def task(key,title,minutes,kind,action,check,ids=None,topics=None,wid=None):
        tasks.append({'id':f'gk-{dt}-{key}','title':title,'minutes':minutes,'kind':kind,'action':action,'check':check,'questionIds':ids or [],'topics':topics or [],**({'writingId':wid} if wid else {})})
    w=writing[(i%15)]
    if i in reserved:
        y=reserved[i];ids=[e['id'] for e in ready if e['source']['year']==y]
        task('paper',f'{y} 地市级整卷整理训练',120,'practice','按来源整理顺序连续作答；这不是与原卷题号、版式完全一致的仿真卷。限时由你按120分钟控制，完成后再展开解析。','统计各模块正确率与用时，标出超时题。',ids)
        task('review','整卷复盘',60,'review','先重做错误与超时题，再核对解析；每道错题写出一个具体错因。','能在不看答案时说清依据。')
        task('writing','申论小题或作文提纲',60,'writing','按原题限定范围完成作答或提纲，标出每条材料依据。','检查对象、要点、字数和逻辑。',wid=w['id'])
    elif i==21:
        task('writing','2025 地市级申论整卷',180,'writing','从2025年第1题进入，依次完成同年5题；先独立写完，再看教学提示。','全卷180分钟，逐题保存，检查全部字数要求。',wid='gk-writing-2025-1')
        task('review','申论材料对照复盘',40,'reading','对照原材料，分别圈出漏点、无依据扩写、重复点；重写一题。','列出三条下次能够执行的改进。')
        task('politics','政治理论回顾',20,'practice','回顾近年题中的概念辨析；旧题按原年份理解。','说明错误选项具体错在哪里。',select(['政治理论'],5,True))
    else:
        ta=a.split('、');tb=b.split('、')
        if i>=22:
            ta=['方程建模','比例赋值','主旨概括','逻辑填空'];tb=['增长率','比重','翻译推理','图推·综合规律']
        idsA=select(ta,14);idsB=select(tb,10)
        task('foundation','政治理论与常识',20,'practice','先做6题并逐项辨析。对时效性内容，记录题目年份，另查正式文件；不要只记选项字母。','讲清一条概念边界。',select(['政治理论','常识判断'],6,True))
        task('focus',a,60,'practice','限时作答后逐步复盘。每个方法至少比较另一年同考点真题；没题覆盖的细项从知识清单补方法。','能解释为什么这样建模或排除选项。',idsA,ta)
        task('transfer',b,50,'practice','先独立作答，再看解析和对应笔记；写出与上一道题相比改变的条件。','换一道历年题仍能独立使用同一方法。',idsB,tb)
        task('review','间隔复习与错因记录',30,'review','重做到期错题。首次隔1天，答对后隔3天、再隔7天；没有到期错题时回顾今天超时题。','写出错误发生在哪一步，独立重做再标记掌握。')
        task('writing',f'申论 · {w["topic"]}',80,'writing','先读题，再按范围读材料；独立作答、对照材料、修改一稿。重复遇到同题时必须闭卷重写并比较两稿。','每个要点有材料依据，文种、对象和字数符合题设。',wid=w['id'])
    assert sum(t['minutes'] for t in tasks)==240
    days.append({'date':dt,'title':f'第{i+1}天 · '+('整卷与复盘' if i in reserved else a),'tasks':tasks})
assets=read(OUT/'assets-manifest.json')
catalog={'createdAt':'2026-11-03','root':str(notesdir),'resources':resources,'questionIds':[e['id'] for e in ready],'assets':[{'name':x['name'],'resourceId':'','page':1} for x in assets if (OUT/'assets'/x['name']).exists()], 'tasks':[], 'issues':[{'title':x['id'] if 'id' in x else '来源问题','detail':x['reason'],'resourceId':'','page':1} for x in issues], 'stats':{'files':59,'pdfs':2,'pages':159,'textFiles':59,'imageOnly':0,'deferred':len(issues),'duplicateGroups':0}, 'official':{'url':'https://shanghai.chinatax.gov.cn/tax/xxgk/rsxx/202610/t481763.html','note':'2027年度国考，2026-11-29考试；地市级。题库为公开整理/回忆版，非官方原卷认证。','checkedAt':'2026-11-03'},'dailyPlan':days,'writing':writing,'papers':[{'year':y,'questionIds':[e['id'] for e in ready if e['source']['year']==y],'note':'按模块整理；来源序号不是原卷题号，完整性仅表示与本次来源快照一致。'} for y in range(2017,2027)],'coverageNote':'按考试大纲的六个行测模块及申论建立复习清单；不承诺穷尽未来考点。题数为本地完整呈现的来源记录数，解析多数为来源整理，尚未全部独立复核。'}
for d in days:
    for t in d['tasks']:catalog['tasks'].append({**t,'stage':int(d['date'][-2:])-2,'resourceId':'','startPage':1,'endPage':1})
save(OUT/'catalog.json',catalog)
print(json.dumps({'ready':len(ready),'quarantined':len(issues),'days':len(days),'tasks':len(catalog['tasks']),'writing':len(writing),'modules':Counter(e['question']['module'] for e in ready)},ensure_ascii=False))

"""Build a PRIVATE, traceable recall-paper corpus. Never invent missing questions.
Text snapshots must already exist in data/guokao/raw; remote image downloads are
limited to the image paths actually referenced in those snapshots.
"""
from pathlib import Path
import re, json, html, hashlib, urllib.request, urllib.parse, time, io, argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/guokao'
ASSETS = {}
def save(name, value):
    (OUT/name).parent.mkdir(parents=True, exist_ok=True)
    (OUT/name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

def clean(value):
    def image(m):
        src = re.search(r'src=["\']([^"\']+)', m.group(0))
        if not src or not src[1].startswith('../90-图片/'):
            return '[原图路径异常，待核验]'
        remote = src[1][3:]
        name = 'gk-' + hashlib.sha256(remote.encode()).hexdigest()[:24] + '.png'
        ASSETS[name] = {'name': name, 'remote': remote, 'formula': '公式图/' in remote}
        return '[[asset:' + name + ']]'
    value = re.sub(r'<img\b[^>]*>', image, value, flags=re.I)
    value = re.sub(r'</(?:p|div|tr)>|<br\s*/?>', '\n', value, flags=re.I)
    value = re.sub(r'</t[dh]>', ' | ', value, flags=re.I)
    value = re.sub(r'<[^>]+>', '', value)
    value = html.unescape(value).replace('\u00a0',' ').replace('✅','')
    value = re.sub(r'\n\s*---+\s*(?=\n|$)', '\n', value)
    value = re.sub(r'\n{3,}', '\n\n', value).strip()
    return value

# Labels describe the method actually used. Source labels are retained separately
# because several source entries classify constraint questions as analogy questions.
def classify(module, subtype, stem, ref, material):
    t = stem + '\n' + ref
    if module == '资料分析' and not re.search(r'材料|统计|[Ss]省|全国|全[市省国]|表|图|20\d{2}年|上年|同比|环比', stem) and ('设' in ref and '解得' in ref):
        module = '数量关系'
    if module == '数量关系':
        rules = [('容斥原理',r'容斥|都会|至少.*种|只会.*种|集合'),('概率',r'概率'),('排列组合',r'多少种|几种|种不同|排列|组合|安排方式'),('工程问题',r'工程|单独完成|合作完成|合做|工作效率|生产线|生产效率'),('行程问题',r'跑道|相遇|追及|追上|行驶|车速|匀速|路程|航行'),('利润问题',r'利润|盈利|亏损|售价|成本|打折|折扣|营业额'),('溶液问题',r'浓度|溶液|盐水|混合液'),('几何问题',r'圆[形柱锥]|正方[形体]|长方[形体]|三角形|面积|体积|直角|周长'),('日期周期',r'星期|周[一二三四五六日]|周期|每隔|最后一次'),('年龄问题',r'年龄|岁'),('比例赋值',r'比重|比例|占比|百分|百分之'),('最值问题',r'至少|至多|最多|最少|最大|最小'),('整除余数',r'余数|整除|倍数|余下')]
        return module, next((k for k,p in rules if re.search(p,t)), '方程建模')
    if module == '判断推理':
        if '图形' in subtype:
            rules=[('图推·笔画与连通',r'一笔|两笔|笔画|奇点'),('图推·对称',r'轴对称|中心对称|对称轴'),('图推·空间重构',r'立方体|六面体|折叠|展开图|截面|三视图'),('图推·位置',r'旋转|平移|翻转'),('图推·样式',r'求同|求异|叠加|遍历|黑白运算'),('图推·数量',r'数量|交点|直线|曲线|封闭|面的个数'),('图推·属性与功能',r'曲直|开闭|功能|标记')]
            return module,next((k for k,p in rules if re.search(p,ref)), '图推·综合规律')
        if material and (re.search(r'分管|结对|安排|比赛|排序|编号|星期|小组|名次',material)):
            return module,'排列约束'
        if '定义' in subtype or '根据上述定义' in stem: return module,'定义判断'
        if '类比' in subtype and not material: return module,'类比推理'
        for k,p in [('削弱论证',r'削弱|质疑|反驳'),('加强论证',r'加强|支持.*结论|前提|假设'),('解释评价',r'解释|评价|争论'),('真假推理',r'真假|只有.*真|只有.*假'),('排列约束',r'排列|排序|匹配|排除法.*条件'),('翻译推理',r'充分|必要|逆否|如果|只有|所有|有些')]:
            if re.search(p,stem+'\n'+ref[:180]):return module,k
        return module,'日常结论'
    if module == '言语理解':
        if subtype=='逻辑填空':return module,'逻辑填空'
        if subtype=='语句表达':
            return module,'语句排序' if re.search('排序|排列',stem) else '语句衔接'
        for k,p in [('逻辑填空',r'填入.*最恰当|填入.*依次|依次填入|逻辑填空'),('语句排序',r'排列|排序|重新排列'),('语句衔接',r'接下来|接着|横线处|衔接'),('细节判断',r'不符合|不正确|无法|不能|正确的一项|理解正确'),('词句理解',r'一词|这句话|词语|理解.*含义'),('标题选择',r'标题'),('意图判断',r'意在|意图|旨在')]:
            if re.search(p,stem+subtype):return module,k
        return module,'主旨概括'
    if module == '资料分析':
        for k,p in [('混合增长',r'混合|混合增长'),('隔年增长',r'隔年'),('比重',r'比重|占.*%|占.*百分|占.*比例'),('平均数',r'平均|人均|单价'),('倍数',r'倍'),('增长量',r'增量|增长量|增加.*万|减少.*万|增加.*亿'),('增长率',r'增速|增长率|下降.*%|同比.*增长'),('基期现期',r'基期|现期'),('综合判断',r'正确的是|正确的有|不能|能够.*推出|折线图|反映.*趋势')]:
            if re.search(p,stem+'\n'+ref[:170]):return module,k
        return module,'读表与比较'
    if module == '政治理论':
        for k,p in [('生态文明',r'生态|绿色|环境'),('经济发展',r'经济|产业|高质量|生产力|市场'),('国家治理',r'法治|治理|安全|人民民主'),('党的建设',r'党的建设|党纪|从严治党|组织|干部'),('马克思主义与党史',r'马克思|党史|辩证|历史唯物|建党')]:
            if re.search(p,stem):return module,k
        return module,'党的创新理论'
    source_topics={'法律常识':'法律常识','人文常识':'人文历史','地理国情':'地理环境','科技常识':'科技生活','经济常识':'经济常识'}
    if subtype in source_topics:return module,source_topics[subtype]
    for k,p in [('法律常识',r'法律|刑法|民法|宪法|行政|诉讼|犯罪|违法|合同'),('地理环境',r'地理|河流|气候|经纬|海洋|地球|山脉'),('经济常识',r'经济|货币|财政|税|金融|市场'),('人文历史',r'历史|朝代|诗|文学|文化|名著|著作|古代'),('科技生活',r'.')]:
        if re.search(p,stem):return module,k

NOTE = {
 '逻辑填空':(13,19),'主旨概括':(3,12),'意图判断':(3,12),'细节判断':(3,12),'语句排序':(3,12),'语句衔接':(3,12),'词句理解':(3,12),'标题选择':(3,12),
 '工程问题':(35,35),'行程问题':(36,36),'利润问题':(37,37),'排列组合':(41,43),'概率':(41,43),'容斥原理':(46,47),'几何问题':(38,41),'溶液问题':(43,45),'最值问题':(45,46),'方程建模':(33,34),'比例赋值':(27,31),'年龄问题':(33,34),'整除余数':(21,26),'日期周期':(47,50),
 '图推·对称':(52,53),'图推·笔画与连通':(54,55),'图推·空间重构':(57,60),'图推·样式':(60,61),'图推·属性与功能':(56,57),'图推·数量':(51,61),'图推·位置':(51,61),'图推·综合规律':(51,61),
 '定义判断':(62,63),'类比推理':(64,72),'加强论证':(72,75),'削弱论证':(75,77),'翻译推理':(77,82),'排列约束':(77,82),'真假推理':(77,82),'日常结论':(77,82),'解释评价':(72,77),
 '增长率':(85,92),'增长量':(93,95),'基期现期':(85,92),'比重':(96,106),'平均数':(107,112),'倍数':(113,115),'混合增长':(85,92),'隔年增长':(85,92),'读表与比较':(83,85),'综合判断':(83,115)}

def make_lesson(q, ref):
    # Preserve the actual source reasoning, including every formula image.
    # Segmentation is presentation only, NOT independent verification.
    paras=[x.strip() for x in ref.split('\n') if x.strip()]
    chunks=[]; buf=''
    for p in paras:
        if len(buf)>160:chunks.append(buf);buf=''
        buf += ('\n' if buf else '')+p
    if buf:chunks.append(buf)
    if len(chunks)==1 and len(chunks[0])>300:
        sentences=re.split(r'(?<=。)',chunks[0]);chunks=[];buf=''
        for s in sentences:
            buf+=s
            if len(buf)>200:chunks.append(buf);buf=''
        if buf:chunks.append(buf)
    steps=[{'title':'先确定问题与范围','explanation':'本题归入「'+q['knowledge']+'」。先独立读题，明确设问对象、限制条件和比较基准；如有共享材料，先核对材料中的年份和单位。','hint':'先说出这道题要求找什么，哪些条件不能丢。','highlights':[]}]
    steps += [{'title':f'原解析推演 · {i+1}','explanation':p if len(p)>=10 else '原解析结论：'+p,'hint':'这一段用到了题干的哪一条条件？它是否足以支持结论？','highlights':[]} for i,p in enumerate(chunks)]
    topic=q['knowledge'];note=NOTE.get(topic)
    return {'kind':'text','answer':q['answer'],'steps':steps,'fast':'先完成基础推导。资料没有明确给出并论证独立捷径的题目，不额外承诺快速算法；按选项排除时必须检查所有条件。','examiner':'教学推断：本题检验「'+topic+'」在具体情境中的运用。对照解析中的排除理由，区分遗漏条件、概念替换和计算失误；这不是对命题人真实意图的认证。','distractors':[], 'transfer':'合上解析，复述关键依据。再做下方同考点、不同年份的真题，比较条件和设问有哪些变化。','provenance':'source-adapted','notebook':{'resourceId':'notes-xingce','page':note[0] if note else 1,'endPage':note[1] if note else 1,'title':topic,'relation':('related' if topic in ['排列约束','真假推理','日常结论','日期周期','整除余数','词句理解','标题选择','语句排序','语句衔接','细节判断'] else 'direct') if note else 'not-covered','reason':'知识方法定位（PDF 实际页码），不是原题出处。'+('对应相关基础章节，不能视为完整覆盖该考点。' if note else '这份行测笔记没有直接覆盖政治理论或常识；按本题原资料核对。')},'data':{},'claims':[]}

def parse():
    entries=[];issues=[]; seen=set()
    manifest=json.loads((OUT/'source-manifest.json').read_text(encoding='utf-8'))
    for m in manifest:
        file=OUT/'raw'/m['path']; text=file.read_text(encoding='utf-8')
        year=int(re.search(r'20\d{2}',file.name)[0]); module=m['dir'][3:].replace('言语理解与表达','言语理解')
        current=''; group=''; material_question_count=0
        headings=list(re.finditer(r'^#{2,3} (材料 \d+|第 (\d+) 题[^\n]*)\n',text,re.M))
        for i,h in enumerate(headings):
            body=text[h.end():headings[i+1].start() if i+1<len(headings) else len(text)].strip()
            if h[1].startswith('材料'):
                current=clean(body);group=h[1];material_question_count=0;continue
            match=re.search(r'qid (\d+) · ([^<]+)',h[1])
            if not match:issues.append({'file':m['path'],'reason':'缺少可追溯题号'});continue
            qid,subtype=match.groups();ident=f'gk-{year}-{qid}'
            a=re.search(r'\*\*答案\*\*：\s*([A-D])\s*(?:\n|$)',body)
            opts=list(re.finditer(r'^- \*\*([A-D])\*\*\.\s*(.*?)(?=\n- \*\*[A-D]\*\*\.|\n\*\*答案\*\*)',body,re.M|re.S))
            rs=re.split(r'\*\*(?:官方|参考)?解析\*\*',body,maxsplit=1)
            if not a or len(opts)!=4 or len(rs)!=2:
                issues.append({'id':ident,'file':m['path'],'reason':'选项、答案或解析不完整'});continue
            stem=clean(body[:opts[0].start()]);reference=clean(rs[1]);options=[{'key':o[1],'text':clean(o[2])} for o in opts]
            conclusions=re.findall(r'(?:故正确答案[为是]|故[选选择])[:： ]*([A-D])',reference)
            if any(c!=a[1] for c in conclusions):
                issues.append({'id':ident,'reason':'来源答案与解析结论冲突'});continue
            if not reference or ident in seen:issues.append({'id':ident,'reason':'空解析或重复记录'});continue
            localmodule,topic=classify(module,subtype,stem,reference,current)
            material=current
            # The export nests all following independent questions under the last
            # material heading. Reasoning sets contain 5 questions, followed by
            # independent figures/definitions/analogies. Do not propagate it.
            if module=='判断推理' and current:
                if material_question_count>=5 or '图形' in subtype or '定义' in subtype:
                    current='';material='';group=''
                    localmodule,topic=classify(module,subtype,stem,reference,'')
                else:material_question_count+=1
            if module=='资料分析' and localmodule=='数量关系':material='';group=''
            question={'number':f'{module}整理序号{h[2]} / qid {qid}','page':1,'endPage':1,'stem':stem,'options':options,'answer':a[1],'material':material,'module':localmodule,'knowledge':topic,'difficulty':'待评估','status':'RECALLED','reference':reference,'rawText':body,'evidence':f'{year}年国考地市级公开整理/回忆版；原始数据库 qid {qid}。答案依据该来源参考解析，非官方答案认证；模块内序号不冒充原试卷题号。'+('旧题按当年资料作答，涉及时政和法律请核对现行依据。' if localmodule in ['政治理论','常识判断'] else '')}
            entry={'id':ident,'question':question,'source':{'id':f'gk-{year}-{m["dir"][:2]}','name':file.stem+' · '+module,'exam':'国考地市级（公开整理/回忆版）','year':year,'region':'市（地）级及以下直属机构综合管理类','url':m['url'].replace('raw.githubusercontent.com/ERRRC/xingcezhenti/main','github.com/ERRRC/xingcezhenti/blob/main'),'rights':'公开来源，仅存本地个人学习；来源授权及官方身份未认证，不随代码再分发','filename':None,'mime':'text/markdown'},'lesson':make_lesson(question,reference),'sourceSubtype':subtype,'materialGroup':f'{year}-{module}-{group}' if material else '', 'rawPath':m['path']}
            entries.append(entry);seen.add(ident)
    save('candidates.json',entries);save('issues.json',issues);save('assets-manifest.json',list(ASSETS.values()))
    print(json.dumps({'candidates':len(entries),'assets':len(ASSETS),'issues':len(issues),'modules':Counter(e['question']['module'] for e in entries)},ensure_ascii=False))

def download_assets():
    from PIL import Image
    assets=json.loads((OUT/'assets-manifest.json').read_text(encoding='utf-8'))
    (OUT/'assets').mkdir(exist_ok=True)
    def get(a):
        target=OUT/'assets'/a['name']
        if target.exists():
            with Image.open(target) as im:im.verify()
            return
        url='https://raw.githubusercontent.com/ERRRC/xingcezhenti/main/'+urllib.parse.quote(a['remote'])
        for attempt in range(3):
            try:
                with urllib.request.urlopen(url,timeout=30) as r:blob=r.read(8*1024*1024)
                with Image.open(io.BytesIO(blob)) as im:
                    im.load();im.save(target,format='PNG')
                return
            except Exception:
                if attempt==2:raise
                time.sleep(1+attempt)
    errors=[]
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures={pool.submit(get,a):a for a in assets}
        for n,f in enumerate(as_completed(futures),1):
            try:f.result()
            except Exception as e:errors.append({'asset':futures[f]['name'],'error':str(e)})
            if n%100==0:print(f'images {n}/{len(assets)}',flush=True)
    save('asset-errors.json',errors);print('asset errors',len(errors))

if __name__=='__main__':
    arg=argparse.ArgumentParser();arg.add_argument('--download-assets',action='store_true');args=arg.parse_args()
    parse()
    if args.download_assets:download_assets()

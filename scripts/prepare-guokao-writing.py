"""Read publicly displayed recall materials; never use the site's gated downloads."""
from pathlib import Path
import urllib.request, re, html, json
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'data/guokao'
URLS={2024:'https://www.aipta.com/article/9221.html',2025:'https://www.aipta.com/article/10149.html',2023:'https://www.aipta.com/article/5682.html'}
def plain(s):
    s=re.sub(r'<(?:script|style)\b.*?</(?:script|style)>','',s,flags=re.S|re.I)
    s=re.sub(r'</(?:p|div|h\d)>|<br\s*/?>','\n',s,flags=re.I)
    s=re.sub(r'<[^>]+>','',s)
    return re.sub(r'\n[ \t\r\n]+','\n',html.unescape(s)).strip()
result=[]
guides={
 '归纳概括':['审清对象与材料范围，列出所有直接相关事实。','把同一含义的事实归并成一个要点，用准确的上位词概括。','按题干要求组织，逐点标注材料依据，删除重复和空泛评价。'],
 '综合分析':['解释题干关键词，明确分析对象或关系。','沿材料的原因、做法、影响逐层推理，每个结论都能定位原文。','结尾回扣题目，检查是否漏掉题干要求的维度。'],
 '提出对策':['建立问题—原因—措施对应表。','措施写清执行主体、对象和可操作做法；已有成功做法可据情境迁移。','逐项检查可行性，避免只写宣传、重视、加强等空话。'],
 '贯彻执行':['明确角色、受众、工作目标与指定文种。','把材料中的事实转为完成该工作需要的要点。','检查指定栏目、语气、格式和字数；题目只要主要内容时不额外挤占字数。'],
 '文章写作':['先解释题干核心概念及其关系，形成明确总论点。','安排相互支撑而非重复的分论点；每段用材料事实或真实案例论证。','分析案例怎样证明观点，不堆砌故事；结尾回扣主旨，检查字数和偏题。']}
for year,url in URLS.items():
    target=OUT/'writing-raw'/f'{year}.html';target.parent.mkdir(exist_ok=True)
    if not target.exists(): target.write_bytes(urllib.request.urlopen(url,timeout=30).read())
    raw=target.read_text(encoding='utf-8')
    # The real article body occurs after the title, excluding the meta description.
    raw=raw[raw.find('</h1>')+5:]
    body=plain(raw);start=re.search(r'(?:给定资料|给定材料)',body)
    if not start:raise ValueError(f'{year}: missing material')
    body=body[start.start():]
    sep=list(re.finditer(r'(?:[三二]、)?作答要求',body))
    # The last occurrence preceding the numbered prompts is the section heading.
    split=next((m for m in sep if re.search(r'(?:1[.、．]|一[、．]|GEP反映)',body[m.end():m.end()+180])),None)
    if not split:raise ValueError(f'{year}: missing prompts')
    material=body[:split.start()].strip();prompts=body[split.end():].split('注：篇幅有限')[0]
    prompts=prompts.split('下载真题')[0]
    if year==2023:
        beginnings=['GEP反映','有关部门正在征集','假如你是S市','《金融报》','请你深入思考']
        for n,b in enumerate(beginnings,1):
            if prompts.count(b)!=1:raise ValueError('Ambiguous prompt boundary: '+b)
            prompts=prompts.replace(b,str(n)+'.'+b,1)
    headers=list(re.finditer(r'(?m)^\s*([1-5])[.、．]\s*',prompts))
    if len(headers)!=5:raise ValueError(f'{year}: expected five prompts, got {len(headers)}')
    for i,h in enumerate(headers):
        prompt=prompts[h.end():headers[i+1].start() if i+1<5 else len(prompts)].strip()
        topic='文章写作' if i==4 else '贯彻执行' if re.search('拟写|草拟|主要内容|提案|发言|讲话|建议书',prompt) else '提出对策' if re.search('建议|对策|问题.*解决',prompt) else '综合分析' if re.search('为什么|理解|谈谈.*如何|关系',prompt) else '归纳概括'
        maxm=re.search(r'不超过\s*(\d+)\s*字',prompt)
        ranges=re.search(r'(\d{3,4})\s*[-—～~至－]\s*(\d{3,4})\s*字',prompt)
        result.append({'id':f'gk-writing-{year}-{i+1}','year':year,'number':i+1,'topic':topic,'prompt':prompt,'material':material,'sourceUrl':url,'guide':guides[topic],'maxChars':int(maxm[1]) if maxm else int(ranges[2]) if ranges else 1200,'minChars':int(ranges[1]) if ranges else 0})
(OUT/'writing.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print([(x['id'],x['topic'],len(x['material']),x['maxChars']) for x in result])

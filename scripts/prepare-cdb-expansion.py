"""Extract candidate blocks, never publish without the separate selection manifest."""
import json, re
from pathlib import Path
B = Path('data/cdb')
SOURCES = {
 '2020': ('32bced6a4c8887352cab', 2),
 '2021': ('9f082ed4580cbe3e4ee6', 2),
 '2023': ('10097c18f0147eda6155', 28),
 '2024': ('c9005652129249b4a6fd', 22),
}
def clean(t):
 return re.sub(r'\s+', ' ', t).strip()
def extract():
 out=[]
 for year,(rid,start) in SOURCES.items():
  ps=json.loads((B/'extracted'/f'{rid}.json').read_text(encoding='utf8'))['pages']
  text=''; offsets=[]
  for p in ps:
   if p['page'] < start: continue
   offsets.append((len(text),p['page']));text+=p['text']+'\n'
  def page(off):return next(p for i,p in reversed(offsets) if i<=off)
  pattern=r'(?:•\s*)?题目\s*(\d+)\s*[:：.]|•\s*' if year=='2020' else r'(?:•\s*)?题目\s*(\d+)\s*[:：.]'
  marks=list(re.finditer(pattern,text));seq=0
  for i,m in enumerate(marks):
   end=marks[i+1].start() if i+1<len(marks) else len(text)
   raw=text[m.end():end];a=re.search(r'参考答案\s*[:：]\s*[【\[]?([A-D])',raw)
   if not a:continue
   qa=raw[:a.start()];opts=list(re.finditer(r'(?:^|\n)\s*([A-D])\s*[.．、]\s*',qa))
   if len(opts)!=4 or ''.join(o[1] for o in opts)!='ABCD':continue
   seq+=1;ref=raw[a.end():];ref=re.sub(r'^[】\]\s]*答案解析\s*[:：]','',ref).strip()
   q={'id':f'bank-{year}-{seq:03d}','year':year,'resourceId':rid,'number':m[1] or str(seq),'page':page(m.start()),'endPage':page(m.end()+a.start()),'answerPage':page(m.end()+a.start()),'answerEndPage':page(end-1),'stem':clean(qa[:opts[0].start()]),'options':[{'key':o[1],'text':clean(qa[o.end():opts[k+1].start() if k<3 else len(qa)])} for k,o in enumerate(opts)],'answer':a[1],'reference':clean(ref),'rawText':raw.strip()}
   q['offset']=m.start();q['answerOffset']=m.end()+a.start();q['endOffset']=end
   out.append(q)
 (B/'candidates.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8')
 print('Candidates',len(out))
 for year in SOURCES:
  qs=[q for q in out if q['year']==year];print(year,len(qs))
  (B/f'audit-{year}.txt').write_text('\n\n'.join(f"{q['id']} p{q['page']} n{q['number']} [{q['answer']}] {q['stem']}\n"+' | '.join(o['key']+':'+o['text'] for o in q['options'])+'\n'+q['reference'] for q in qs),encoding='utf8')
if __name__=='__main__':extract()

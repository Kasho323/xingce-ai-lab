"""Read local user-provided material. Extracts stay in ignored data/, never in Git."""
import hashlib, json, sys, warnings, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
from pypdf import PdfReader
import logging
logging.getLogger('pypdf').setLevel(logging.ERROR)
warnings.filterwarnings('ignore')
root = Path(sys.argv[1]).resolve()
output = Path('data/cdb').resolve()
(output/'extracted').mkdir(parents=True, exist_ok=True)
inventory=[]
for file in sorted(root.rglob('*')):
    if not file.is_file(): continue
    rel=str(file.relative_to(root)); suffix=file.suffix.lower()
    item={'path':rel, 'name':file.name, 'bytes':file.stat().st_size, 'extension':suffix}
    item['id']=hashlib.sha256(rel.encode()).hexdigest()[:20]
    pages=[]
    if suffix in ('.pdf','.docx','.txt'):
        item['hash']=hashlib.sha256(file.read_bytes()).hexdigest()
        cache=output/'extracted'/(item['id']+'.json')
        try:
            if cache.exists():
                saved=json.loads(cache.read_text(encoding='utf8'))
                if saved.get('hash')==item['hash']: pages=saved['pages']
            if not pages:
                if suffix=='.pdf':
                    pdf=PdfReader(file)
                    pages=[{'page':i+1,'text':p.extract_text() or ''} for i,p in enumerate(pdf.pages)]
                elif suffix=='.docx':
                    with zipfile.ZipFile(file) as z:
                        doc=ET.fromstring(z.read('word/document.xml'))
                        ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
                        pages=[{'page':1,'text':'\n'.join(''.join(p.itertext()) for p in doc.findall('.//w:p',ns))}]
                else: pages=[{'page':1,'text':file.read_text(encoding='utf8',errors='replace')}]
                cache.write_text(json.dumps({'hash':item['hash'],'pages':pages},ensure_ascii=False),encoding='utf8')
            item['pages']=len(pages)
            item['textChars']=sum(len(p['text']) for p in pages)
            item['scanPages']=[p['page'] for p in pages if len(p['text'].strip())<40]
            item['preview']='\n'.join(p['text'] for p in pages[:4])[:5000]
            item['readStatus']='text-extracted' if item['textChars'] else 'image-only'
        except Exception as e: item['error']=str(e);item['readStatus']='failed'
    else: item['readStatus']='not-extracted'
    inventory.append(item)
    if suffix in ('.pdf','.docx','.txt'): print(f"{len(inventory)} {file.name}: {item.get('pages',0)} pages / {item.get('textChars',0)} chars",flush=True)
(output/'inventory.json').write_text(json.dumps({'root':str(root),'files':inventory},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'files':len(inventory),'textFiles':sum(x['readStatus']=='text-extracted' for x in inventory),'imageOnly':sum(x['readStatus']=='image-only' for x in inventory),'pages':sum(x.get('pages',0) for x in inventory)},ensure_ascii=False))

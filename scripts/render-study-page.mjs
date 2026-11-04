import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const [input,pageArg,output]=process.argv.slice(2);
const task=getDocument({data:new Uint8Array(await readFile(input)),useSystemFonts:true});
try{const doc=await task.promise;const page=await doc.getPage(Number(pageArg));const viewport=page.getViewport({scale:1.5});const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));await page.render({canvasContext:canvas.getContext('2d'),viewport,canvas}).promise;await mkdir(path.dirname(output),{recursive:true});await writeFile(output,canvas.toBuffer('image/png'));console.log(output);}finally{await task.destroy();}

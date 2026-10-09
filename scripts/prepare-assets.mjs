import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const pdfRoot=path.join(root,"node_modules/pdfjs-dist");
fs.mkdirSync("public",{recursive:true});
fs.copyFileSync(path.join(pdfRoot,"build/pdf.worker.min.mjs"),"public/pdf.worker.min.mjs");
for(const dir of ["cmaps","standard_fonts","wasm"]) fs.cpSync(path.join(pdfRoot,dir),path.join(root,"public",dir),{recursive:true});
const demo=JSON.parse(fs.readFileSync("lib/demo.json","utf8"));
const objects=[];
const add=s=>{objects.push(s);return objects.length;};
add("");add("");
const regular=add("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>");
const bold=add("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>");
const sans=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
const escape=s=>s.replaceAll("\\","\\\\").replaceAll("(","\\(").replaceAll(")","\\)");
const pageIDs=[];
for(let p=0;p<demo.pages.length;p++){
  const cmds=[];
  const text=(s,x,y,size=11,font="F1",color=".2 .25 .2")=>cmds.push(`BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${escape(s)}) Tj ET`);
  text("PAPERLEAF  /  AN ORIGINAL READING SAMPLE",55,784,8,"F3",".55 .6 .5");
  text(demo.title,55,738,25,"F2");text(demo.subtitle,55,712,12,"F1",".5 .55 .45");
  cmds.push(".82 .86 .78 RG .5 w 55 696 m 540 696 l S");
  let y=668;
  for(const s of demo.pages[p].sentences){
    if(s.heading){y-=10;text(s.en,55,y,14,"F2");y-=29;continue;}
    const words=s.en.split(" ");let line="";
    for(const word of words){if((line+" "+word).length>94){text(line,55,y);y-=17;line=word;}else line=line?line+" "+word:word;}
    if(line){text(line,55,y);y-=17;}y-=13;
  }
  if(p===1){
    const box=(label,x,y,w=135)=>{cmds.push(`.93 .96 .89 rg ${x} ${y} ${w} 37 re f .61 .71 .51 RG .7 w ${x} ${y} ${w} 37 re S`);text(label,x+9,y+14,10,"F3",".3 .4 .25");};
    const arrow=(x,y,x2,y2)=>{cmds.push(`.44 .57 .35 RG .9 w ${x} ${y} m ${x2} ${y2} l S ${x2-3} ${y2+5} m ${x2} ${y2} l ${x2+3} ${y2+5} l S`);};
    box("Q: Queries",100,260,110);box("K: Keys",340,260,110);box("Q x K transpose",220,193,155);box("Scale by sqrt(d_k)",220,126,155);box("Softmax",220,59,155);box("V: Values",395,59,130);box("Output: weights x V",395,126,130);
    arrow(155,260,260,230);arrow(395,260,335,230);arrow(297,193,297,163);arrow(297,126,297,96);arrow(460,96,460,126);cmds.push(".44 .57 .35 RG .9 w 375 77 m 385 77 l 385 144 l 395 144 l S 390 141 m 395 144 l 390 147 l S");
    text("Figure 1. Attention score computation (simplified illustration).",55,35,9,"F1",".5 .6 .4");
  }
  text(`${p+1} / ${demo.pages.length}   -   Educational sample, not a research publication`,55,18,8,"F3",".6 .65 .55");
  const stream=cmds.join("\n");const content=add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  pageIDs.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R /F3 ${sans} 0 R >> >> /Contents ${content} 0 R >>`));
}
objects[0]="<< /Type /Catalog /Pages 2 0 R >>";objects[1]=`<< /Type /Pages /Count ${pageIDs.length} /Kids [${pageIDs.map(id=>`${id} 0 R`).join(" ")}] >>`;
let pdf="%PDF-1.4\n";const offsets=[0];
objects.forEach((obj,index)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${obj}\nendobj\n`;});
const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>`${String(n).padStart(10,"0")} 00000 n \n`).join("")+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
fs.writeFileSync("public/sample.pdf",pdf);
const icon='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="17" fill="#345b48"/><path d="M16 18c6-2 12-1 16 3 4-4 10-5 16-3v29c-6-2-12-1-16 2-4-3-10-4-16-2V18Z" fill="#f5f5e8"/><path d="M32 22v26M21 27l6 1M21 34l6 1M37 28l6-1M37 35l6-1" stroke="#345b48" stroke-width="2" stroke-linecap="round"/><path d="M43 8c8-4 13-2 13-2s2 8-4 13c-4 3-9 1-10-3" fill="#a7be82"/><path d="M43 16l8-6" stroke="#345b48" stroke-width="1.2"/></svg>';
fs.writeFileSync("public/favicon.svg",icon);fs.writeFileSync("public/zhiye-icon.svg",icon);
console.log("PDF worker, fonts, sample and app icon prepared.");

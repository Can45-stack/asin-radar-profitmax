
import * as XLSX from 'xlsx';
export function n(v){ if(v===null||v===undefined) return 0; const s=String(v).trim(); if(!s) return 0; const normalized=s.replace(/\s+/g,'').replace(/\.(?=\d{3}([.,]|$))/g,'').replace(',', '.'); const x=parseFloat(normalized); return Number.isFinite(x)?x:0; }

export function parseFlexibleText(text){
  const first=(text.split(/\r?\n/).find(Boolean)||'');
  const d=first.includes(';')?';':(first.includes('\t')?'\t':',');
  const rows=[]; let row=[],cell='',inQuotes=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i], next=text[i+1];
    if(inQuotes){
      if(ch === '"' && next === '"'){ cell += '"'; i++; }
      else if(ch === '"'){ inQuotes=false; }
      else { cell += ch; }
    } else {
      if(ch === '"') inQuotes=true;
      else if(ch === d){ row.push(cell.trim()); cell=''; }
      else if(ch === '\n'){ row.push(cell.trim()); rows.push(row); row=[]; cell=''; }
      else if(ch !== '\r'){ cell += ch; }
    }
  }
  if(cell.length>0 || row.length>0){ row.push(cell.trim()); rows.push(row); }
  if(!rows.length) return [];
  const headers=rows[0].map(h=>String(h||'').trim().toLowerCase());
  return rows.slice(1).filter(r=>r.some(x=>String(x||'').trim()!=='')).map(r=>{ const obj={}; headers.forEach((h,i)=>obj[h]=r[i]??''); return obj; });
}

export async function parseUploadedFile(file){
  const name=(file?.name||'').toLowerCase();
  if(name.endsWith('.xlsx')||name.endsWith('.xls')){
    const buffer=await file.arrayBuffer();
    const wb=XLSX.read(buffer,{type:'array'});
    const sheet=wb.Sheets[wb.SheetNames[0]];
    const json=XLSX.utils.sheet_to_json(sheet,{defval:''});
    return json.map(row=>{ const out={}; Object.keys(row).forEach(k=>out[String(k).trim().toLowerCase()]=row[k]); return out; });
  }
  const text=await file.text();
  return parseFlexibleText(text);
}

export function normalizeHeaders(rows, aliases){
  return rows.map(row=>{
    const out={...row};
    Object.entries(aliases).forEach(([target, list])=>{
      if(out[target]!==undefined && String(out[target]).trim()!=='') return;
      const hit=list.find(k=>row[k.toLowerCase()]!==undefined);
      if(hit) out[target]=row[hit.toLowerCase()];
    });
    return out;
  });
}

export function calculateDesi(row){
  const direct=n(row.desi); if(direct>0) return direct;
  const cm3=n(row['package: dimension (cm³)']||row['package: dimension (cm3)']||row['package dimension (cm³)']||row['package dimension (cm3)']||row['dimension (cm³)']||row['dimension (cm3)']);
  if(cm3>0) return cm3/1000;
  const wg=n(row['package: weight (g)']||row['package weight (g)']||row['weight (g)']); if(wg>0) return wg/1000;
  const w=n(row.weight); if(w>0) return w;
  return 0;
}

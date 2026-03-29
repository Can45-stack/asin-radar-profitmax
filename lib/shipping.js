
import { n } from './parser';
export function parseTable(text){ const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean); const out=[]; for(const line of lines){ const cleaned=line.replace(/desi/gi,'').replace(/\$/g,'').trim(); const r=cleaned.match(/^(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s*=\s*(\d+(?:[.,]\d+)?)$/); const p=cleaned.match(/^(\d+(?:[.,]\d+)?)\+\s*=\s*(\d+(?:[.,]\d+)?)$/); if(r) out.push({min:n(r[1]),max:n(r[2]),price:n(r[3])}); else if(p) out.push({min:n(p[1]),max:Infinity,price:n(p[2])}); } return out.sort((a,b)=>a.min-b.min); }
export function priceFromTable(desi, table){ const val=n(desi); const found=table.find(r=>val>=r.min&&val<=r.max); return found?found.price:0; }

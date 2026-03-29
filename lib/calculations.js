
import { n } from './parser';
export function getDecision(profit, roi, margin){ if(profit<=0||roi<8||margin<5) return {karar:'GEÇ',durum:'Zayıf'}; if(roi>=35&&profit>=5&&margin>=15) return {karar:'AL',durum:'Güçlü'}; if(roi>=22&&profit>=3&&margin>=10) return {karar:'AL',durum:'İyi'}; return {karar:'TEST',durum:'İnce'}; }
export function marketCalc(usPrice, sellUsd, ship, feePct, extra){ if(!sellUsd||!usPrice) return {profit:0,roi:0,margin:0}; const fee=sellUsd*(n(feePct)/100); const total=usPrice+fee+ship+n(extra); const profit=sellUsd-total; const roi=(profit/usPrice)*100; const margin=(profit/sellUsd)*100; return {profit,roi,margin}; }

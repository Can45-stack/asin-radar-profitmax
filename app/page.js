
'use client';
import React, { useMemo, useRef, useState } from 'react';
import { parseUploadedFile, parseFlexibleText, normalizeHeaders, calculateDesi, n } from '../lib/parser';
import { parseTable, priceFromTable } from '../lib/shipping';
import { getDecision, marketCalc } from '../lib/calculations';

function fmt(v){return new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v||0);}
function pct(v){return `${fmt(v)}%`;}
function csvEscape(v){const s=String(v??''); return (s.includes(',')||s.includes('"')||s.includes('\n'))?`"${s.replace(/"/g,'""')}"`:s;}
function downloadFile(filename, content, type='text/csv;charset=utf-8'){const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);}

const ABD_SAMPLE=`Buy Box Current;ASIN;Package: Dimension (cm³);Package: Weight (g)
71,07;B004KSL51G;1336;898
10,88;B00M856DSS;194;91`;

const TARGET_SAMPLE=`ASIN;price
B004KSL51G;89,99
B00M856DSS;24,99`;

const DEFAULT_CA=`0 - 0.5 = 4
0.5 - 1 = 5
1 - 2 = 7
2 - 3 = 9
3 - 5 = 12
5 - 10 = 16
10 - 15 = 22
15 - 20 = 23
20 - 40 = 32
40 - 70 = 47`;
const DEFAULT_UK=`0 - 0.5 = 5
0.5 - 1 = 6
1 - 2 = 8
2 - 3 = 10
3 - 5 = 13
5 - 10 = 18
10 - 20 = 26
20 - 40 = 38
40 - 70 = 55`;
const DEFAULT_MX=`0 - 0.5 = 5
0.5 - 1 = 6
1 - 2 = 8
2 - 3 = 10
3 - 5 = 14
5 - 10 = 18
10 - 15 = 25
15 - 20 = 29
20 - 40 = 42
40 - 70 = 61`;

const aliasesUS={ asin:['asin'], us_price:['buy box current','buy box','buybox','current price','price'], 'package: dimension (cm³)':['package: dimension (cm³)','package: dimension (cm3)','package dimension (cm³)','package dimension (cm3)','dimension (cm³)','dimension (cm3)'], 'package: weight (g)':['package: weight (g)','package weight (g)','weight (g)'] };
const aliasesTarget={ asin:['asin'], price:['price','buy box current','buy box','buybox','current price'] };

export default function Page(){
  const [tab,setTab]=useState('veri');
  const [usText,setUsText]=useState(ABD_SAMPLE), [caText,setCaText]=useState(TARGET_SAMPLE), [ukText,setUkText]=useState(TARGET_SAMPLE), [mxText,setMxText]=useState(TARGET_SAMPLE);
  const [usRows,setUsRows]=useState([]), [caRows,setCaRows]=useState([]), [ukRows,setUkRows]=useState([]), [mxRows,setMxRows]=useState([]);
  const [mode,setMode]=useState('otomatik');
  const [commissionPct,setCommissionPct]=useState('15'), [extraFee,setExtraFee]=useState('0');
  const [cadToUsd,setCadToUsd]=useState('0.74'), [gbpToUsd,setGbpToUsd]=useState('1.29'), [mxnToUsd,setMxnToUsd]=useState('0.059');
  const [caManual,setCaManual]=useState(DEFAULT_CA), [ukManual,setUkManual]=useState(DEFAULT_UK), [mxManual,setMxManual]=useState(DEFAULT_MX);
  const [search,setSearch]=useState(''), [kararFilter,setKararFilter]=useState('Tümü'), [pazarFilter,setPazarFilter]=useState('Tümü'), [minProfit,setMinProfit]=useState('0'), [minROI,setMinROI]=useState('0');
  const usRef=useRef(null), caRef=useRef(null), ukRef=useRef(null), mxRef=useRef(null);

  const caTable=useMemo(()=>parseTable(caManual),[caManual]);
  const ukTable=useMemo(()=>parseTable(ukManual),[ukManual]);
  const mxTable=useMemo(()=>parseTable(mxManual),[mxManual]);

  const normalizedUS=useMemo(()=>normalizeHeaders(usRows, aliasesUS),[usRows]);
  const normalizedCA=useMemo(()=>normalizeHeaders(caRows, aliasesTarget),[caRows]);
  const normalizedUK=useMemo(()=>normalizeHeaders(ukRows, aliasesTarget),[ukRows]);
  const normalizedMX=useMemo(()=>normalizeHeaders(mxRows, aliasesTarget),[mxRows]);

  const caMap=useMemo(()=>Object.fromEntries(normalizedCA.map(r=>[String(r.asin||'').trim(), n(r.price)])),[normalizedCA]);
  const ukMap=useMemo(()=>Object.fromEntries(normalizedUK.map(r=>[String(r.asin||'').trim(), n(r.price)])),[normalizedUK]);
  const mxMap=useMemo(()=>Object.fromEntries(normalizedMX.map(r=>[String(r.asin||'').trim(), n(r.price)])),[normalizedMX]);

  const calculated=useMemo(()=>normalizedUS.slice(0,2000).map(row=>{
    const asin=String(row.asin||'').trim(); const usPrice=n(row.us_price); const desi=calculateDesi(row);
    const caPriceRaw=caMap[asin]||0, ukPriceRaw=ukMap[asin]||0, mxPriceRaw=mxMap[asin]||0;
    const caShip=priceFromTable(desi, caTable), ukShip=priceFromTable(desi, ukTable);
    const mxShip=mode==='manuel' ? priceFromTable(desi, mxTable) : (mxPriceRaw>0 ? priceFromTable(desi,mxTable) : (desi<=15 ? caShip*1.15 : ukShip*1.10));
    const ca=marketCalc(usPrice, caPriceRaw*n(cadToUsd), caShip, commissionPct, extraFee);
    const uk=marketCalc(usPrice, ukPriceRaw*n(gbpToUsd), ukShip, commissionPct, extraFee);
    const mx=marketCalc(usPrice, mxPriceRaw*n(mxnToUsd), mxShip, commissionPct, extraFee);
    const ranking=[{pazar:'Kanada',...ca},{pazar:'İngiltere',...uk},{pazar:'Meksika',...mx}].sort((a,b)=>b.profit-a.profit);
    const best=ranking[0]; const verdict=getDecision(best.profit,best.roi,best.margin);
    return {asin,usPrice,desi,caProfit:ca.profit,caROI:ca.roi,ukProfit:uk.profit,ukROI:uk.roi,mxProfit:mx.profit,mxROI:mx.roi,enIyiPazar:best.pazar,enIyiKar:best.profit,enIyiROI:best.roi,karar:verdict.karar,durum:verdict.durum};
  }),[normalizedUS,caMap,ukMap,mxMap,caTable,ukTable,mxTable,mode,cadToUsd,gbpToUsd,mxnToUsd,commissionPct,extraFee]);

  const filtered=useMemo(()=>calculated.filter(r=>{
    const q=search.trim().toLowerCase();
    return (!q||r.asin.toLowerCase().includes(q)) && (kararFilter==='Tümü'||r.karar===kararFilter) && (pazarFilter==='Tümü'||r.enIyiPazar===pazarFilter) && r.enIyiKar>=n(minProfit) && r.enIyiROI>=n(minROI);
  }),[calculated,search,kararFilter,pazarFilter,minProfit,minROI]);

  const summary=useMemo(()=>{
    const total=filtered.length, al=filtered.filter(x=>x.karar==='AL').length, test=filtered.filter(x=>x.karar==='TEST').length, gec=filtered.filter(x=>x.karar==='GEÇ').length;
    const avgProfit=total?filtered.reduce((a,b)=>a+b.enIyiKar,0)/total:0, avgROI=total?filtered.reduce((a,b)=>a+b.enIyiROI,0)/total:0;
    return {total,al,test,gec,avgProfit,avgROI};
  },[filtered]);

  async function load(file, setterRows, setterText){ if(!file) return; const rows=await parseUploadedFile(file); setterRows(rows); setterText(`Yüklenen dosya: ${file.name}`); }
  function processTexts(){ setUsRows(parseFlexibleText(usText)); setCaRows(parseFlexibleText(caText)); setUkRows(parseFlexibleText(ukText)); setMxRows(parseFlexibleText(mxText)); }
  function exportResults(){ const headers=['asin','abd_fiyat','desi','kanada_kar','kanada_roi','ingiltere_kar','ingiltere_roi','meksika_kar','meksika_roi','en_iyi_pazar','en_iyi_kar','en_iyi_roi','karar','durum']; const lines=[headers.join(','), ...filtered.map(r=>[r.asin,r.usPrice,r.desi,r.caProfit,r.caROI,r.ukProfit,r.ukROI,r.mxProfit,r.mxROI,r.enIyiPazar,r.enIyiKar,r.enIyiROI,r.karar,r.durum].map(csvEscape).join(','))]; downloadFile('asin-radar-profitmax-sonuclar.csv', lines.join('\n')); }

  return <div className="container">
    <div className="card"><div className="head">
      <div className="brand">
        <img src="/logo.png" alt="ASIN-RADAR" className="logo" />
        <div><div className="small">ASIN-RADAR</div><div className="big">ProfitMax</div><div>Amazon ABD kaynaklı ürünleri Kanada, İngiltere ve Meksika pazarlarında kârlılık açısından karşılaştıran karar destek sistemi.</div></div>
      </div>
    </div></div>

    <div className="badges"><span className="badge">Türkçe Arayüz</span><span className="badge">CSV / XLSX Desteği</span><span className="badge">TR Sayı Formatı</span><span className="badge">Otomatik / Manuel Kargo</span></div>

    <div className="tabs">
      {['veri','ayar','sonuc','bilgi'].map(k=><button key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{k==='veri'?'Veri Girişi':k==='ayar'?'Ayarlar':k==='sonuc'?'Sonuçlar':'Bilgilendirme'}</button>)}
    </div>

    {tab==='veri' && <div className="row2">
      <div className="card">
        <h3>ABD Ürün Verisi</h3>
        <div className="small" style={{marginBottom:10}}>ASIN, Buy Box Current, Package: Weight (g) ve Package: Dimension (cm³) alanlarını içeren veriyi yapıştırabilir veya dosya yükleyebilirsiniz.</div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:12}}>
          <button className="primary" onClick={()=>usRef.current?.click()}>Dosya Yükle</button>
          <button className="secondary" onClick={()=>setUsText(ABD_SAMPLE)}>Örnek</button>
          <input ref={usRef} type="file" accept=".csv,.txt,.xlsx,.xls" style={{display:'none'}} onChange={(e)=>load(e.target.files?.[0], setUsRows, setUsText)} />
        </div>
        <textarea value={usText} onChange={(e)=>setUsText(e.target.value)} />
      </div>

      <div className="row">
        {[
          ['Kanada Fiyat Verisi', caText, setCaText, caRef, setCaRows],
          ['İngiltere Fiyat Verisi', ukText, setUkText, ukRef, setUkRows],
          ['Meksika Fiyat Verisi', mxText, setMxText, mxRef, setMxRows],
        ].map(([title,val,setter,ref,setterRows])=><div className="card" key={title}>
          <h3>{title}</h3>
          <div className="small" style={{marginBottom:10}}>ASIN ve price alanlarını içeren veriyi yapıştırabilir veya dosya yükleyebilirsiniz.</div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:12}}>
            <button className="primary" onClick={()=>ref.current?.click()}>Dosya Yükle</button>
            <button className="secondary" onClick={()=>setter(TARGET_SAMPLE)}>Örnek</button>
            <input ref={ref} type="file" accept=".csv,.txt,.xlsx,.xls" style={{display:'none'}} onChange={(e)=>load(e.target.files?.[0], setterRows, setter)} />
          </div>
          <textarea value={val} onChange={(e)=>setter(e.target.value)} style={{minHeight:120}} />
        </div>)}
      </div>
      <div style={{gridColumn:'1 / -1'}}><button className="primary" onClick={processTexts}>Yapıştırılan Verileri İşle</button></div>
    </div>}

    {tab==='ayar' && <div className="row">
      <div className="row2">
        <div className="card">
          <h3>Temel Ayarlar</h3>
          <div className="row3">
            <div><label className="label">Kargo Hesaplama Modu</label><select value={mode} onChange={(e)=>setMode(e.target.value)}><option value="otomatik">Otomatik (önerilen)</option><option value="manuel">Manuel (gelişmiş)</option></select></div>
            <div><label className="label">Amazon Komisyon %</label><input value={commissionPct} onChange={(e)=>setCommissionPct(e.target.value)} /></div>
            <div><label className="label">Ek Maliyet</label><input value={extraFee} onChange={(e)=>setExtraFee(e.target.value)} /></div>
            <div><label className="label">CAD → USD</label><input value={cadToUsd} onChange={(e)=>setCadToUsd(e.target.value)} /></div>
            <div><label className="label">GBP → USD</label><input value={gbpToUsd} onChange={(e)=>setGbpToUsd(e.target.value)} /></div>
            <div><label className="label">MXN → USD</label><input value={mxnToUsd} onChange={(e)=>setMxnToUsd(e.target.value)} /></div>
          </div>
        </div>
        <div className="card">
          <h3>Filtreler</h3>
          <div className="row3">
            <div><label className="label">ASIN Ara</label><input value={search} onChange={(e)=>setSearch(e.target.value)} /></div>
            <div><label className="label">Karar</label><select value={kararFilter} onChange={(e)=>setKararFilter(e.target.value)}><option>Tümü</option><option>AL</option><option>TEST</option><option>GEÇ</option></select></div>
            <div><label className="label">En İyi Pazar</label><select value={pazarFilter} onChange={(e)=>setPazarFilter(e.target.value)}><option>Tümü</option><option>Kanada</option><option>İngiltere</option><option>Meksika</option></select></div>
            <div><label className="label">Minimum Kâr</label><input value={minProfit} onChange={(e)=>setMinProfit(e.target.value)} /></div>
            <div><label className="label">Minimum ROI %</label><input value={minROI} onChange={(e)=>setMinROI(e.target.value)} /></div>
          </div>
        </div>
      </div>
      {mode==='manuel' && <div className="row3">
        <div className="card"><h3>Kanada Kargo Tablosu</h3><textarea value={caManual} onChange={(e)=>setCaManual(e.target.value)} /></div>
        <div className="card"><h3>İngiltere Kargo Tablosu</h3><textarea value={ukManual} onChange={(e)=>setUkManual(e.target.value)} /></div>
        <div className="card"><h3>Meksika Kargo Tablosu</h3><textarea value={mxManual} onChange={(e)=>setMxManual(e.target.value)} /></div>
      </div>}
    </div>}

    {tab==='sonuc' && <div className="row">
      <div className="row4">
        <div className="kpi"><div>Gösterilen Ürün</div><div className="v">{summary.total}</div></div>
        <div className="kpi"><div>AL</div><div className="v">{summary.al}</div></div>
        <div className="kpi"><div>TEST</div><div className="v">{summary.test}</div></div>
        <div className="kpi"><div>GEÇ</div><div className="v">{summary.gec}</div></div>
      </div>
      <div className="row2">
        <div className="kpi"><div>Ort. Kâr</div><div className="v">{fmt(summary.avgProfit)}</div></div>
        <div className="kpi"><div>Ort. ROI</div><div className="v">{pct(summary.avgROI)}</div></div>
      </div>
      <div><button className="primary" onClick={exportResults}>Sonuçları CSV İndir</button></div>
      <div className="table"><table><thead><tr><th>ASIN</th><th>ABD Fiyat</th><th>Desi</th><th>Kanada Kâr</th><th>Kanada ROI</th><th>İngiltere Kâr</th><th>İngiltere ROI</th><th>Meksika Kâr</th><th>Meksika ROI</th><th>En İyi Pazar</th><th>En İyi Kâr</th><th>En İyi ROI</th><th>Durum</th><th>Karar</th></tr></thead><tbody>
        {filtered.map((r,i)=><tr key={r.asin+i}><td>{r.asin}</td><td>{fmt(r.usPrice)}</td><td>{fmt(r.desi)}</td><td>{fmt(r.caProfit)}</td><td>{pct(r.caROI)}</td><td>{fmt(r.ukProfit)}</td><td>{pct(r.ukROI)}</td><td>{fmt(r.mxProfit)}</td><td>{pct(r.mxROI)}</td><td>{r.enIyiPazar}</td><td>{fmt(r.enIyiKar)}</td><td>{pct(r.enIyiROI)}</td><td><span className={`pill ${r.durum==='Güçlü'?'strong':r.durum==='İyi'?'good':r.durum==='İnce'?'thin':'weak'}`}>{r.durum}</span></td><td><span className={`pill ${r.karar==='AL'?'buy':r.karar==='TEST'?'test':'pass'}`}>{r.karar}</span></td></tr>)}
        {filtered.length===0 && <tr><td colSpan="14" style={{textAlign:'center',padding:'36px'}}>Filtrelere uygun ürün bulunamadı.</td></tr>}
      </tbody></table></div>
    </div>}

    {tab==='bilgi' && <div className="row2">
      <div className="card"><h3>Bilgilendirme</h3><div>Kargo maliyetleri, farklı ara depo ve uluslararası gönderim sağlayıcılarının ortalama piyasa verileri baz alınarak hesaplanmaktadır. Gerçek maliyetler çalıştığınız aradepoya göre değişiklik gösterebilir.<br/><br/>Bu sistem karar destek amacıyla geliştirilmiştir. Nihai satış kararları öncesinde manuel kontrol önerilir.</div></div>
      <div className="card"><h3>Kullanım Notları</h3><div>Sistem CSV/TXT/XLSX dosyalarını okuyabilir. Noktalı virgül ve Türkçe sayı formatı desteklenir. Manuel mod seçildiğinde Kanada, İngiltere ve Meksika için kendi kargo tablolarınızı tanımlayabilirsiniz.</div></div>
    </div>}
  </div>;
}

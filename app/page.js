'use client';
import React, { useMemo, useRef, useState } from 'react';

function n(v){ const x=parseFloat(String(v??'').replace(/\s+/g,'').replace(',','.')); return Number.isFinite(x)?x:0; }
function fmt(v){ return new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v||0); }
function pct(v){ return `${fmt(v)}%`; }
function csvEscape(v){ const s=String(v??''); return (s.includes(',')||s.includes('"')||s.includes('\n'))?`"${s.replace(/"/g,'""')}"`:s; }
function downloadFile(filename, content, type='text/csv;charset=utf-8'){ const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url); }

function parseDelimited(text){
  const rows=[]; let row=[], cell='', inQuotes=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i], next=text[i+1];
    if(inQuotes){
      if(ch === '"' && next === '"'){ cell += '"'; i++; }
      else if(ch === '"'){ inQuotes = false; }
      else { cell += ch; }
    } else {
      if(ch === '"') inQuotes = true;
      else if(ch === ',' || ch === '\t'){ row.push(cell.trim()); cell=''; }
      else if(ch === '\n'){ row.push(cell.trim()); rows.push(row); row=[]; cell=''; }
      else if(ch !== '\r'){ cell += ch; }
    }
  }
  if(cell.length>0 || row.length>0){ row.push(cell.trim()); rows.push(row); }
  if(!rows.length) return [];
  const headers=rows[0].map(h=>String(h||'').trim().toLowerCase());
  return rows.slice(1).filter(r=>r.some(x=>String(x||'').trim()!=='')).map(r=>{ const obj={}; headers.forEach((h,i)=>obj[h]=r[i]??''); return obj; });
}

function parseTable(text){
  const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const out=[];
  for(const line of lines){
    const cleaned=line.replace(/desi/gi,'').replace(/\$/g,'').trim();
    const range=cleaned.match(/^(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s*=\s*(\d+(?:[.,]\d+)?)$/);
    const plus=cleaned.match(/^(\d+(?:[.,]\d+)?)\+\s*=\s*(\d+(?:[.,]\d+)?)$/);
    if(range) out.push({min:n(range[1]), max:n(range[2]), price:n(range[3])});
    else if(plus) out.push({min:n(plus[1]), max:Infinity, price:n(plus[2])});
  }
  return out.sort((a,b)=>a.min-b.min);
}
function priceFromTable(desi, table){ const val=n(desi); const found=table.find(r=>val>=r.min&&val<=r.max); return found?found.price:0; }
function normalizeHeaders(rows, aliases){
  return rows.map(row=>{
    const out={...row};
    Object.entries(aliases).forEach(([target,list])=>{
      if(out[target]!==undefined && String(out[target]).trim()!=='') return;
      const hit=list.find(k=>row[k.toLowerCase()]!==undefined);
      if(hit) out[target]=row[hit.toLowerCase()];
    });
    return out;
  });
}
function calculateDesi(row){
  const direct=n(row.desi); if(direct>0) return direct;
  const weight=n(row.weight);
  const length=n(row['package length']||row.length);
  const width=n(row['package width']||row.width);
  const height=n(row['package height']||row.height);
  if(length>0&&width>0&&height>0){ const dim=(length*width*height)/5000; if(dim>0) return dim; }
  if(weight>0) return weight;
  return 0;
}
function getDecision(profit, roi, margin){
  if(profit<=0 || roi<8 || margin<5) return {karar:'GEÇ', durum:'Zayıf'};
  if(roi>=35 && profit>=5 && margin>=15) return {karar:'AL', durum:'Güçlü'};
  if(roi>=22 && profit>=3 && margin>=10) return {karar:'AL', durum:'İyi'};
  return {karar:'TEST', durum:'İnce'};
}

const ABD_SAMPLE=`asin,buy box,weight,package length,package width,package height
B0TEST001,12.50,0.8,19.1,14.7,5.1
B0TEST002,8.20,0.5,15,12,4
B0TEST003,15.00,1.2,25,18,8`;
const CA_SAMPLE=`asin,price
B0TEST001,39.99
B0TEST002,29.99
B0TEST003,45.00`;
const UK_SAMPLE=`asin,price
B0TEST001,32.50
B0TEST002,24.99
B0TEST003,37.99`;
const MX_SAMPLE=`asin,price
B0TEST001,31.00
B0TEST002,23.50
B0TEST003,34.99`;

const DEFAULT_CA_TABLE=`0 - 0.5 = 4
0.5 - 1 = 5
1 - 2 = 7
2 - 3 = 9
3 - 5 = 12
5 - 10 = 16
10 - 15 = 22
15 - 20 = 23
20 - 40 = 32
40 - 70 = 47`;
const DEFAULT_UK_TABLE=`0 - 0.5 = 5
0.5 - 1 = 6
1 - 2 = 8
2 - 3 = 10
3 - 5 = 13
5 - 10 = 18
10 - 20 = 26
20 - 40 = 38
40 - 70 = 55`;
const DEFAULT_MX_TABLE=`0 - 0.5 = 5
0.5 - 1 = 6
1 - 2 = 8
2 - 3 = 10
3 - 5 = 14
5 - 10 = 18
10 - 15 = 25
15 - 20 = 29
20 - 40 = 42
40 - 70 = 61`;

const aliasesUS={ asin:['asin'], us_price:['buy box','buybox','current price','price','amazon'], weight:['weight'], 'package length':['package length','length'], 'package width':['package width','width'], 'package height':['package height','height'], desi:['desi'] };
const aliasesTarget={ asin:['asin'], price:['price','buy box','buybox','current price'] };

export default function Page(){
  const [tab,setTab]=useState('veri');
  const [usText,setUsText]=useState(ABD_SAMPLE);
  const [caText,setCaText]=useState(CA_SAMPLE);
  const [ukText,setUkText]=useState(UK_SAMPLE);
  const [mxText,setMxText]=useState(MX_SAMPLE);
  const [mode,setMode]=useState('otomatik');
  const [commissionPct,setCommissionPct]=useState('15');
  const [extraFee,setExtraFee]=useState('0');
  const [cadToUsd,setCadToUsd]=useState('0.74');
  const [gbpToUsd,setGbpToUsd]=useState('1.29');
  const [mxnToUsd,setMxnToUsd]=useState('0.059');
  const [caManual,setCaManual]=useState(DEFAULT_CA_TABLE);
  const [ukManual,setUkManual]=useState(DEFAULT_UK_TABLE);
  const [mxManual,setMxManual]=useState(DEFAULT_MX_TABLE);
  const [search,setSearch]=useState('');
  const [kararFilter,setKararFilter]=useState('Tümü');
  const [pazarFilter,setPazarFilter]=useState('Tümü');
  const [minProfit,setMinProfit]=useState('0');
  const [minROI,setMinROI]=useState('0');
  const fileRefUS=useRef(null), fileRefCA=useRef(null), fileRefUK=useRef(null), fileRefMX=useRef(null);

  const caTable=useMemo(()=>parseTable(caManual),[caManual]);
  const ukTable=useMemo(()=>parseTable(ukManual),[ukManual]);
  const mxTable=useMemo(()=>parseTable(mxManual),[mxManual]);

  const usRows=useMemo(()=>normalizeHeaders(parseDelimited(usText), aliasesUS),[usText]);
  const caRows=useMemo(()=>normalizeHeaders(parseDelimited(caText), aliasesTarget),[caText]);
  const ukRows=useMemo(()=>normalizeHeaders(parseDelimited(ukText), aliasesTarget),[ukText]);
  const mxRows=useMemo(()=>normalizeHeaders(parseDelimited(mxText), aliasesTarget),[mxText]);

  const caMap=useMemo(()=>Object.fromEntries(caRows.map(r=>[String(r.asin||'').trim(), n(r.price)])),[caRows]);
  const ukMap=useMemo(()=>Object.fromEntries(ukRows.map(r=>[String(r.asin||'').trim(), n(r.price)])),[ukRows]);
  const mxMap=useMemo(()=>Object.fromEntries(mxRows.map(r=>[String(r.asin||'').trim(), n(r.price)])),[mxRows]);

  const calculated=useMemo(()=>{
    return usRows.slice(0,2000).map(row=>{
      const asin=String(row.asin||'').trim();
      const usPrice=n(row.us_price);
      const desi=calculateDesi(row);
      const feePct=n(commissionPct), extra=n(extraFee);

      const caPriceRaw=caMap[asin]||0, ukPriceRaw=ukMap[asin]||0, mxPriceRaw=mxMap[asin]||0;
      const caShip=priceFromTable(desi, caTable);
      const ukShip=priceFromTable(desi, ukTable);
      const mxShip=mode==='manuel' ? priceFromTable(desi,mxTable) : (mxPriceRaw>0 ? priceFromTable(desi,mxTable) : (desi<=15 ? caShip*1.15 : ukShip*1.10));

      const caPrice=caPriceRaw*n(cadToUsd), ukPrice=ukPriceRaw*n(gbpToUsd), mxPrice=mxPriceRaw>0 ? mxPriceRaw*n(mxnToUsd) : 0;
      const calc=(sell,ship)=>{ if(!sell||!usPrice) return {profit:0,roi:0,margin:0}; const fee=sell*(feePct/100); const total=usPrice+fee+ship+extra; const profit=sell-total; const roi=(profit/usPrice)*100; const margin=(profit/sell)*100; return {profit,roi,margin}; };
      const ca=calc(caPrice,caShip), uk=calc(ukPrice,ukShip), mx=calc(mxPrice,mxShip);

      const ranking=[{pazar:'Kanada',...ca},{pazar:'İngiltere',...uk},{pazar:'Meksika',...mx}].sort((a,b)=>b.profit-a.profit);
      const best=ranking[0];
      const verdict=getDecision(best.profit,best.roi,best.margin);

      return { asin, usPrice, desi, caProfit:ca.profit, caROI:ca.roi, ukProfit:uk.profit, ukROI:uk.roi, mxProfit:mx.profit, mxROI:mx.roi, enIyiPazar:best.pazar, enIyiKar:best.profit, enIyiROI:best.roi, karar:verdict.karar, durum:verdict.durum };
    });
  },[usRows,caMap,ukMap,mxMap,commissionPct,extraFee,cadToUsd,gbpToUsd,mxnToUsd,caTable,ukTable,mxTable,mode]);

  const filtered=useMemo(()=>calculated.filter(r=>{
    const q=search.trim().toLowerCase();
    return (!q || r.asin.toLowerCase().includes(q))
      && (kararFilter==='Tümü' || r.karar===kararFilter)
      && (pazarFilter==='Tümü' || r.enIyiPazar===pazarFilter)
      && r.enIyiKar>=n(minProfit)
      && r.enIyiROI>=n(minROI);
  }),[calculated,search,kararFilter,pazarFilter,minProfit,minROI]);

  const summary=useMemo(()=>{
    const total=filtered.length, al=filtered.filter(x=>x.karar==='AL').length, test=filtered.filter(x=>x.karar==='TEST').length, gec=filtered.filter(x=>x.karar==='GEÇ').length;
    const avgProfit=total?filtered.reduce((a,b)=>a+b.enIyiKar,0)/total:0;
    const avgROI=total?filtered.reduce((a,b)=>a+b.enIyiROI,0)/total:0;
    return {total,al,test,gec,avgProfit,avgROI};
  },[filtered]);

  async function loadFile(file,setter){ if(!file) return; setter(await file.text()); }
  function exportResults(){
    const headers=['asin','abd_fiyat','desi','kanada_kar','kanada_roi','ingiltere_kar','ingiltere_roi','meksika_kar','meksika_roi','en_iyi_pazar','en_iyi_kar','en_iyi_roi','karar','durum'];
    const lines=[headers.join(','), ...filtered.map(r=>[r.asin,r.usPrice,r.desi,r.caProfit,r.caROI,r.ukProfit,r.ukROI,r.mxProfit,r.mxROI,r.enIyiPazar,r.enIyiKar,r.enIyiROI,r.karar,r.durum].map(csvEscape).join(','))];
    downloadFile('asin-radar-profitmax-sonuclar.csv', lines.join('\n'));
  }

  return (
    <div className="container">
      <div className="card hero">
        <div className="logoRow">
          <div className="logoGroup">
            <img src="/logo.png" alt="ASIN-RADAR" className="logoImg" />
            <div>
              <div className="brandSub">ASIN-RADAR</div>
              <h1 className="headerTitle">ProfitMax</h1>
              <div className="sub">Amazon ABD kaynaklı ürünleri Kanada, İngiltere ve Meksika pazarlarında kârlılık açısından karşılaştıran ücretsiz karar destek sistemi.</div>
            </div>
          </div>
          <div className="heroStat"><div className="l">Ücretsiz Sürüm</div><div className="v">2000 Ürün</div></div>
        </div>
      </div>

      <div style={{height:18}} />
      <div className="badgeRow">
        <span className="badge">ABD → Kanada</span>
        <span className="badge">ABD → İngiltere</span>
        <span className="badge">ABD → Meksika</span>
        <span className="badge">Tüm Sonuçları Göster</span>
      </div>

      <div style={{height:18}} />
      <div className="tabs">
        {[['veri','Veri Girişi'],['ayar','Ayarlar'],['sonuc','Sonuçlar'],['bilgi','Bilgilendirme']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} className={`tab ${tab===k?'active':''}`}>{l}</button>
        ))}
      </div>

      <div style={{height:18}} />
      {tab==='veri' && (
        <div className="row2">
          <div className="card sectionPad">
            <h3 style={{marginTop:0}}>ABD Ürün Verisi</h3>
            <div className="note">ASIN, Buy Box, Weight, Package Length, Package Width, Package Height gibi alanları içeren ürün verisini buraya yapıştırın.</div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'14px 0'}}>
              <button className="btn btnPrimary" onClick={()=>fileRefUS.current?.click()}>Dosya Yükle</button>
              <button className="btn btnSecondary" onClick={()=>setUsText(ABD_SAMPLE)}>Örnek Yükle</button>
              <input ref={fileRefUS} type="file" accept=".csv,.txt" style={{display:'none'}} onChange={(e)=>loadFile(e.target.files?.[0],setUsText)} />
            </div>
            <textarea className="textarea" value={usText} onChange={(e)=>setUsText(e.target.value)} />
          </div>

          <div className="grid">
            <div className="card sectionPad">
              <h3 style={{marginTop:0}}>Kanada Fiyat Verisi</h3>
              <div className="note">ASIN ve satış fiyatı bilgisini yapıştırın.</div>
              <div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'14px 0'}}>
                <button className="btn btnPrimary" onClick={()=>fileRefCA.current?.click()}>Dosya Yükle</button>
                <button className="btn btnSecondary" onClick={()=>setCaText(CA_SAMPLE)}>Örnek</button>
                <input ref={fileRefCA} type="file" accept=".csv,.txt" style={{display:'none'}} onChange={(e)=>loadFile(e.target.files?.[0],setCaText)} />
              </div>
              <textarea className="textarea" style={{minHeight:120}} value={caText} onChange={(e)=>setCaText(e.target.value)} />
            </div>

            <div className="card sectionPad">
              <h3 style={{marginTop:0}}>İngiltere Fiyat Verisi</h3>
              <div className="note">ASIN ve satış fiyatı bilgisini yapıştırın.</div>
              <div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'14px 0'}}>
                <button className="btn btnPrimary" onClick={()=>fileRefUK.current?.click()}>Dosya Yükle</button>
                <button className="btn btnSecondary" onClick={()=>setUkText(UK_SAMPLE)}>Örnek</button>
                <input ref={fileRefUK} type="file" accept=".csv,.txt" style={{display:'none'}} onChange={(e)=>loadFile(e.target.files?.[0],setUkText)} />
              </div>
              <textarea className="textarea" style={{minHeight:120}} value={ukText} onChange={(e)=>setUkText(e.target.value)} />
            </div>

            <div className="card sectionPad">
              <h3 style={{marginTop:0}}>Meksika Fiyat Verisi</h3>
              <div className="note">İsterseniz ASIN ve satış fiyatı bilgisi girin. Boş bırakılırsa otomatik modda tahmini model kullanılır.</div>
              <div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'14px 0'}}>
                <button className="btn btnPrimary" onClick={()=>fileRefMX.current?.click()}>Dosya Yükle</button>
                <button className="btn btnSecondary" onClick={()=>setMxText(MX_SAMPLE)}>Örnek</button>
                <input ref={fileRefMX} type="file" accept=".csv,.txt" style={{display:'none'}} onChange={(e)=>loadFile(e.target.files?.[0],setMxText)} />
              </div>
              <textarea className="textarea" style={{minHeight:120}} value={mxText} onChange={(e)=>setMxText(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {tab==='ayar' && (
        <div className="grid">
          <div className="row2">
            <div className="card sectionPad">
              <h3 style={{marginTop:0}}>Temel Ayarlar</h3>
              <div className="row3">
                <div><label className="label">Kargo Hesaplama Modu</label><select className="select" value={mode} onChange={(e)=>setMode(e.target.value)}><option value="otomatik">Otomatik (önerilen)</option><option value="manuel">Manuel (gelişmiş)</option></select></div>
                <div><label className="label">Amazon Komisyon %</label><input className="input" value={commissionPct} onChange={(e)=>setCommissionPct(e.target.value)} /></div>
                <div><label className="label">Ek Maliyet</label><input className="input" value={extraFee} onChange={(e)=>setExtraFee(e.target.value)} /></div>
                <div><label className="label">CAD → USD</label><input className="input" value={cadToUsd} onChange={(e)=>setCadToUsd(e.target.value)} /></div>
                <div><label className="label">GBP → USD</label><input className="input" value={gbpToUsd} onChange={(e)=>setGbpToUsd(e.target.value)} /></div>
                <div><label className="label">MXN → USD</label><input className="input" value={mxnToUsd} onChange={(e)=>setMxnToUsd(e.target.value)} /></div>
              </div>
            </div>

            <div className="card sectionPad">
              <h3 style={{marginTop:0}}>Filtreler</h3>
              <div className="row3">
                <div><label className="label">ASIN Ara</label><input className="input" value={search} onChange={(e)=>setSearch(e.target.value)} /></div>
                <div><label className="label">Karar</label><select className="select" value={kararFilter} onChange={(e)=>setKararFilter(e.target.value)}><option>Tümü</option><option>AL</option><option>TEST</option><option>GEÇ</option></select></div>
                <div><label className="label">En İyi Pazar</label><select className="select" value={pazarFilter} onChange={(e)=>setPazarFilter(e.target.value)}><option>Tümü</option><option>Kanada</option><option>İngiltere</option><option>Meksika</option></select></div>
                <div><label className="label">Minimum Kâr</label><input className="input" value={minProfit} onChange={(e)=>setMinProfit(e.target.value)} /></div>
                <div><label className="label">Minimum ROI %</label><input className="input" value={minROI} onChange={(e)=>setMinROI(e.target.value)} /></div>
              </div>
            </div>
          </div>

          {mode==='manuel' && (
            <div className="row3">
              <div className="card sectionPad"><h3 style={{marginTop:0}}>Kanada Kargo Tablosu</h3><textarea className="textarea" value={caManual} onChange={(e)=>setCaManual(e.target.value)} /></div>
              <div className="card sectionPad"><h3 style={{marginTop:0}}>İngiltere Kargo Tablosu</h3><textarea className="textarea" value={ukManual} onChange={(e)=>setUkManual(e.target.value)} /></div>
              <div className="card sectionPad"><h3 style={{marginTop:0}}>Meksika Kargo Tablosu</h3><textarea className="textarea" value={mxManual} onChange={(e)=>setMxManual(e.target.value)} /></div>
            </div>
          )}
        </div>
      )}

      {tab==='sonuc' && (
        <div className="grid">
          <div className="row4">
            <div className="kpi"><div className="small">Gösterilen Ürün</div><div className="kpiValue">{summary.total}</div></div>
            <div className="kpi"><div className="small">AL</div><div className="kpiValue">{summary.al}</div></div>
            <div className="kpi"><div className="small">TEST</div><div className="kpiValue">{summary.test}</div></div>
            <div className="kpi"><div className="small">GEÇ</div><div className="kpiValue">{summary.gec}</div></div>
          </div>
          <div className="row2">
            <div className="kpi"><div className="small">Ort. Kâr</div><div className="kpiValue">{fmt(summary.avgProfit)}</div></div>
            <div className="kpi"><div className="small">Ort. ROI</div><div className="kpiValue">{pct(summary.avgROI)}</div></div>
          </div>
          <div><button className="btn btnPrimary" onClick={exportResults}>Sonuçları CSV İndir</button></div>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>ASIN</th><th>ABD Fiyat</th><th>Desi</th><th>Kanada Kâr</th><th>Kanada ROI</th><th>İngiltere Kâr</th><th>İngiltere ROI</th><th>Meksika Kâr</th><th>Meksika ROI</th><th>En İyi Pazar</th><th>En İyi Kâr</th><th>En İyi ROI</th><th>Durum</th><th>Karar</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r,i)=>(
                  <tr key={`${r.asin}-${i}`}>
                    <td style={{fontWeight:800}}>{r.asin}</td>
                    <td>{fmt(r.usPrice)}</td>
                    <td>{fmt(r.desi)}</td>
                    <td>{fmt(r.caProfit)}</td>
                    <td>{pct(r.caROI)}</td>
                    <td>{fmt(r.ukProfit)}</td>
                    <td>{pct(r.ukROI)}</td>
                    <td>{fmt(r.mxProfit)}</td>
                    <td>{pct(r.mxROI)}</td>
                    <td>{r.enIyiPazar}</td>
                    <td>{fmt(r.enIyiKar)}</td>
                    <td>{pct(r.enIyiROI)}</td>
                    <td><span className={`pill pill${r.durum==='Güçlü'?'Strong':r.durum==='İyi'?'Good':r.durum==='İnce'?'Thin':'Weak'}`}>{r.durum}</span></td>
                    <td><span className={`pill pill${r.karar==='AL'?'Buy':r.karar==='TEST'?'Test':'Pass'}`}>{r.karar}</span></td>
                  </tr>
                ))}
                {filtered.length===0 && <tr><td colSpan="14" style={{textAlign:'center',padding:'36px'}}>Filtrelere uygun ürün bulunamadı.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab==='bilgi' && (
        <div className="row2">
          <div className="card sectionPad">
            <h3 style={{marginTop:0}}>Bilgilendirme</h3>
            <div className="note">
              Kargo maliyetleri, farklı ara depo ve uluslararası gönderim sağlayıcılarının ortalama piyasa verileri baz alınarak hesaplanmaktadır. Gerçek maliyetler çalıştığınız aradepoya göre değişiklik gösterebilir.
              <br/><br/>
              Bu sistem karar destek amacıyla geliştirilmiştir. Nihai satış kararları öncesinde manuel kontrol önerilir.
            </div>
          </div>
          <div className="card sectionPad">
            <h3 style={{marginTop:0}}>Kullanım Notları</h3>
            <div className="note">
              ABD verisinde ASIN, Buy Box, Weight, Package Length, Package Width ve Package Height gibi alanlar kullanılabilir. Diğer pazarlarda ASIN ve price alanları yeterlidir.
              <br/><br/>
              Manuel mod seçildiğinde Kanada, İngiltere ve Meksika için kendi kargo tablolarınızı tanımlayabilirsiniz.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

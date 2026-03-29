'use client';
import React, { useState } from 'react';

export default function Page() {
  const [data, setData] = useState('');

  return (
    <div style={{padding:40, color:"white"}}>
      
      <h1>ASIN RADAR PROFITMAX</h1>
      <p style={{marginBottom:20}}>Buy Box Price sistemi aktif ✅</p>

      <h3>ABD Ürün Verisi</h3>
      <textarea
        placeholder="Buy Box Price;ASIN;Dimension;Weight"
        value={data}
        onChange={(e)=>setData(e.target.value)}
        style={{
          width:"100%",
          height:150,
          marginTop:10,
          padding:10,
          background:"#111",
          color:"white",
          border:"1px solid #333"
        }}
      />

      <div style={{marginTop:20}}>
        <button style={{
          padding:"10px 20px",
          background:"#00ff88",
          border:"none",
          cursor:"pointer"
        }}>
          Veriyi İşle
        </button>
      </div>

    </div>
  );
}

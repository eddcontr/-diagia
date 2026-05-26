import { useState, useRef, useEffect } from "react";

// ─── STORAGE ────────────────────────────────────────────────────────
const DB = {
  get: (k, d=[]) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

// ─── COUNTRIES & CURRENCIES ─────────────────────────────────────────
const COUNTRIES = [
  { code:"US", name:"United States", flag:"🇺🇸", currency:"USD", symbol:"$", tax:0, taxName:"Sales Tax", taxManual:true, lang:"en" },
  { code:"CO", name:"Colombia",      flag:"🇨🇴", currency:"COP", symbol:"$", tax:19, taxName:"IVA", taxManual:false, lang:"es" },
  { code:"PA", name:"Panamá",        flag:"🇵🇦", currency:"PAB", symbol:"B/.", tax:7, taxName:"ITBMS", taxManual:false, lang:"es" },
  { code:"MX", name:"México",        flag:"🇲🇽", currency:"MXN", symbol:"$", tax:16, taxName:"IVA", taxManual:false, lang:"es" },
  { code:"CR", name:"Costa Rica",    flag:"🇨🇷", currency:"CRC", symbol:"₡", tax:13, taxName:"IVA", taxManual:false, lang:"es" },
  { code:"GT", name:"Guatemala",     flag:"🇬🇹", currency:"GTQ", symbol:"Q", tax:12, taxName:"IVA", taxManual:false, lang:"es" },
  { code:"EC", name:"Ecuador",       flag:"🇪🇨", currency:"USD", symbol:"$", tax:12, taxName:"IVA", taxManual:false, lang:"es" },
  { code:"PE", name:"Perú",          flag:"🇵🇪", currency:"PEN", symbol:"S/.", tax:18, taxName:"IGV", taxManual:false, lang:"es" },
  { code:"CL", name:"Chile",         flag:"🇨🇱", currency:"CLP", symbol:"$", tax:19, taxName:"IVA", taxManual:false, lang:"es" },
  { code:"BR", name:"Brasil",        flag:"🇧🇷", currency:"BRL", symbol:"R$", tax:12, taxName:"ISS", taxManual:true, lang:"pt" },
];

const SYSTEM_PROMPT = `Eres un mecánico automotriz senior con 25 años de experiencia en diagnóstico eléctrico, mecánico y vehículos pesados. Conoces perfectamente las herramientas del técnico.

HERRAMIENTAS DISPONIBLES:
1. ESCÁNER LIGEROS: Thinkcar Thinkscan Plus S2 → Scan → [marca] → Sistema → Datos en vivo
2. ESCÁNER PESADOS (futuro): Launch X431 Pro5 + SmartLink HD → 12V y 24V, Kenworth, Peterbilt, Freightliner
3. MULTÍMETRO: Innova 3320 → VDC, Ω, continuidad. Indica modo, punta roja y negra exacta
4. POWER PROBE: Autel Powerscan PS100 → alimentar componentes, voltaje+amperaje simultáneo
5. PINZAS: FNIRSI DMC-100 → consumo en tiempo real, indica qué cable abraza
6. LÁMPARA DE PRUEBA → verificación rápida, siempre primero
7. HUMO: AutoLine Pro HyperSmoke → fugas EVAP y vacío

REGLAS ABSOLUTAS:
1. NUNCA más de 2-3 posibilidades a la vez
2. SIEMPRE herramienta correcta con instrucción exacta
3. Para escáner: ruta exacta de menú
4. Para Innova: modo, punta roja dónde, punta negra dónde, valor normal
5. Para PS100: qué terminal, qué función, qué muestra pantalla
6. Para FNIRSI: qué cable abraza, modo, valor normal
7. AVANZA cuando recibas resultado, NUNCA retrocedas
8. Marca ✅ DESCARTADO lo ya revisado
9. Eléctrico: Fusible → Masa → Señal → Componente

FORMATO OBLIGATORIO:
**PASO [N] — [Nombre]**
🛠️ Herramienta: [equipo exacto]
📍 Cómo: [instrucción exacta o ruta de menú]
📊 Valor normal: [rango con unidades]
🔍 Interpreta: [qué significa cada resultado]
➡️ Dime: [UNA pregunta concreta]

DIAGNÓSTICO CONFIRMADO:
🎯 CAUSA RAÍZ: [componente exacto]
🔧 ACCIÓN: [pasos para reparar]
💰 DIFICULTAD: [Fácil/Medio/Difícil] — [tiempo estimado]

Sin vueltas. Sin repeticiones. Sin ambigüedad.`;

// ─── HELPERS ────────────────────────────────────────────────────────
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const fmtDate = () => new Date().toLocaleDateString("es", { day:"2-digit", month:"2-digit", year:"numeric" });
const fmtMoney = (amt, country) => {
  const c = COUNTRIES.find(x=>x.code===country) || COUNTRIES[0];
  return `${c.symbol}${Number(amt||0).toLocaleString("en-US", {minimumFractionDigits:2, maximumFractionDigits:2})}`;
};

// ─── MESSAGE CONTENT ────────────────────────────────────────────────
function MsgContent({ content }) {
  return (
    <div className="mc">
      {content.split("\n").map((line,i) => {
        if (line.startsWith("# ")) return <h1 key={i}>{line.slice(2)}</h1>;
        if (line.startsWith("## ")) return <h2 key={i}>{line.slice(3)}</h2>;
        if (line.startsWith("🎯")) return <p key={i} className="confirmed">{line}</p>;
        if (line.startsWith("🔧")&&line.includes("ACCIÓN")) return <p key={i} className="action-line">{line}</p>;
        if (line.startsWith("💰")) return <p key={i} className="diff">{line}</p>;
        if (line.match(/^\*\*PASO/)) return <p key={i} className="step-h">{line.replace(/\*\*/g,"")}</p>;
        if (["🛠️","📍","📊","🔍","➡️"].some(e=>line.startsWith(e))) return <p key={i} className="step-d">{line}</p>;
        if (line.startsWith("✅")) return <p key={i} className="disc">{line}</p>;
        if (line.startsWith("---")) return <hr key={i}/>;
        if (line.trim()==="") return <br key={i}/>;
        if (line.includes("**")) {
          const parts = line.split(/\*\*(.*?)\*\*/g);
          return <p key={i}>{parts.map((p,j)=>j%2===1?<strong key={j}>{p}</strong>:p)}</p>;
        }
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

// ─── VEHICLE FORM ────────────────────────────────────────────────────
function VehicleForm({ onSave, onCancel, initial }) {
  const [f, setF] = useState(initial || { type:"light", vin:"", brand:"", model:"", year:"", engine:"", km:"", client:"", phone:"", email:"", notes:"" });
  const u = (k,v) => setF(p=>({...p,[k]:v}));
  return (
    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(14,165,233,0.2)",borderRadius:12,padding:20,display:"flex",flexDirection:"column",gap:10}}>
      <div style={{fontSize:13,fontWeight:700,color:"#0ea5e9"}}>{initial?"✏️ Editar Vehículo":"🚗 Nuevo Vehículo"}</div>
      <div style={{display:"flex",gap:8}}>
        {[["light","🚗 Ligero"],["heavy","🚛 Pesado"]].map(([val,lbl])=>(
          <button key={val} onClick={()=>u("type",val)} style={{flex:1,padding:"8px 0",borderRadius:8,border:`1px solid ${f.type===val?"#0ea5e9":"rgba(255,255,255,0.1)"}`,background:f.type===val?"rgba(14,165,233,0.12)":"transparent",color:f.type===val?"#0ea5e9":"#6a8aaa",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{lbl}</button>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[["vin","VIN"],["brand","Marca *"],["model","Modelo *"],["year","Año *"],["engine","Motor *"],["km","Kilometraje"],["client","Cliente"],["phone","Teléfono"],["email","Email"]].map(([key,lbl])=>(
          <div key={key}>
            <div style={{fontSize:10,color:"#4a7a9a",marginBottom:3}}>{lbl}</div>
            <input value={f[key]} onChange={e=>u(key,e.target.value)} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7,padding:"7px 10px",color:"#e0e6f0",fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
          </div>
        ))}
      </div>
      <div>
        <div style={{fontSize:10,color:"#4a7a9a",marginBottom:3}}>Notas / Síntoma inicial</div>
        <textarea value={f.notes} onChange={e=>u("notes",e.target.value)} rows={2} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7,padding:"7px 10px",color:"#e0e6f0",fontSize:12,fontFamily:"inherit",outline:"none",resize:"none",boxSizing:"border-box"}}/>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>{if(!f.brand||!f.model||!f.year||!f.engine){alert("Completa campos obligatorios (*)");return;}onSave(f);}} style={{flex:1,padding:"9px 0",background:"linear-gradient(135deg,#0ea5e9,#0369a1)",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{initial?"Guardar":"Crear Vehículo"}</button>
        <button onClick={onCancel} style={{padding:"9px 14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"#6a8aaa",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
      </div>
    </div>
  );
}

// ─── QUOTE BUILDER ───────────────────────────────────────────────────
function QuoteBuilder({ vehicle, config, onClose, onSend }) {
  const country = COUNTRIES.find(c=>c.code===config.country) || COUNTRIES[0];
  const [items, setItems] = useState([
    { id:uid(), category:"diag", desc:"Diagnóstico computarizado", qty:1, price: config.diagPrice || 85 },
  ]);
  const [taxRate, setTaxRate] = useState(country.tax);
  const [notes, setNotes] = useState("");
  const [quoteNum] = useState(`DG-${Date.now().toString().slice(-6)}`);

  const addItem = (cat) => setItems(p=>[...p,{id:uid(),category:cat,desc:"",qty:1,price:0}]);
  const updateItem = (id,k,v) => setItems(p=>p.map(i=>i.id===id?{...i,[k]:v}:i));
  const removeItem = (id) => setItems(p=>p.filter(i=>i.id!==id));

  const subtotal = items.reduce((s,i)=>s+(Number(i.price||0)*Number(i.qty||1)),0);
  const tax = subtotal * (taxRate/100);
  const total = subtotal + tax;

  const catColor = c=>c==="diag"?"#0ea5e9":c==="parts"?"#f59e0b":c==="labor"?"#a78bfa":"#4ade80";
  const catLabel = c=>c==="diag"?"🔧 Diagnóstico":c==="parts"?"🔩 Refacciones":c==="labor"?"👨‍🔧 Mano de obra":"📦 Otros";

  const generateWhatsAppLink = () => {
    const lang = country.lang;
    const lines = [
      lang==="en" ? `*DIAGIA.co — QUOTE ${quoteNum}*` : `*DIAGIA.co — PRESUPUESTO ${quoteNum}*`,
      "",
      lang==="en" ? `🚗 *Vehicle:* ${vehicle.brand} ${vehicle.model} ${vehicle.year}` : `🚗 *Vehículo:* ${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
      lang==="en" ? `⚙️ *Engine:* ${vehicle.engine}` : `⚙️ *Motor:* ${vehicle.engine}`,
      vehicle.vin ? `🔑 VIN: ${vehicle.vin}` : "",
      "",
      "━━━━━━━━━━━━━━━━━━━━",
      ...items.map(i=>`${catLabel(i.category)}: ${i.desc} — ${fmtMoney(i.price*i.qty,config.country)}`),
      "━━━━━━━━━━━━━━━━━━━━",
      lang==="en" ? `Subtotal: ${fmtMoney(subtotal,config.country)}` : `Subtotal: ${fmtMoney(subtotal,config.country)}`,
      `${country.taxName} (${taxRate}%): ${fmtMoney(tax,config.country)}`,
      lang==="en" ? `*TOTAL: ${fmtMoney(total,config.country)}*` : `*TOTAL: ${fmtMoney(total,config.country)}*`,
      "",
      notes ? (lang==="en"?`📝 Notes: ${notes}`:`📝 Notas: ${notes}`) : "",
      "",
      lang==="en"
        ? `To APPROVE or REJECT this quote, open: ${window.location.href}#quote-${quoteNum}`
        : `Para APROBAR o RECHAZAR este presupuesto, abre: ${window.location.href}#quote-${quoteNum}`,
      "",
      lang==="en" ? `Reply YES to approve or NO to reject.` : `Responde SÍ para aprobar o NO para rechazar.`,
    ].filter(l=>l!=="").join("\n");

    const phone = vehicle.phone?.replace(/\D/g,"") || "";
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines)}`;
    window.open(url,"_blank");

    // Save quote
    const quote = { id:uid(), num:quoteNum, vehicleId:vehicle.id, items, subtotal, tax, taxRate, total, country:config.country, notes, status:"pending", createdAt:fmtDate() };
    onSend(quote);
  };

  const printQuote = () => {
    const lang = country.lang;
    const w = window.open("","_blank");
    w.document.write(`<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8">
    <title>DIAGIA.co — ${lang==="en"?"Quote":"Presupuesto"} ${quoteNum}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:30px;color:#1a1a1a;font-size:14px}
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0ea5e9;padding-bottom:20px;margin-bottom:24px}
      .logo{font-size:28px;font-weight:900;color:#0ea5e9;letter-spacing:3px}.logo span{color:#0369a1}
      .logo-sub{font-size:10px;color:#666;letter-spacing:2px;margin-top:2px}
      .quote-info{text-align:right}.quote-num{font-size:18px;font-weight:700;color:#1a1a1a}
      .badge{display:inline-block;background:#0ea5e9;color:#fff;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;margin-top:4px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
      .section-title{font-size:10px;font-weight:700;color:#0ea5e9;letter-spacing:2px;border-bottom:1px solid #e0e0e0;padding-bottom:4px;margin-bottom:10px}
      .field{margin-bottom:6px}.field-label{font-size:10px;color:#999;text-transform:uppercase}
      .field-value{font-size:13px;font-weight:500;color:#1a1a1a}
      table{width:100%;border-collapse:collapse;margin:16px 0}
      th{background:#f0f9ff;color:#0ea5e9;font-size:11px;padding:8px 12px;text-align:left;border-bottom:2px solid #0ea5e9}
      td{padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px}
      tr:last-child td{border-bottom:none}
      .totals{margin-left:auto;width:280px}
      .total-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px}
      .total-final{display:flex;justify-content:space-between;padding:10px 0;font-size:16px;font-weight:700;border-top:2px solid #0ea5e9;margin-top:4px;color:#0ea5e9}
      .approve-section{margin-top:30px;border:2px solid #0ea5e9;border-radius:12px;padding:20px;text-align:center}
      .approve-title{font-size:14px;font-weight:700;margin-bottom:12px}
      .buttons{display:flex;gap:16px;justify-content:center;margin-top:12px}
      .btn-approve{background:#22c55e;color:#fff;border:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
      .btn-reject{background:#ef4444;color:#fff;border:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
      .sign-area{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:30px}
      .sign-line{border-top:1px solid #333;padding-top:8px;font-size:11px;color:#666;text-align:center}
      .footer{text-align:center;font-size:10px;color:#999;margin-top:30px;padding-top:16px;border-top:1px solid #e0e0e0}
      .cat-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700}
      @media print{body{margin:0}.buttons{display:none}}
    </style></head><body>
    <div class="header">
      <div><div class="logo">DIAG<span>IA</span>.co</div>
      <div class="logo-sub">DIAGNÓSTICO AUTOMOTRIZ PROFESIONAL</div>
      ${config.techName?`<div style="margin-top:8px;font-size:12px;color:#666">${lang==="en"?"Technician":"Técnico"}: <strong>${config.techName}</strong></div>`:""}
      </div>
      <div class="quote-info">
        <div class="quote-num">${lang==="en"?"QUOTE":"PRESUPUESTO"} #${quoteNum}</div>
        <div class="badge">${country.flag} ${country.name}</div>
        <div style="font-size:12px;color:#666;margin-top:6px">${lang==="en"?"Date":"Fecha"}: ${fmtDate()}</div>
      </div>
    </div>
    <div class="grid">
      <div>
        <div class="section-title">${lang==="en"?"VEHICLE":"VEHÍCULO"}</div>
        <div class="field"><div class="field-label">${lang==="en"?"Brand / Model":"Marca / Modelo"}</div><div class="field-value">${vehicle.brand} ${vehicle.model} ${vehicle.year}</div></div>
        <div class="field"><div class="field-label">${lang==="en"?"Engine":"Motor"}</div><div class="field-value">${vehicle.engine}</div></div>
        ${vehicle.vin?`<div class="field"><div class="field-label">VIN</div><div class="field-value">${vehicle.vin}</div></div>`:""}
        ${vehicle.km?`<div class="field"><div class="field-label">${lang==="en"?"Mileage":"Kilometraje"}</div><div class="field-value">${vehicle.km}</div></div>`:""}
        <div class="field"><div class="field-label">${lang==="en"?"Type":"Tipo"}</div><div class="field-value">${vehicle.type==="heavy"?(lang==="en"?"Heavy Duty 🚛":"Vehículo Pesado 🚛"):(lang==="en"?"Light Vehicle 🚗":"Vehículo Ligero 🚗")}</div></div>
      </div>
      <div>
        <div class="section-title">${lang==="en"?"CLIENT":"CLIENTE"}</div>
        <div class="field"><div class="field-label">${lang==="en"?"Name":"Nombre"}</div><div class="field-value">${vehicle.client||"—"}</div></div>
        <div class="field"><div class="field-label">${lang==="en"?"Phone":"Teléfono"}</div><div class="field-value">${vehicle.phone||"—"}</div></div>
        ${vehicle.email?`<div class="field"><div class="field-label">Email</div><div class="field-value">${vehicle.email}</div></div>`:""}
      </div>
    </div>
    <div class="section-title">${lang==="en"?"SERVICES & PARTS":"SERVICIOS Y REFACCIONES"}</div>
    <table>
      <tr>
        <th>${lang==="en"?"Category":"Categoría"}</th>
        <th>${lang==="en"?"Description":"Descripción"}</th>
        <th style="text-align:center">${lang==="en"?"Qty":"Cant."}</th>
        <th style="text-align:right">${lang==="en"?"Unit Price":"Precio Unit."}</th>
        <th style="text-align:right">${lang==="en"?"Total":"Total"}</th>
      </tr>
      ${items.map(i=>`<tr>
        <td><span class="cat-badge" style="background:${catColor(i.category)}22;color:${catColor(i.category)}">${catLabel(i.category)}</span></td>
        <td>${i.desc||"—"}</td>
        <td style="text-align:center">${i.qty}</td>
        <td style="text-align:right">${fmtMoney(i.price,config.country)}</td>
        <td style="text-align:right"><strong>${fmtMoney(i.price*i.qty,config.country)}</strong></td>
      </tr>`).join("")}
    </table>
    <div class="totals">
      <div class="total-row"><span>${lang==="en"?"Subtotal":"Subtotal"}</span><span>${fmtMoney(subtotal,config.country)}</span></div>
      <div class="total-row"><span>${country.taxName} (${taxRate}%)</span><span>${fmtMoney(tax,config.country)}</span></div>
      <div class="total-final"><span>TOTAL</span><span>${fmtMoney(total,config.country)}</span></div>
    </div>
    ${notes?`<div style="margin-top:16px;padding:12px;background:#f9f9f9;border-radius:8px;font-size:13px"><strong>${lang==="en"?"Notes":"Notas"}:</strong> ${notes}</div>`:""}
    <div class="approve-section">
      <div class="approve-title">${lang==="en"?"CLIENT APPROVAL":"APROBACIÓN DEL CLIENTE"}</div>
      <div style="font-size:13px;color:#666">${lang==="en"?"Please review the quote and select your decision:":"Por favor revisa el presupuesto y selecciona tu decisión:"}</div>
      <div class="buttons">
        <button class="btn-approve" onclick="this.innerHTML='✅ ${lang==="en"?"APPROVED":"APROBADO"}';this.disabled=true;document.querySelector('.btn-reject').disabled=true">✅ ${lang==="en"?"APPROVE":"APROBAR"}</button>
        <button class="btn-reject" onclick="this.innerHTML='❌ ${lang==="en"?"REJECTED":"RECHAZADO"}';this.disabled=true;document.querySelector('.btn-approve').disabled=true">❌ ${lang==="en"?"REJECT":"RECHAZAR"}</button>
      </div>
    </div>
    <div class="sign-area">
      <div><div class="sign-line">${lang==="en"?"Client Signature":"Firma del Cliente"}</div></div>
      <div><div class="sign-line">${lang==="en"?"Date":"Fecha"}: _______________</div></div>
    </div>
    <div class="footer">DIAGIA.co — ${lang==="en"?"Professional Automotive Diagnostic System":"Sistema Profesional de Diagnóstico Automotriz"} | ${fmtDate()}</div>
    </body></html>`);
    w.document.close();
    setTimeout(()=>w.print(),500);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
      <div style={{background:"#0d1424",border:"1px solid rgba(14,165,233,0.3)",borderRadius:16,padding:22,maxWidth:620,width:"100%",maxHeight:"95vh",overflowY:"auto"}}>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:"#0ea5e9"}}>💰 Presupuesto {quoteNum}</div>
            <div style={{fontSize:11,color:"#4a7a9a"}}>{vehicle.brand} {vehicle.model} {vehicle.year} — {vehicle.client||"Sin cliente"}</div>
          </div>
          <div style={{fontSize:20}}>{country.flag}</div>
        </div>

        {/* Items */}
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
          {items.map(item=>(
            <div key={item.id} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"10px 12px",display:"grid",gridTemplateColumns:"100px 1fr 50px 90px 30px",gap:8,alignItems:"center"}}>
              <select value={item.category} onChange={e=>updateItem(item.id,"category",e.target.value)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"5px",color:"#e0e6f0",fontSize:11,fontFamily:"inherit",outline:"none"}}>
                <option value="diag">🔧 Diag.</option>
                <option value="parts">🔩 Refac.</option>
                <option value="labor">👨‍🔧 M.O.</option>
                <option value="other">📦 Otro</option>
              </select>
              <input value={item.desc} onChange={e=>updateItem(item.id,"desc",e.target.value)} placeholder="Descripción..." style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"5px 8px",color:"#e0e6f0",fontSize:12,fontFamily:"inherit",outline:"none"}}/>
              <input type="number" value={item.qty} onChange={e=>updateItem(item.id,"qty",e.target.value)} min="1" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"5px",color:"#e0e6f0",fontSize:12,fontFamily:"inherit",outline:"none",textAlign:"center"}}/>
              <input type="number" value={item.price} onChange={e=>updateItem(item.id,"price",e.target.value)} placeholder="Precio" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"5px 8px",color:"#e0e6f0",fontSize:12,fontFamily:"inherit",outline:"none"}}/>
              <button onClick={()=>removeItem(item.id)} style={{background:"rgba(239,68,68,0.1)",border:"none",borderRadius:6,color:"#ef4444",fontSize:14,cursor:"pointer",padding:"4px"}}>✕</button>
            </div>
          ))}
        </div>

        {/* Add item buttons */}
        <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
          {[["diag","🔧 + Diagnóstico","#0ea5e9"],["parts","🔩 + Refacción","#f59e0b"],["labor","👨‍🔧 + Mano de obra","#a78bfa"],["other","📦 + Otro","#4ade80"]].map(([cat,lbl,color])=>(
            <button key={cat} onClick={()=>addItem(cat)} style={{background:`rgba(${color==="#0ea5e9"?"14,165,233":color==="#f59e0b"?"245,158,11":color==="#a78bfa"?"167,139,250":"74,222,128"},0.08)`,border:`1px solid ${color}44`,borderRadius:7,padding:"6px 12px",color,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{lbl}</button>
          ))}
        </div>

        {/* Tax */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,padding:"10px 14px",background:"rgba(255,255,255,0.03)",borderRadius:8}}>
          <div style={{fontSize:12,color:"#4a7a9a",flex:1}}>{country.taxName} ({country.name})</div>
          <input type="number" value={taxRate} onChange={e=>setTaxRate(Number(e.target.value))} min="0" max="30" style={{width:60,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"5px",color:"#e0e6f0",fontSize:13,fontFamily:"inherit",outline:"none",textAlign:"center"}}/>
          <div style={{fontSize:12,color:"#4a7a9a"}}>%</div>
        </div>

        {/* Notes */}
        <div style={{marginBottom:14}}>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notas para el cliente..." rows={2} style={{width:"100%",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"8px 12px",color:"#e0e6f0",fontSize:12,fontFamily:"inherit",outline:"none",resize:"none",boxSizing:"border-box"}}/>
        </div>

        {/* Totals */}
        <div style={{background:"rgba(14,165,233,0.06)",border:"1px solid rgba(14,165,233,0.2)",borderRadius:10,padding:"12px 16px",marginBottom:16}}>
          {[["Subtotal",subtotal],[(country.taxName+` (${taxRate}%)`),tax]].map(([lbl,val])=>(
            <div key={lbl} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#6a9abc",marginBottom:4}}>
              <span>{lbl}</span><span>{fmtMoney(val,config.country)}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:700,color:"#0ea5e9",borderTop:"1px solid rgba(14,165,233,0.2)",paddingTop:8,marginTop:4}}>
            <span>TOTAL</span><span>{fmtMoney(total,config.country)}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={generateWhatsAppLink} style={{flex:1,minWidth:140,padding:"11px 0",background:"linear-gradient(135deg,#25d366,#128c7e)",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            📱 Enviar por WhatsApp
          </button>
          <button onClick={printQuote} style={{flex:1,minWidth:120,padding:"11px 0",background:"linear-gradient(135deg,#0ea5e9,#0369a1)",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            🖨️ PDF / Imprimir
          </button>
          <button onClick={onClose} style={{padding:"11px 16px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,color:"#6a8aaa",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SETTINGS MODAL ──────────────────────────────────────────────────
function SettingsModal({ config, onSave, onClose }) {
  const [c, setC] = useState(config);
  const u = (k,v) => setC(p=>({...p,[k]:v}));
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#0d1424",border:"1px solid rgba(14,165,233,0.3)",borderRadius:16,padding:22,maxWidth:480,width:"100%",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{fontSize:15,fontWeight:700,color:"#0ea5e9",marginBottom:16}}>⚙️ Configuración DIAGIA.co</div>

        {[["techName","Tu nombre / Técnico"],["company","Nombre de la empresa"]].map(([k,lbl])=>(
          <div key={k} style={{marginBottom:12}}>
            <div style={{fontSize:11,color:"#4a7a9a",marginBottom:4}}>{lbl}</div>
            <input value={c[k]||""} onChange={e=>u(k,e.target.value)} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"8px 12px",color:"#e0e6f0",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
          </div>
        ))}

        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:"#4a7a9a",marginBottom:4}}>País activo</div>
          <select value={c.country||"US"} onChange={e=>u("country",e.target.value)} style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"8px 12px",color:"#e0e6f0",fontSize:13,fontFamily:"inherit",outline:"none"}}>
            {COUNTRIES.map(ct=><option key={ct.code} value={ct.code}>{ct.flag} {ct.name} — {ct.currency}</option>)}
          </select>
        </div>

        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,color:"#4a7a9a",marginBottom:4}}>Precio base de diagnóstico</div>
          <input type="number" value={c.diagPrice||85} onChange={e=>u("diagPrice",Number(e.target.value))} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"8px 12px",color:"#e0e6f0",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
        </div>

        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>onSave(c)} style={{flex:1,padding:"10px 0",background:"linear-gradient(135deg,#0ea5e9,#0369a1)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Guardar</button>
          <button onClick={onClose} style={{padding:"10px 16px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"#6a8aaa",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("garage");
  const [vehicles, setVehicles] = useState(()=>DB.get("dv4_vehicles"));
  const [cases, setCases] = useState(()=>DB.get("dv4_cases"));
  const [quotes, setQuotes] = useState(()=>DB.get("dv4_quotes"));
  const [config, setConfig] = useState(()=>DB.get("dv4_config",{country:"US",techName:"",company:"DIAGIA.co",diagPrice:85}));
  const [activeVehicle, setActiveVehicle] = useState(null);
  const [activeCase, setActiveCase] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [showQuote, setShowQuote] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState([{role:"assistant",content:"# 🔧 DIAGIA.co v4.0 Pro\n\nSelecciona un vehículo del Garage para comenzar el diagnóstico."}]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [dtcSearch, setDtcSearch] = useState("");
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const scanRef = useRef(null);
  const diagRef = useRef(null);
  const otherRef = useRef(null);

  useEffect(()=>{ DB.set("dv4_vehicles",vehicles); },[vehicles]);
  useEffect(()=>{ DB.set("dv4_cases",cases); },[cases]);
  useEffect(()=>{ DB.set("dv4_quotes",quotes); },[quotes]);
  useEffect(()=>{ DB.set("dv4_config",config); },[config]);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,loading]);

  const country = COUNTRIES.find(c=>c.code===config.country)||COUNTRIES[0];

  const saveVehicle = (form) => {
    if (editVehicle) {
      setVehicles(p=>p.map(v=>v.id===editVehicle.id?{...editVehicle,...form}:v));
    } else {
      setVehicles(p=>[{...form,id:uid(),createdAt:fmtDate(),status:"open"},...p]);
    }
    setShowForm(false); setEditVehicle(null);
  };

  const openDiagnostic = (vehicle) => {
    setActiveVehicle(vehicle);
    const vCases = cases.filter(c=>c.vehicleId===vehicle.id);
    const last = vCases.filter(c=>c.status==="open").slice(-1)[0];
    if (last) {
      setActiveCase(last);
      setMessages(last.messages||[]);
    } else {
      const nc = { id:uid(), vehicleId:vehicle.id, createdAt:fmtDate(), status:"open",
        messages:[{role:"assistant",content:`# 🔧 ${vehicle.brand} ${vehicle.model} ${vehicle.year}\n\n**Motor:** ${vehicle.engine} | **Km:** ${vehicle.km||"N/A"} | **Tipo:** ${vehicle.type==="heavy"?"🚛 Pesado":"🚗 Ligero"}\n${vehicle.client?`**Cliente:** ${vehicle.client} ${vehicle.phone?`| 📞 ${vehicle.phone}`:""}`:""}${vehicle.notes?`\n**Síntoma inicial:** ${vehicle.notes}`:""}\n\n---\n\n¿Cuál es el síntoma que reporta el cliente hoy?`}]};
      setCases(p=>[...p,nc]);
      setActiveCase(nc);
      setMessages(nc.messages);
    }
    setTab("diag");
  };

  const updateCase = (msgs) => {
    if (!activeCase) return;
    setCases(p=>p.map(c=>c.id===activeCase.id?{...c,messages:msgs}:c));
    setActiveCase(p=>({...p,messages:msgs}));
  };

  const toBase64 = f => new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(f); });
  const handleUpload = async (e,label) => {
    const imgs = await Promise.all(Array.from(e.target.files).map(async f=>({base64:await toBase64(f),preview:URL.createObjectURL(f),mediaType:f.type,label})));
    setImages(p=>[...p,...imgs]);
  };

  const sendMessage = async () => {
    if ((!input.trim()&&!images.length)||loading) return;
    const userContent = images.length>0
      ? [...images.map(img=>({type:"image",source:{type:"base64",media_type:img.mediaType,data:img.base64}})),{type:"text",text:input.trim()||"Analiza esta imagen."}]
      : input.trim();
    const userMsg = {role:"user",content:userContent,displayContent:input.trim()||`📸 ${images.length} imagen(es)`,hasImages:images.length>0,imagePreviews:images.map(i=>i.preview)};
    const newMsgs = [...messages,userMsg];
    setMessages(newMsgs); updateCase(newMsgs);
    setImages([]); setInput(""); setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height="auto";
    try {
      const ctx = activeVehicle ? `VEHÍCULO: ${activeVehicle.brand} ${activeVehicle.model} ${activeVehicle.year} | Motor: ${activeVehicle.engine} | Km: ${activeVehicle.km||"N/A"} | Tipo: ${activeVehicle.type==="heavy"?"PESADO 24V J1939":"LIGERO OBD-II"}\n\n` : "";
      const apiMsgs = newMsgs.map(m=>({role:m.role,content:m.content}));
      if (!apiMsgs.length||apiMsgs[0].role!=="user") apiMsgs.unshift({role:"user",content:"Inicio"});
      const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:ctx+SYSTEM_PROMPT,messages:apiMsgs})});
      const data = await res.json();
      const text = data.content?.map(b=>b.text||"").join("\n")||"Error.";
      const final = [...newMsgs,{role:"assistant",content:text}];
      setMessages(final); updateCase(final);
      if (text.includes("🎯")) setCases(p=>p.map(c=>c.id===activeCase?.id?{...c,status:"resolved"}:c));
    } catch {
      const err = [...newMsgs,{role:"assistant",content:"⚠️ Error de conexión."}];
      setMessages(err); updateCase(err);
    } finally { setLoading(false); }
  };

  const handleKeyDown = e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} };
  const handleChange = e=>{ setInput(e.target.value); e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"; };

  // Dashboard stats
  const todayCases = cases.filter(c=>c.createdAt===fmtDate());
  const resolvedTotal = cases.filter(c=>c.status==="resolved").length;
  const pendingQuotes = quotes.filter(q=>q.status==="pending").length;
  const totalRevenue = quotes.filter(q=>q.status==="approved").reduce((s,q)=>s+q.total,0);

  const dtcList = [
    {code:"P0171",desc:"Sistema pobre banco 1",sys:"Combustible",sev:"Media"},
    {code:"P0300",desc:"Falla de encendido múltiple",sys:"Encendido",sev:"Alta"},
    {code:"P0420",desc:"Eficiencia catalizador baja banco 1",sys:"Emisiones",sev:"Media"},
    {code:"P0442",desc:"Fuga pequeña EVAP",sys:"EVAP",sev:"Baja"},
    {code:"P0455",desc:"Fuga grande EVAP",sys:"EVAP",sev:"Media"},
    {code:"P0101",desc:"Sensor MAF fuera de rango",sys:"Motor",sev:"Media"},
    {code:"P0301",desc:"Falla encendido cilindro 1",sys:"Encendido",sev:"Alta"},
    {code:"P0340",desc:"Circuito sensor CMP banco 1",sys:"Motor",sev:"Alta"},
    {code:"P0505",desc:"Sistema control de ralentí",sys:"Motor",sev:"Media"},
    {code:"U0100",desc:"Comunicación perdida ECM/PCM",sys:"Red CAN",sev:"Alta"},
    {code:"C0035",desc:"Sensor velocidad rueda del. izq.",sys:"ABS",sev:"Alta"},
    {code:"B1000",desc:"ECU airbag — falla interna",sys:"SRS",sev:"Alta"},
    {code:"SPN 651 FMI 5",desc:"Inyector cil.1 circuito abierto (J1939)",sys:"Pesado",sev:"Alta"},
    {code:"SPN 100 FMI 1",desc:"Presión aceite motor baja (J1939)",sys:"Pesado",sev:"Alta"},
    {code:"SPN 3216 FMI 0",desc:"NOx sensor 1 valor alto (J1939)",sys:"Pesado",sev:"Media"},
    {code:"SPN 3031 FMI 1",desc:"Nivel DEF bajo (J1939)",sys:"Pesado",sev:"Media"},
  ];
  const filteredDTC = dtcList.filter(d=>
    d.code.toLowerCase().includes(dtcSearch.toLowerCase())||
    d.desc.toLowerCase().includes(dtcSearch.toLowerCase())||
    d.sys.toLowerCase().includes(dtcSearch.toLowerCase())
  );
  const sevColor = s=>s==="Alta"?"#ef4444":s==="Media"?"#f59e0b":"#4ade80";

  return (
    <div style={{minHeight:"100vh",background:"#070b16",display:"flex",flexDirection:"column",fontFamily:"'DM Mono',monospace",color:"#e0e6f0"}}>

      {/* HEADER */}
      <div style={{background:"linear-gradient(135deg,#0b1220,#090f1c)",borderBottom:"1px solid #162840",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:20}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:38,height:38,background:"linear-gradient(135deg,#0ea5e9,#0369a1)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,boxShadow:"0 0 16px rgba(14,165,233,0.3)"}}>🔧</div>
          <div>
            <div style={{fontSize:16,fontWeight:700,letterSpacing:"0.06em"}}>DIAG<span style={{color:"#0ea5e9"}}>IA</span><span style={{color:"#4a7a9a"}}>.co</span><span style={{fontSize:9,color:"#2a5070",marginLeft:6}}>v4.0 Pro</span></div>
            <div style={{fontSize:9,color:"#2a5070",letterSpacing:"0.1em"}}>{country.flag} {country.name} · {country.currency}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {activeVehicle&&tab==="diag"&&(
            <>
              <div style={{background:"rgba(14,165,233,0.08)",border:"1px solid rgba(14,165,233,0.2)",borderRadius:6,padding:"3px 9px",fontSize:10,color:"#4a9fc8",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {activeVehicle.type==="heavy"?"🚛":"🚗"} {activeVehicle.brand} {activeVehicle.model}
              </div>
              <button onClick={()=>setShowQuote(true)} style={{background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.25)",borderRadius:6,padding:"5px 10px",color:"#4ade80",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>💰 Presupuesto</button>
            </>
          )}
          <button onClick={()=>setShowSettings(true)} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"5px 10px",color:"#6a8aaa",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>⚙️</button>
        </div>
      </div>

      {/* TABS */}
      <div style={{background:"rgba(7,11,22,0.95)",borderBottom:"1px solid #0f1f35",display:"flex",padding:"0 16px",overflowX:"auto"}}>
        {[["dash","📊 Dashboard"],["garage","🚗 Garage"],["diag","🔧 Diagnóstico"],["quotes","💰 Presupuestos"],["study","📚 Estudio"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:"11px 14px",background:"transparent",border:"none",borderBottom:`2px solid ${tab===id?"#0ea5e9":"transparent"}`,color:tab===id?"#0ea5e9":"#4a6a8a",fontSize:11,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.05em",whiteSpace:"nowrap"}}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab==="dash"&&(
        <div style={{flex:1,overflowY:"auto",padding:"20px 16px",maxWidth:840,width:"100%",margin:"0 auto"}}>
          <div style={{fontSize:14,fontWeight:700,color:"#e0e6f0",marginBottom:16}}>Buenos días{config.techName?`, ${config.techName}`:""} 👋</div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
            {[
              ["🚗","Vehículos",vehicles.length,"registrados","#0ea5e9"],
              ["🔧","Casos hoy",todayCases.length,"abiertos","#f59e0b"],
              ["✅","Resueltos",resolvedTotal,"total","#4ade80"],
              ["💰","Ingresos",`${country.symbol}${totalRevenue.toFixed(0)}`,"aprobados","#a78bfa"],
            ].map(([icon,lbl,val,sub,color])=>(
              <div key={lbl} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${color}22`,borderRadius:12,padding:"16px"}}>
                <div style={{fontSize:22,marginBottom:6}}>{icon}</div>
                <div style={{fontSize:22,fontWeight:700,color}}>{val}</div>
                <div style={{fontSize:11,color:"#4a7a9a"}}>{lbl} · {sub}</div>
              </div>
            ))}
          </div>

          <div style={{fontSize:13,fontWeight:700,color:"#0ea5e9",marginBottom:10}}>Casos recientes</div>
          {cases.slice(-5).reverse().map(c=>{
            const v = vehicles.find(x=>x.id===c.vehicleId);
            return v?(
              <div key={c.id} onClick={()=>{openDiagnostic(v);}} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"12px 16px",marginBottom:8,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:13,color:"#e0e6f0"}}>{v.type==="heavy"?"🚛":"🚗"} {v.brand} {v.model} {v.year}</div>
                  <div style={{fontSize:11,color:"#4a7a9a"}}>{c.createdAt} · {v.client||"Sin cliente"}</div>
                </div>
                <div style={{fontSize:10,background:c.status==="resolved"?"rgba(74,222,128,0.1)":"rgba(14,165,233,0.1)",color:c.status==="resolved"?"#4ade80":"#0ea5e9",border:`1px solid ${c.status==="resolved"?"rgba(74,222,128,0.3)":"rgba(14,165,233,0.3)"}`,borderRadius:5,padding:"3px 8px"}}>
                  {c.status==="resolved"?"✅ Resuelto":"🔄 Activo"}
                </div>
              </div>
            ):null;
          })}
          {cases.length===0&&<div style={{textAlign:"center",color:"#2a4a6a",padding:"30px 0",fontSize:13}}>No hay casos aún. Agrega un vehículo para comenzar.</div>}
        </div>
      )}

      {/* ── GARAGE ── */}
      {tab==="garage"&&(
        <div style={{flex:1,overflowY:"auto",padding:"16px",maxWidth:840,width:"100%",margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:12,color:"#4a7a9a"}}>{vehicles.length} vehículo(s)</div>
            <button onClick={()=>{setShowForm(true);setEditVehicle(null);}} style={{background:"linear-gradient(135deg,#0ea5e9,#0369a1)",border:"none",borderRadius:8,padding:"7px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Nuevo Vehículo</button>
          </div>
          {showForm&&<div style={{marginBottom:14}}><VehicleForm onSave={saveVehicle} onCancel={()=>{setShowForm(false);setEditVehicle(null);}} initial={editVehicle}/></div>}
          {vehicles.length===0&&!showForm&&(
            <div style={{textAlign:"center",padding:"50px 0",color:"#2a4a6a"}}>
              <div style={{fontSize:40,marginBottom:10}}>🚗</div>
              <div style={{fontSize:13}}>Sin vehículos. Agrega el primero.</div>
            </div>
          )}
          {vehicles.map(v=>{
            const vq = quotes.filter(q=>q.vehicleId===v.id);
            const vc = cases.filter(c=>c.vehicleId===v.id);
            return (
              <div key={v.id} style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${v.status==="resolved"?"rgba(74,222,128,0.15)":"rgba(255,255,255,0.07)"}`,borderRadius:12,padding:14,marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
                      <span style={{fontSize:16}}>{v.type==="heavy"?"🚛":"🚗"}</span>
                      <span style={{fontSize:14,fontWeight:700,color:"#e0e6f0"}}>{v.brand} {v.model}</span>
                      <span style={{fontSize:12,color:"#4a7a9a"}}>{v.year}</span>
                      <span style={{fontSize:10,background:v.status==="resolved"?"rgba(74,222,128,0.1)":"rgba(14,165,233,0.1)",color:v.status==="resolved"?"#4ade80":"#0ea5e9",border:`1px solid ${v.status==="resolved"?"rgba(74,222,128,0.3)":"rgba(14,165,233,0.3)"}`,borderRadius:4,padding:"2px 6px"}}>
                        {v.status==="resolved"?"✅ Resuelto":"🔄 Activo"}
                      </span>
                    </div>
                    <div style={{fontSize:11,color:"#4a7a9a",display:"flex",gap:12,flexWrap:"wrap"}}>
                      <span>⚙️ {v.engine}</span>
                      {v.km&&<span>📍 {v.km} km</span>}
                      {v.vin&&<span>🔑 {v.vin}</span>}
                      {v.client&&<span>👤 {v.client}</span>}
                      {v.phone&&<span>📞 {v.phone}</span>}
                      <span>📋 {vc.length} caso(s)</span>
                      <span>💰 {vq.length} presupuesto(s)</span>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button onClick={()=>openDiagnostic(v)} style={{background:"linear-gradient(135deg,#0ea5e9,#0369a1)",border:"none",borderRadius:8,padding:"7px 12px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🔧 Diagnosticar</button>
                    <button onClick={()=>{setEditVehicle(v);setShowForm(true);}} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"7px 9px",color:"#6a8aaa",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
                    <button onClick={()=>setVehicles(p=>p.filter(x=>x.id!==v.id))} style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"7px 9px",color:"#ef4444",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── DIAGNOSTIC ── */}
      {tab==="diag"&&(
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {!activeVehicle?(
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14,color:"#2a4a6a",padding:20,textAlign:"center"}}>
              <div style={{fontSize:44}}>🔧</div>
              <div style={{fontSize:13}}>Selecciona un vehículo del Garage para comenzar</div>
              <button onClick={()=>setTab("garage")} style={{background:"linear-gradient(135deg,#0ea5e9,#0369a1)",border:"none",borderRadius:8,padding:"9px 18px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Ir al Garage</button>
            </div>
          ):(
            <>
              <div style={{flex:1,overflowY:"auto",padding:"14px",display:"flex",flexDirection:"column",gap:12,maxWidth:840,width:"100%",margin:"0 auto"}}>
                {messages.map((msg,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start",animation:"fadeIn 0.3s ease"}}>
                    {msg.role==="assistant"&&<div style={{width:28,height:28,minWidth:28,background:"linear-gradient(135deg,#0ea5e9,#0369a1)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,marginRight:9,marginTop:3}}>🔧</div>}
                    <div style={{maxWidth:"86%",display:"flex",flexDirection:"column",alignItems:msg.role==="user"?"flex-end":"flex-start",gap:5}}>
                      {msg.hasImages&&msg.imagePreviews&&(
                        <div style={{display:"flex",gap:5,flexWrap:"wrap",justifyContent:msg.role==="user"?"flex-end":"flex-start"}}>
                          {msg.imagePreviews.map((src,j)=><img key={j} src={src} alt="" style={{width:90,height:70,objectFit:"cover",borderRadius:8,border:"1px solid rgba(14,165,233,0.3)"}}/>)}
                        </div>
                      )}
                      <div style={{background:msg.role==="user"?"linear-gradient(135deg,#0ea5e9,#0369a1)":"rgba(255,255,255,0.03)",border:msg.role==="user"?"none":"1px solid rgba(255,255,255,0.07)",borderRadius:msg.role==="user"?"13px 13px 4px 13px":"4px 13px 13px 13px",padding:"10px 14px",fontSize:13,lineHeight:1.75,color:msg.role==="user"?"#fff":"#cdd6f4"}}>
                        {msg.role==="assistant"?<MsgContent content={msg.content}/>:<p style={{margin:0}}>{msg.displayContent||msg.content}</p>}
                      </div>
                    </div>
                  </div>
                ))}
                {loading&&(
                  <div style={{display:"flex",alignItems:"center",gap:9}}>
                    <div style={{width:28,height:28,background:"linear-gradient(135deg,#0ea5e9,#0369a1)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🔧</div>
                    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"4px 13px 13px 13px",padding:"11px 16px",display:"flex",gap:5,alignItems:"center"}}>
                      {[0,1,2].map(j=><div key={j} style={{width:7,height:7,background:"#0ea5e9",borderRadius:"50%",animation:`pulse 1.2s ease-in-out ${j*0.2}s infinite`}}/>)}
                      <span style={{fontSize:11,color:"#2a5a7a",marginLeft:5}}>Analizando...</span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef}/>
              </div>
              <div style={{background:"rgba(7,11,22,0.98)",borderTop:"1px solid #162840",padding:"10px 14px"}}>
                <div style={{maxWidth:840,margin:"0 auto"}}>
                  {images.length>0&&(
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                      {images.map((img,i)=>(
                        <div key={i} style={{position:"relative"}}>
                          <img src={img.preview} alt="" style={{width:54,height:54,objectFit:"cover",borderRadius:7,border:"1px solid rgba(14,165,233,0.35)"}}/>
                          <button onClick={()=>setImages(p=>p.filter((_,j)=>j!==i))} style={{position:"absolute",top:-5,right:-5,width:15,height:15,borderRadius:"50%",background:"#ef4444",border:"none",color:"#fff",fontSize:8,cursor:"pointer"}}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
                    {[[scanRef,"📟 Escáner","#0ea5e9"],[diagRef,"📐 Diagrama","#a78bfa"],[otherRef,"📷 Foto","#f59e0b"]].map(([ref,lbl,color])=>(
                      <div key={lbl}>
                        <input type="file" accept="image/*" multiple style={{display:"none"}} ref={ref} onChange={e=>{handleUpload(e,lbl);e.target.value="";}}/>
                        <button onClick={()=>ref.current?.click()} style={{background:`rgba(${color==="#0ea5e9"?"14,165,233":color==="#a78bfa"?"167,139,250":"245,158,11"},0.08)`,border:`1px solid ${color}44`,borderRadius:7,padding:"6px 10px",color,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{lbl}</button>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                    <textarea ref={textareaRef} value={input} onChange={handleChange} onKeyDown={handleKeyDown} placeholder="Describe el síntoma o responde al paso... (Enter para enviar)" rows={1} style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(14,165,233,0.2)",borderRadius:9,padding:"10px 13px",color:"#e0e6f0",fontSize:13,fontFamily:"inherit",resize:"none",outline:"none",lineHeight:1.6}} onFocus={e=>e.target.style.borderColor="rgba(14,165,233,0.5)"} onBlur={e=>e.target.style.borderColor="rgba(14,165,233,0.2)"}/>
                    <button onClick={sendMessage} disabled={loading||(!input.trim()&&!images.length)} style={{width:42,height:42,minWidth:42,background:(loading||(!input.trim()&&!images.length))?"rgba(14,165,233,0.1)":"linear-gradient(135deg,#0ea5e9,#0369a1)",border:"none",borderRadius:9,cursor:(loading||(!input.trim()&&!images.length))?"not-allowed":"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>➤</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── QUOTES ── */}
      {tab==="quotes"&&(
        <div style={{flex:1,overflowY:"auto",padding:"16px",maxWidth:840,width:"100%",margin:"0 auto"}}>
          <div style={{fontSize:14,fontWeight:700,color:"#0ea5e9",marginBottom:4}}>💰 Presupuestos</div>
          <div style={{fontSize:11,color:"#4a7a9a",marginBottom:16}}>{pendingQuotes} pendiente(s) de aprobación</div>
          {quotes.length===0&&(
            <div style={{textAlign:"center",padding:"50px 0",color:"#2a4a6a"}}>
              <div style={{fontSize:40,marginBottom:10}}>💰</div>
              <div style={{fontSize:13}}>Sin presupuestos. Abre un diagnóstico y genera uno.</div>
            </div>
          )}
          {quotes.slice().reverse().map(q=>{
            const v = vehicles.find(x=>x.id===q.vehicleId);
            const qCountry = COUNTRIES.find(c=>c.code===q.country)||COUNTRIES[0];
            return v?(
              <div key={q.id} style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${q.status==="approved"?"rgba(74,222,128,0.2)":q.status==="rejected"?"rgba(239,68,68,0.2)":"rgba(255,255,255,0.07)"}`,borderRadius:12,padding:14,marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#e0e6f0",marginBottom:4}}>#{q.num}</div>
                    <div style={{fontSize:12,color:"#cdd6f4"}}>{v.brand} {v.model} {v.year}</div>
                    <div style={{fontSize:11,color:"#4a7a9a",marginTop:2}}>{v.client||"Sin cliente"} · {q.createdAt} · {qCountry.flag}</div>
                    <div style={{fontSize:14,fontWeight:700,color:"#0ea5e9",marginTop:6}}>{qCountry.symbol}{q.total?.toFixed(2)}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                    <div style={{fontSize:10,background:q.status==="approved"?"rgba(74,222,128,0.1)":q.status==="rejected"?"rgba(239,68,68,0.1)":"rgba(245,158,11,0.1)",color:q.status==="approved"?"#4ade80":q.status==="rejected"?"#ef4444":"#f59e0b",border:`1px solid ${q.status==="approved"?"rgba(74,222,128,0.3)":q.status==="rejected"?"rgba(239,68,68,0.3)":"rgba(245,158,11,0.3)"}`,borderRadius:5,padding:"3px 8px"}}>
                      {q.status==="approved"?"✅ Aprobado":q.status==="rejected"?"❌ Rechazado":"⏳ Pendiente"}
                    </div>
                    {q.status==="pending"&&(
                      <div style={{display:"flex",gap:4}}>
                        <button onClick={()=>setQuotes(p=>p.map(x=>x.id===q.id?{...x,status:"approved"}:x))} style={{background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.3)",borderRadius:6,padding:"4px 8px",color:"#4ade80",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✅ Aprobar</button>
                        <button onClick={()=>setQuotes(p=>p.map(x=>x.id===q.id?{...x,status:"rejected"}:x))} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:6,padding:"4px 8px",color:"#ef4444",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>❌ Rechazar</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ):null;
          })}
        </div>
      )}

      {/* ── STUDY ── */}
      {tab==="study"&&(
        <div style={{flex:1,overflowY:"auto",padding:"16px",maxWidth:840,width:"100%",margin:"0 auto"}}>
          <div style={{fontSize:14,fontWeight:700,color:"#0ea5e9",marginBottom:4}}>📚 Biblioteca DTC</div>
          <div style={{fontSize:11,color:"#4a7a9a",marginBottom:14}}>OBD-II · J1939 · ABS · SRS · EVAP</div>
          <input value={dtcSearch} onChange={e=>setDtcSearch(e.target.value)} placeholder="Buscar código, descripción, sistema..." style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(14,165,233,0.2)",borderRadius:9,padding:"10px 13px",color:"#e0e6f0",fontSize:13,fontFamily:"inherit",outline:"none",marginBottom:14,boxSizing:"border-box"}}/>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {filteredDTC.map((d,i)=>(
              <div key={i} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:9,padding:"10px 14px",display:"flex",alignItems:"center",gap:12}}>
                <div style={{minWidth:110,fontSize:12,fontWeight:700,color:"#0ea5e9",fontFamily:"monospace"}}>{d.code}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,color:"#cdd6f4"}}>{d.desc}</div>
                  <div style={{fontSize:10,color:"#4a7a9a",marginTop:2}}>{d.sys}</div>
                </div>
                <div style={{fontSize:10,background:`${sevColor(d.sev)}18`,color:sevColor(d.sev),border:`1px solid ${sevColor(d.sev)}44`,borderRadius:5,padding:"2px 7px",whiteSpace:"nowrap"}}>{d.sev}</div>
              </div>
            ))}
          </div>

          <div style={{marginTop:24,fontSize:13,fontWeight:700,color:"#0ea5e9",marginBottom:12}}>🛠️ Kit de Herramientas</div>
          {[
            ["📟","Thinkscan Plus S2","Ligeros OBD-II","Scan → Marca → Sistema → Datos en vivo","#0ea5e9"],
            ["📐","Innova 3320","Multímetro","VDC · Ω · Continuidad — indica punta roja y negra","#f59e0b"],
            ["⚡","Autel PS100","Power Probe","Alimenta componentes directamente · V + A simultáneo","#f97316"],
            ["🔌","FNIRSI DMC-100","Pinzas amperimétricas","Abraza el cable · consumo en tiempo real","#a78bfa"],
            ["🔦","Lámpara de prueba","Verificación rápida","Clip a masa · punta al terminal · siempre primero","#facc15"],
            ["💨","HyperSmoke","Máquina de humo","EVAP y vacío · humo sale exactamente en la fuga","#4ade80"],
            ["🚛","Launch X431 Pro5 + SmartLink HD","(Futuro) Pesados 12V/24V","Kenworth · Peterbilt · Freightliner · Cummins · Detroit","#60a5fa"],
          ].map(([icon,name,type,tip,color])=>(
            <div key={name} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:9,padding:"11px 14px",marginBottom:7,display:"flex",gap:11,alignItems:"flex-start"}}>
              <div style={{fontSize:20,minWidth:28,textAlign:"center"}}>{icon}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color}}>{name}</div>
                <div style={{fontSize:10,color:"#4a7a9a",marginBottom:3}}>{type}</div>
                <div style={{fontSize:11,color:"#6a8aaa"}}>{tip}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODALS */}
      {showQuote&&activeVehicle&&(
        <QuoteBuilder vehicle={activeVehicle} config={config} onClose={()=>setShowQuote(false)}
          onSend={(q)=>{ setQuotes(p=>[...p,q]); setShowQuote(false); }}/>
      )}
      {showSettings&&(
        <SettingsModal config={config} onSave={(c)=>{setConfig(c);setShowSettings(false);}} onClose={()=>setShowSettings(false)}/>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
        ::-webkit-scrollbar{width:3px;height:3px} ::-webkit-scrollbar-track{background:#070b16} ::-webkit-scrollbar-thumb{background:#162840;border-radius:4px}
        .mc h1{font-size:15px;font-weight:700;color:#e0e6f0;margin-bottom:8px}
        .mc h2{font-size:13px;font-weight:600;color:#0ea5e9;margin:12px 0 5px}
        .mc p{margin-bottom:5px;font-size:13px}
        .mc hr{border:none;border-top:1px solid rgba(255,255,255,0.06);margin:10px 0}
        .mc .step-h{color:#0ea5e9;font-weight:700;font-size:12px;margin:13px 0 7px;padding:7px 12px;background:rgba(14,165,233,0.07);border-left:3px solid #0ea5e9;border-radius:0 8px 8px 0}
        .mc .step-d{padding:3px 0 3px 10px;border-left:2px solid rgba(14,165,233,0.15);margin-left:4px;margin-bottom:4px;color:#8aaecc;font-size:12px}
        .mc .confirmed{background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:9px 13px;margin:9px 0;color:#4ade80;font-weight:700;font-size:12px}
        .mc .action-line{background:rgba(14,165,233,0.05);border-left:3px solid #0ea5e9;padding:5px 10px;border-radius:0 6px 6px 0;color:#7dd3fc;font-size:12px;margin:4px 0}
        .mc .diff{color:#f59e0b;font-size:12px;margin:3px 0}
        .mc .disc{color:#1e4a2e;text-decoration:line-through;font-size:12px}
        .mc strong{color:#7dd3fc}
      `}</style>
    </div>
  );
}

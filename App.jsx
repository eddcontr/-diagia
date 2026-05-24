import { useState, useRef, useEffect } from "react";

// ─── STORAGE HELPERS ───────────────────────────────────────────────
const DB = {
  get: (key) => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } },
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
};

// ─── SYSTEM PROMPT ─────────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres un mecánico automotriz senior con 25 años de experiencia en diagnóstico eléctrico, mecánico y de vehículos pesados. Conoces perfectamente las herramientas del técnico.

HERRAMIENTAS DISPONIBLES:
1. ESCÁNER LIGEROS: Thinkcar Thinkscan Plus S2 → Scan → [marca] → Sistema → Datos en vivo
2. ESCÁNER PESADOS (futuro): Launch X431 Pro5 + SmartLink HD → cubre 12V y 24V, Kenworth, Peterbilt, Freightliner, Cummins, Detroit
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
5. Para PS100: qué terminal, qué función, qué muestra la pantalla
6. Para FNIRSI: qué cable abraza, modo, valor normal
7. AVANZA cuando recibas resultado, NUNCA retrocedas
8. Marca ✅ DESCARTADO lo que ya se revisó
9. Eléctrico: Fusible → Masa → Señal → Componente
10. Pesados: identifica si es J1939, menciona SPN/FMI cuando aplique

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

// ─── INITIAL MESSAGE ────────────────────────────────────────────────
const WELCOME = `# 🔧 DIAGIA v3.0

Bienvenido. Sistema completo de diagnóstico automotriz.

**Vehículos ligeros y pesados** — Kenworth, Peterbilt, Freightliner, autos, pickups y más.

Para comenzar un diagnóstico selecciona un vehículo del Garage o crea uno nuevo.`;

// ─── HELPERS ────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function now() { return new Date().toLocaleDateString("es-MX", { day:"2-digit", month:"2-digit", year:"numeric" }); }

// ─── MESSAGE RENDERER ───────────────────────────────────────────────
function MessageContent({ content }) {
  return (
    <div className="msg-content">
      {content.split("\n").map((line, i) => {
        if (line.startsWith("# ")) return <h1 key={i}>{line.slice(2)}</h1>;
        if (line.startsWith("## ")) return <h2 key={i}>{line.slice(3)}</h2>;
        if (line.startsWith("🎯")) return <p key={i} className="confirmed">{line}</p>;
        if (line.startsWith("🔧") && line.includes("ACCIÓN")) return <p key={i} className="action">{line}</p>;
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

// ─── VEHICLE FORM ───────────────────────────────────────────────────
function VehicleForm({ onSave, onCancel, initial }) {
  const [form, setForm] = useState(initial || {
    type:"light", vin:"", brand:"", model:"", year:"", engine:"", km:"",
    client:"", phone:"", notes:""
  });
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  return (
    <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:20,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontSize:14,fontWeight:700,color:"#0ea5e9",marginBottom:4}}>
        {initial ? "✏️ Editar Vehículo" : "🚗 Nuevo Vehículo"}
      </div>

      {/* Type */}
      <div style={{display:"flex",gap:8}}>
        {[["light","🚗 Ligero"],["heavy","🚛 Pesado"]].map(([val,lbl])=>(
          <button key={val} onClick={()=>f("type",val)} style={{
            flex:1,padding:"8px 0",borderRadius:8,border:`1px solid ${form.type===val?"#0ea5e9":"rgba(255,255,255,0.1)"}`,
            background:form.type===val?"rgba(14,165,233,0.15)":"transparent",
            color:form.type===val?"#0ea5e9":"#6a8aaa",fontSize:13,cursor:"pointer",fontFamily:"inherit"
          }}>{lbl}</button>
        ))}
      </div>

      {/* Fields */}
      {[
        ["vin","VIN (opcional)","VIN del vehículo"],
        ["brand","Marca *","Toyota, Kenworth, Ford..."],
        ["model","Modelo *","Corolla, T680, F-150..."],
        ["year","Año *","2018"],
        ["engine","Motor *","2.5L, Cummins ISX, 5.7L..."],
        ["km","Kilometraje","150,000"],
        ["client","Nombre del cliente",""],
        ["phone","Teléfono",""],
      ].map(([key,label,ph])=>(
        <div key={key}>
          <div style={{fontSize:11,color:"#4a7a9a",marginBottom:4}}>{label}</div>
          <input value={form[key]} onChange={e=>f(key,e.target.value)} placeholder={ph}
            style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 12px",color:"#e0e6f0",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
        </div>
      ))}

      <div>
        <div style={{fontSize:11,color:"#4a7a9a",marginBottom:4}}>Notas iniciales</div>
        <textarea value={form.notes} onChange={e=>f("notes",e.target.value)} rows={2}
          style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 12px",color:"#e0e6f0",fontSize:13,fontFamily:"inherit",outline:"none",resize:"none",boxSizing:"border-box"}}/>
      </div>

      <div style={{display:"flex",gap:8,marginTop:4}}>
        <button onClick={()=>onSave(form)} style={{flex:1,padding:"10px 0",background:"linear-gradient(135deg,#0ea5e9,#0369a1)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          {initial?"Guardar Cambios":"Crear Vehículo"}
        </button>
        <button onClick={onCancel} style={{padding:"10px 16px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"#6a8aaa",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── REPORT MODAL ───────────────────────────────────────────────────
function ReportModal({ vehicle, cases, onClose }) {
  const latestCase = cases[cases.length-1];
  const [lang, setLang] = useState("es");
  const [shopName, setShopName] = useState("DIAGIA");
  const [tech, setTech] = useState("");

  const diagnosis = latestCase?.messages?.find(m=>m.role==="assistant"&&m.content?.includes("🎯"))?.content || "";
  const diagLine = diagnosis.split("\n").find(l=>l.includes("🎯")) || "";
  const actionLine = diagnosis.split("\n").find(l=>l.includes("🔧")&&l.includes("ACCIÓN")) || "";

  const t = {
    es: { title:"REPORTE DE DIAGNÓSTICO", vehicle:"DATOS DEL VEHÍCULO", client:"DATOS DEL CLIENTE",
          diag:"DIAGNÓSTICO", symptom:"Síntoma reportado", found:"Diagnóstico encontrado",
          action:"Acción recomendada", tech:"Técnico", date:"Fecha", sign:"Firma",
          footer:"Generado por DIAGIA v3.0 — Sistema de Diagnóstico Automotriz con IA" },
    en: { title:"DIAGNOSTIC REPORT", vehicle:"VEHICLE INFORMATION", client:"CLIENT INFORMATION",
          diag:"DIAGNOSIS", symptom:"Reported symptom", found:"Diagnosis found",
          action:"Recommended action", tech:"Technician", date:"Date", sign:"Signature",
          footer:"Generated by DIAGIA v3.0 — AI-Powered Automotive Diagnostic System" }
  }[lang];

  const printReport = () => {
    const w = window.open("","_blank");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Reporte DIAGIA</title>
    <style>
      body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#1a1a1a}
      .header{text-align:center;border-bottom:3px solid #0ea5e9;padding-bottom:20px;margin-bottom:30px}
      .logo{font-size:32px;font-weight:900;color:#0ea5e9;letter-spacing:4px}
      .subtitle{font-size:12px;color:#666;letter-spacing:2px;margin-top:4px}
      .report-title{font-size:18px;font-weight:700;color:#1a1a1a;margin-top:12px}
      .section{margin-bottom:24px}
      .section-title{font-size:12px;font-weight:700;color:#0ea5e9;letter-spacing:2px;border-bottom:1px solid #e0e0e0;padding-bottom:6px;margin-bottom:12px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .field{margin-bottom:8px}
      .field-label{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px}
      .field-value{font-size:14px;color:#1a1a1a;font-weight:500;border-bottom:1px solid #e0e0e0;padding-bottom:4px;min-height:20px}
      .diag-box{background:#f0f9ff;border:1px solid #0ea5e9;border-radius:8px;padding:16px;margin-top:8px}
      .diag-box p{margin:6px 0;font-size:14px}
      .sign-area{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px}
      .sign-line{border-top:1px solid #333;padding-top:8px;font-size:12px;color:#666;text-align:center}
      .footer{text-align:center;font-size:10px;color:#999;margin-top:40px;padding-top:16px;border-top:1px solid #e0e0e0}
      .badge{display:inline-block;background:#0ea5e9;color:#fff;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700}
      @media print{body{margin:0}}
    </style></head><body>
    <div class="header">
      <div class="logo">DIAG<span style="color:#0369a1">IA</span></div>
      <div class="subtitle">DIAGNÓSTICO AUTOMOTRIZ CON IA</div>
      <div class="report-title">${t.title}</div>
      <div style="margin-top:8px"><span class="badge">${vehicle.type==="heavy"?"🚛 VEHÍCULO PESADO":"🚗 VEHÍCULO LIGERO"}</span></div>
    </div>

    <div class="section">
      <div class="section-title">${t.vehicle}</div>
      <div class="grid">
        <div class="field"><div class="field-label">VIN</div><div class="field-value">${vehicle.vin||"—"}</div></div>
        <div class="field"><div class="field-label">Marca / Brand</div><div class="field-value">${vehicle.brand}</div></div>
        <div class="field"><div class="field-label">Modelo / Model</div><div class="field-value">${vehicle.model}</div></div>
        <div class="field"><div class="field-label">Año / Year</div><div class="field-value">${vehicle.year}</div></div>
        <div class="field"><div class="field-label">Motor / Engine</div><div class="field-value">${vehicle.engine}</div></div>
        <div class="field"><div class="field-label">Kilometraje / Mileage</div><div class="field-value">${vehicle.km||"—"}</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">${t.client}</div>
      <div class="grid">
        <div class="field"><div class="field-label">Nombre / Name</div><div class="field-value">${vehicle.client||"—"}</div></div>
        <div class="field"><div class="field-label">Teléfono / Phone</div><div class="field-value">${vehicle.phone||"—"}</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">${t.diag}</div>
      <div class="field"><div class="field-label">${t.symptom}</div>
      <div class="field-value">${latestCase?.symptom||vehicle.notes||"—"}</div></div>
      <div class="diag-box">
        <p><strong>${t.found}:</strong> ${diagLine.replace("🎯 CAUSA RAÍZ:","").trim()||"En proceso"}</p>
        <p><strong>${t.action}:</strong> ${actionLine.replace("🔧 ACCIÓN:","").trim()||"Ver historial de diagnóstico"}</p>
      </div>
    </div>

    <div class="sign-area">
      <div><div class="sign-line">${t.tech}: ${tech||shopName}</div></div>
      <div><div class="sign-line">${t.date}: ${now()}</div></div>
    </div>

    <div class="footer">${t.footer}</div>
    </body></html>`);
    w.document.close();
    setTimeout(()=>w.print(),500);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#0d1424",border:"1px solid rgba(14,165,233,0.3)",borderRadius:16,padding:24,maxWidth:500,width:"100%",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{fontSize:16,fontWeight:700,color:"#0ea5e9",marginBottom:16}}>📄 Generar Reporte</div>

        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {[["es","🇲🇽 Español"],["en","🇺🇸 English"]].map(([v,l])=>(
            <button key={v} onClick={()=>setLang(v)} style={{flex:1,padding:"8px 0",borderRadius:8,border:`1px solid ${lang===v?"#0ea5e9":"rgba(255,255,255,0.1)"}`,background:lang===v?"rgba(14,165,233,0.15)":"transparent",color:lang===v?"#0ea5e9":"#6a8aaa",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>
          ))}
        </div>

        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:"#4a7a9a",marginBottom:4}}>Nombre del taller / técnico</div>
          <input value={shopName} onChange={e=>setShopName(e.target.value)} placeholder="DIAGIA"
            style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 12px",color:"#e0e6f0",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
        </div>

        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,color:"#4a7a9a",marginBottom:4}}>Técnico responsable</div>
          <input value={tech} onChange={e=>setTech(e.target.value)} placeholder="Tu nombre"
            style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 12px",color:"#e0e6f0",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
        </div>

        <div style={{background:"rgba(14,165,233,0.06)",border:"1px solid rgba(14,165,233,0.2)",borderRadius:8,padding:12,marginBottom:20,fontSize:12,color:"#6a9abc"}}>
          <div><strong style={{color:"#0ea5e9"}}>Vehículo:</strong> {vehicle.brand} {vehicle.model} {vehicle.year}</div>
          <div><strong style={{color:"#0ea5e9"}}>Motor:</strong> {vehicle.engine}</div>
          {vehicle.client && <div><strong style={{color:"#0ea5e9"}}>Cliente:</strong> {vehicle.client}</div>}
          <div><strong style={{color:"#0ea5e9"}}>Diagnóstico:</strong> {diagLine.replace("🎯 CAUSA RAÍZ:","").trim()||"En proceso"}</div>
        </div>

        <div style={{display:"flex",gap:8}}>
          <button onClick={printReport} style={{flex:1,padding:"11px 0",background:"linear-gradient(135deg,#0ea5e9,#0369a1)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            🖨️ Imprimir / Guardar PDF
          </button>
          <button onClick={onClose} style={{padding:"11px 16px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,color:"#6a8aaa",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ───────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("garage");
  const [vehicles, setVehicles] = useState(() => DB.get("diagia_vehicles"));
  const [cases, setCases] = useState(() => DB.get("diagia_cases"));
  const [activeVehicle, setActiveVehicle] = useState(null);
  const [activeCase, setActiveCase] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [messages, setMessages] = useState([{role:"assistant",content:WELCOME}]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [dtcSearch, setDtcSearch] = useState("");
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const scannerRef = useRef(null);
  const diagramRef = useRef(null);
  const otherRef = useRef(null);

  useEffect(()=>{ DB.set("diagia_vehicles",vehicles); },[vehicles]);
  useEffect(()=>{ DB.set("diagia_cases",cases); },[cases]);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,loading]);

  // Save vehicles & cases
  const saveVehicle = (form) => {
    if (!form.brand || !form.model || !form.year || !form.engine) {
      alert("Completa los campos obligatorios (*)"); return;
    }
    if (editVehicle) {
      const updated = vehicles.map(v=>v.id===editVehicle.id?{...editVehicle,...form}:v);
      setVehicles(updated);
      setEditVehicle(null);
    } else {
      const nv = {...form, id:uid(), createdAt:now(), status:"open"};
      setVehicles(p=>[nv,...p]);
    }
    setShowForm(false);
  };

  const openDiagnostic = (vehicle) => {
    setActiveVehicle(vehicle);
    const vehicleCases = cases.filter(c=>c.vehicleId===vehicle.id);
    const lastCase = vehicleCases[vehicleCases.length-1];
    if (lastCase && lastCase.status==="open") {
      setActiveCase(lastCase);
      setMessages(lastCase.messages || [{role:"assistant",content:WELCOME}]);
    } else {
      const nc = { id:uid(), vehicleId:vehicle.id, createdAt:now(), status:"open",
        symptom:"", messages:[{role:"assistant",content:`# 🔧 Caso Abierto — ${vehicle.brand} ${vehicle.model} ${vehicle.year}\n\n**Motor:** ${vehicle.engine} | **Km:** ${vehicle.km||"N/A"} | **Tipo:** ${vehicle.type==="heavy"?"Vehículo Pesado 🚛":"Vehículo Ligero 🚗"}\n${vehicle.client?`**Cliente:** ${vehicle.client}`:""}\n\n---\n\nTengo el historial de este vehículo. ¿Cuál es el síntoma que reporta el cliente hoy?`}] };
      setCases(p=>[...p,nc]);
      setActiveCase(nc);
      setMessages(nc.messages);
    }
    setTab("diag");
  };

  const updateCase = (msgs) => {
    if (!activeCase) return;
    const updated = cases.map(c=>c.id===activeCase.id?{...c,messages:msgs}:c);
    setCases(updated);
    setActiveCase(p=>({...p,messages:msgs}));
  };

  const closeCase = () => {
    if (!activeCase) return;
    const updated = cases.map(c=>c.id===activeCase.id?{...c,status:"resolved"}:c);
    setCases(updated);
    setActiveCase(p=>({...p,status:"resolved"}));
    const updV = vehicles.map(v=>v.id===activeVehicle.id?{...v,status:"resolved"}:v);
    setVehicles(updV);
  };

  const toBase64 = f => new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(f); });

  const handleUpload = async (e, label) => {
    const files = Array.from(e.target.files);
    const imgs = await Promise.all(files.map(async f=>({ base64:await toBase64(f), preview:URL.createObjectURL(f), mediaType:f.type, label })));
    setImages(p=>[...p,...imgs]);
  };

  const sendMessage = async () => {
    if ((!input.trim() && !images.length) || loading) return;
    const userContent = images.length > 0
      ? [...images.map(img=>({type:"image",source:{type:"base64",media_type:img.mediaType,data:img.base64}})),
         {type:"text",text:input.trim()||"Analiza esta imagen y continúa el diagnóstico."}]
      : input.trim();
    const userMsg = { role:"user", content:userContent,
      displayContent:input.trim()||`📸 ${images.length} imagen(es)`,
      hasImages:images.length>0, imagePreviews:images.map(i=>i.preview) };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    updateCase(newMsgs);
    setImages([]); setInput(""); setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height="auto";
    try {
      const vehicleCtx = activeVehicle
        ? `VEHÍCULO ACTIVO: ${activeVehicle.brand} ${activeVehicle.model} ${activeVehicle.year} | Motor: ${activeVehicle.engine} | Km: ${activeVehicle.km||"N/A"} | Tipo: ${activeVehicle.type==="heavy"?"PESADO (24V, protocolos J1939)":"LIGERO (OBD-II)"}\n\n` : "";
      const apiMsgs = newMsgs.filter(m=>m!==newMsgs[0]||m.role!=="assistant")
        .map(m=>({role:m.role,content:m.content}));
      if (!apiMsgs.length||apiMsgs[0].role!=="user")
        apiMsgs.unshift({role:"user",content:"Inicio"});
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000,
          system:vehicleCtx+SYSTEM_PROMPT, messages:apiMsgs })
      });
      const data = await res.json();
      const text = data.content?.map(b=>b.text||"").join("\n")||"Error al obtener respuesta.";
      const finalMsgs = [...newMsgs,{role:"assistant",content:text}];
      setMessages(finalMsgs);
      updateCase(finalMsgs);
      if (text.includes("🎯")) closeCase();
    } catch {
      const errMsgs = [...newMsgs,{role:"assistant",content:"⚠️ Error de conexión. Intenta de nuevo."}];
      setMessages(errMsgs); updateCase(errMsgs);
    } finally { setLoading(false); }
  };

  const handleKeyDown = e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} };
  const handleChange = e=>{ setInput(e.target.value); e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"; };

  // DTC library sample
  const dtcList = [
    {code:"P0171",desc:"Sistema demasiado pobre banco 1",sys:"Combustible",sev:"Media"},
    {code:"P0300",desc:"Falla de encendido aleatoria/múltiple",sys:"Encendido",sev:"Alta"},
    {code:"P0420",desc:"Eficiencia del catalizador por debajo del umbral banco 1",sys:"Emisiones",sev:"Media"},
    {code:"P0442",desc:"Fuga pequeña detectada en sistema EVAP",sys:"EVAP",sev:"Baja"},
    {code:"P0455",desc:"Fuga grande detectada en sistema EVAP",sys:"EVAP",sev:"Media"},
    {code:"P0101",desc:"Sensor MAF fuera de rango",sys:"Motor",sev:"Media"},
    {code:"P0301",desc:"Falla de encendido cilindro 1",sys:"Encendido",sev:"Alta"},
    {code:"P0113",desc:"Sensor IAT señal alta",sys:"Motor",sev:"Baja"},
    {code:"P0340",desc:"Circuito sensor posición árbol de levas banco 1",sys:"Motor",sev:"Alta"},
    {code:"P0505",desc:"Sistema de control de ralentí",sys:"Motor",sev:"Media"},
    {code:"U0100",desc:"Comunicación perdida con ECM/PCM",sys:"Red CAN",sev:"Alta"},
    {code:"C0035",desc:"Sensor velocidad rueda delantera izquierda",sys:"ABS",sev:"Alta"},
    {code:"B1000",desc:"ECU de bolsa de aire — falla interna",sys:"SRS",sev:"Alta"},
    {code:"SPN 651 FMI 5",desc:"Inyector cilindro 1 circuito abierto (J1939)",sys:"Pesado",sev:"Alta"},
    {code:"SPN 100 FMI 1",desc:"Presión de aceite del motor baja (J1939)",sys:"Pesado",sev:"Alta"},
  ];
  const filteredDTC = dtcList.filter(d=>
    d.code.toLowerCase().includes(dtcSearch.toLowerCase()) ||
    d.desc.toLowerCase().includes(dtcSearch.toLowerCase()) ||
    d.sys.toLowerCase().includes(dtcSearch.toLowerCase())
  );

  const sevColor = s=>s==="Alta"?"#ef4444":s==="Media"?"#f59e0b":"#4ade80";

  const vehicleCases = activeVehicle ? cases.filter(c=>c.vehicleId===activeVehicle.id) : [];

  return (
    <div style={{minHeight:"100vh",background:"#070b16",display:"flex",flexDirection:"column",fontFamily:"'DM Mono',monospace",color:"#e0e6f0"}}>

      {/* HEADER */}
      <div style={{background:"linear-gradient(135deg,#0b1220,#090f1c)",borderBottom:"1px solid #162840",padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:20}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,background:"linear-gradient(135deg,#0ea5e9,#0369a1)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 0 20px rgba(14,165,233,0.3)"}}>🔧</div>
          <div>
            <div style={{fontSize:17,fontWeight:700,letterSpacing:"0.06em"}}>DIAG<span style={{color:"#0ea5e9"}}>IA</span><span style={{fontSize:10,color:"#3a6a8a",marginLeft:8}}>v3.0</span></div>
            <div style={{fontSize:9,color:"#2a5070",letterSpacing:"0.1em"}}>DIAGNÓSTICO AUTOMOTRIZ PROFESIONAL</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {activeVehicle && tab==="diag" && (
            <>
              <div style={{background:"rgba(14,165,233,0.08)",border:"1px solid rgba(14,165,233,0.2)",borderRadius:6,padding:"4px 10px",fontSize:11,color:"#4a9fc8",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {activeVehicle.type==="heavy"?"🚛":"🚗"} {activeVehicle.brand} {activeVehicle.model} {activeVehicle.year}
              </div>
              <button onClick={()=>setShowReport(true)} style={{background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.25)",borderRadius:6,padding:"6px 12px",color:"#4ade80",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>📄 Reporte</button>
            </>
          )}
        </div>
      </div>

      {/* TABS */}
      <div style={{background:"rgba(7,11,22,0.95)",borderBottom:"1px solid #0f1f35",display:"flex",padding:"0 18px"}}>
        {[["garage","🚗 Garage"],["diag","🔧 Diagnóstico"],["study","📚 Estudio"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:"12px 16px",background:"transparent",border:"none",borderBottom:`2px solid ${tab===id?"#0ea5e9":"transparent"}`,color:tab===id?"#0ea5e9":"#4a6a8a",fontSize:12,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.06em",transition:"all 0.2s"}}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── GARAGE TAB ── */}
      {tab==="garage" && (
        <div style={{flex:1,overflowY:"auto",padding:"20px 16px",maxWidth:840,width:"100%",margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontSize:14,color:"#4a7a9a"}}>{vehicles.length} vehículo(s) registrado(s)</div>
            <button onClick={()=>{setShowForm(true);setEditVehicle(null);}} style={{background:"linear-gradient(135deg,#0ea5e9,#0369a1)",border:"none",borderRadius:8,padding:"8px 16px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              + Nuevo Vehículo
            </button>
          </div>

          {showForm && <div style={{marginBottom:16}}><VehicleForm onSave={saveVehicle} onCancel={()=>{setShowForm(false);setEditVehicle(null);}} initial={editVehicle}/></div>}

          {vehicles.length===0 && !showForm && (
            <div style={{textAlign:"center",padding:"60px 20px",color:"#2a4a6a"}}>
              <div style={{fontSize:48,marginBottom:12}}>🚗</div>
              <div style={{fontSize:14}}>No hay vehículos registrados</div>
              <div style={{fontSize:12,marginTop:4}}>Agrega tu primer vehículo para comenzar</div>
            </div>
          )}

          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {vehicles.map(v=>{
              const vCases = cases.filter(c=>c.vehicleId===v.id);
              const isResolved = v.status==="resolved";
              return (
                <div key={v.id} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${isResolved?"rgba(74,222,128,0.2)":"rgba(255,255,255,0.08)"}`,borderRadius:12,padding:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                        <span style={{fontSize:18}}>{v.type==="heavy"?"🚛":"🚗"}</span>
                        <span style={{fontSize:15,fontWeight:700,color:"#e0e6f0"}}>{v.brand} {v.model}</span>
                        <span style={{fontSize:12,color:"#4a7a9a"}}>{v.year}</span>
                        <span style={{fontSize:10,background:isResolved?"rgba(74,222,128,0.1)":"rgba(14,165,233,0.1)",color:isResolved?"#4ade80":"#0ea5e9",border:`1px solid ${isResolved?"rgba(74,222,128,0.3)":"rgba(14,165,233,0.3)"}`,borderRadius:4,padding:"2px 6px"}}>
                          {isResolved?"✅ Resuelto":"🔄 Activo"}
                        </span>
                      </div>
                      <div style={{fontSize:12,color:"#4a7a9a",display:"flex",gap:16,flexWrap:"wrap"}}>
                        <span>⚙️ {v.engine}</span>
                        {v.km && <span>📍 {v.km} km</span>}
                        {v.vin && <span>🔑 {v.vin}</span>}
                        {v.client && <span>👤 {v.client}</span>}
                        <span>📋 {vCases.length} caso(s)</span>
                        <span>📅 {v.createdAt}</span>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      <button onClick={()=>openDiagnostic(v)} style={{background:"linear-gradient(135deg,#0ea5e9,#0369a1)",border:"none",borderRadius:8,padding:"8px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                        🔧 Diagnosticar
                      </button>
                      <button onClick={()=>{setEditVehicle(v);setShowForm(true);}} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 10px",color:"#6a8aaa",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
                      <button onClick={()=>setVehicles(p=>p.filter(x=>x.id!==v.id))} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"8px 10px",color:"#ef4444",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>🗑️</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── DIAGNOSTIC TAB ── */}
      {tab==="diag" && (
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {!activeVehicle ? (
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,color:"#2a4a6a",padding:20}}>
              <div style={{fontSize:48}}>🔧</div>
              <div style={{fontSize:14}}>Selecciona un vehículo del Garage para comenzar el diagnóstico</div>
              <button onClick={()=>setTab("garage")} style={{background:"linear-gradient(135deg,#0ea5e9,#0369a1)",border:"none",borderRadius:8,padding:"10px 20px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                Ir al Garage
              </button>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div style={{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:14,maxWidth:840,width:"100%",margin:"0 auto"}}>
                {messages.map((msg,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start",animation:"fadeIn 0.3s ease"}}>
                    {msg.role==="assistant"&&<div style={{width:28,height:28,minWidth:28,background:"linear-gradient(135deg,#0ea5e9,#0369a1)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,marginRight:10,marginTop:4}}>🔧</div>}
                    <div style={{maxWidth:"86%",display:"flex",flexDirection:"column",alignItems:msg.role==="user"?"flex-end":"flex-start",gap:6}}>
                      {msg.hasImages&&msg.imagePreviews&&(
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:msg.role==="user"?"flex-end":"flex-start"}}>
                          {msg.imagePreviews.map((src,j)=><img key={j} src={src} alt="" style={{width:100,height:78,objectFit:"cover",borderRadius:8,border:"1px solid rgba(14,165,233,0.3)"}}/>)}
                        </div>
                      )}
                      <div style={{background:msg.role==="user"?"linear-gradient(135deg,#0ea5e9,#0369a1)":"rgba(255,255,255,0.03)",border:msg.role==="user"?"none":"1px solid rgba(255,255,255,0.07)",borderRadius:msg.role==="user"?"14px 14px 4px 14px":"4px 14px 14px 14px",padding:"11px 15px",fontSize:14,lineHeight:1.75,color:msg.role==="user"?"#fff":"#cdd6f4"}}>
                        {msg.role==="assistant"?<MessageContent content={msg.content}/>:<p style={{margin:0}}>{msg.displayContent||msg.content}</p>}
                      </div>
                    </div>
                  </div>
                ))}
                {loading&&(
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:28,height:28,background:"linear-gradient(135deg,#0ea5e9,#0369a1)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🔧</div>
                    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"4px 14px 14px 14px",padding:"12px 18px",display:"flex",gap:6,alignItems:"center"}}>
                      {[0,1,2].map(j=><div key={j} style={{width:7,height:7,background:"#0ea5e9",borderRadius:"50%",animation:`pulse 1.2s ease-in-out ${j*0.2}s infinite`}}/>)}
                      <span style={{fontSize:11,color:"#2a5a7a",marginLeft:6}}>Analizando...</span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef}/>
              </div>

              {/* Input */}
              <div style={{background:"rgba(7,11,22,0.98)",borderTop:"1px solid #162840",padding:"12px 16px"}}>
                <div style={{maxWidth:840,margin:"0 auto"}}>
                  {/* Image previews */}
                  {images.length>0&&(
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                      {images.map((img,i)=>(
                        <div key={i} style={{position:"relative"}}>
                          <img src={img.preview} alt="" style={{width:60,height:60,objectFit:"cover",borderRadius:8,border:"1px solid rgba(14,165,233,0.4)"}}/>
                          <button onClick={()=>setImages(p=>p.filter((_,j)=>j!==i))} style={{position:"absolute",top:-5,right:-5,width:16,height:16,borderRadius:"50%",background:"#ef4444",border:"none",color:"#fff",fontSize:9,cursor:"pointer"}}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Upload buttons */}
                  <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                    {[
                      [scannerRef,"📟 Escáner","#0ea5e9","rgba(14,165,233,0.08)","rgba(14,165,233,0.25)","Foto Escáner"],
                      [diagramRef,"📐 Diagrama","#a78bfa","rgba(167,139,250,0.08)","rgba(167,139,250,0.25)","Diagrama Eléctrico"],
                      [otherRef,"📷 Foto","#f59e0b","rgba(245,158,11,0.08)","rgba(245,158,11,0.25)","Otra Foto"],
                    ].map(([ref,lbl,color,bg,border,label])=>(
                      <div key={lbl}>
                        <input type="file" accept="image/*" multiple style={{display:"none"}} ref={ref} onChange={e=>{handleUpload(e,label);e.target.value="";}}/>
                        <button onClick={()=>ref.current?.click()} style={{background:bg,border:`1px solid ${border}`,borderRadius:8,padding:"7px 12px",color,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{lbl}</button>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
                    <textarea ref={textareaRef} value={input} onChange={handleChange} onKeyDown={handleKeyDown}
                      placeholder="Describe el síntoma o responde al paso... (Enter para enviar)" rows={1}
                      style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(14,165,233,0.22)",borderRadius:10,padding:"11px 14px",color:"#e0e6f0",fontSize:13,fontFamily:"inherit",resize:"none",outline:"none",lineHeight:1.6}}
                      onFocus={e=>e.target.style.borderColor="rgba(14,165,233,0.55)"}
                      onBlur={e=>e.target.style.borderColor="rgba(14,165,233,0.22)"}/>
                    <button onClick={sendMessage} disabled={loading||(!input.trim()&&!images.length)} style={{width:44,height:44,minWidth:44,background:(loading||(!input.trim()&&!images.length))?"rgba(14,165,233,0.12)":"linear-gradient(135deg,#0ea5e9,#0369a1)",border:"none",borderRadius:10,cursor:(loading||(!input.trim()&&!images.length))?"not-allowed":"pointer",fontSize:17,display:"flex",alignItems:"center",justifyContent:"center"}}>➤</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── STUDY TAB ── */}
      {tab==="study" && (
        <div style={{flex:1,overflowY:"auto",padding:"20px 16px",maxWidth:840,width:"100%",margin:"0 auto"}}>
          <div style={{fontSize:15,fontWeight:700,color:"#0ea5e9",marginBottom:4}}>📚 Biblioteca de Códigos DTC</div>
          <div style={{fontSize:12,color:"#4a7a9a",marginBottom:16}}>Incluye códigos OBD-II y J1939 para vehículos pesados</div>

          <input value={dtcSearch} onChange={e=>setDtcSearch(e.target.value)}
            placeholder="Buscar código, descripción o sistema... (P0171, ABS, EVAP, SPN...)"
            style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(14,165,233,0.22)",borderRadius:10,padding:"11px 14px",color:"#e0e6f0",fontSize:13,fontFamily:"inherit",outline:"none",marginBottom:16,boxSizing:"border-box"}}/>

          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {filteredDTC.map((d,i)=>(
              <div key={i} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                <div style={{minWidth:100,fontSize:13,fontWeight:700,color:"#0ea5e9",fontFamily:"monospace"}}>{d.code}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:"#cdd6f4"}}>{d.desc}</div>
                  <div style={{fontSize:11,color:"#4a7a9a",marginTop:2}}>{d.sys}</div>
                </div>
                <div style={{fontSize:11,background:`rgba(${d.sev==="Alta"?"239,68,68":d.sev==="Media"?"245,158,11":"74,222,128"},0.1)`,color:sevColor(d.sev),border:`1px solid ${sevColor(d.sev)}44`,borderRadius:6,padding:"3px 8px",whiteSpace:"nowrap"}}>
                  {d.sev}
                </div>
              </div>
            ))}
            {filteredDTC.length===0&&(
              <div style={{textAlign:"center",padding:"40px 0",color:"#2a4a6a"}}>
                <div style={{fontSize:32,marginBottom:8}}>🔍</div>
                <div>No se encontraron códigos para "{dtcSearch}"</div>
              </div>
            )}
          </div>

          {/* Tools reference */}
          <div style={{marginTop:32}}>
            <div style={{fontSize:15,fontWeight:700,color:"#0ea5e9",marginBottom:12}}>🛠️ Tu Kit de Herramientas</div>
            {[
              ["📟","Thinkscan Plus S2","Escáner ligeros OBD-II","Scan → Marca → Sistema → Datos en vivo / Códigos","#0ea5e9"],
              ["📐","Innova 3320","Multímetro digital","VDC voltaje | Ω resistencia | Continuidad con beep","#f59e0b"],
              ["⚡","Autel PS100","Power Probe","Alimentar componentes directamente, muestra V y A simultáneo","#f97316"],
              ["🔌","FNIRSI DMC-100","Pinzas amperimétricas","Abraza el cable, mide consumo en tiempo real","#a78bfa"],
              ["🔦","Lámpara de prueba","Verificación rápida","Clip a masa, punta al terminal — siempre primero","#facc15"],
              ["💨","HyperSmoke","Máquina de humo","EVAP y fugas de vacío — el humo sale exactamente en la fuga","#4ade80"],
              ["🚛","Launch X431 Pro5 + SmartLink HD","(Futuro) Escáner profesional pesados","12V y 24V — Kenworth, Peterbilt, Freightliner, Cummins, Detroit","#60a5fa"],
            ].map(([icon,name,type,tip,color])=>(
              <div key={name} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"12px 16px",marginBottom:8,display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{fontSize:22,minWidth:32,textAlign:"center"}}>{icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color}}>{name}</div>
                  <div style={{fontSize:11,color:"#4a7a9a",marginBottom:4}}>{type}</div>
                  <div style={{fontSize:12,color:"#6a8aaa"}}>{tip}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REPORT MODAL */}
      {showReport && activeVehicle && (
        <ReportModal vehicle={activeVehicle} cases={vehicleCases} onClose={()=>setShowReport(false)}/>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-track{background:#070b16} ::-webkit-scrollbar-thumb{background:#162840;border-radius:4px}
        .msg-content h1{font-size:15px;font-weight:700;color:#e0e6f0;margin-bottom:8px}
        .msg-content h2{font-size:14px;font-weight:600;color:#0ea5e9;margin:12px 0 6px}
        .msg-content p{margin-bottom:6px;font-size:13px}
        .msg-content hr{border:none;border-top:1px solid rgba(255,255,255,0.06);margin:10px 0}
        .msg-content .step-h{color:#0ea5e9;font-weight:700;font-size:13px;margin:14px 0 8px;padding:7px 12px;background:rgba(14,165,233,0.07);border-left:3px solid #0ea5e9;border-radius:0 8px 8px 0}
        .msg-content .step-d{padding:3px 0 3px 10px;border-left:2px solid rgba(14,165,233,0.15);margin-left:4px;margin-bottom:4px;color:#8aaecc;font-size:12px}
        .msg-content .confirmed{background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:10px 14px;margin:10px 0;color:#4ade80;font-weight:700;font-size:13px}
        .msg-content .action{background:rgba(14,165,233,0.06);border-left:3px solid #0ea5e9;padding:5px 10px;border-radius:0 6px 6px 0;color:#7dd3fc;font-size:12px;margin:4px 0}
        .msg-content .diff{color:#f59e0b;font-size:12px;margin:4px 0}
        .msg-content .disc{color:#1e4a2e;text-decoration:line-through;font-size:12px}
        .msg-content strong{color:#7dd3fc}
      `}</style>
    </div>
  );
}

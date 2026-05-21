import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `Eres un mecánico automotriz senior con 25 años de experiencia en diagnóstico eléctrico y mecánico. Conoces perfectamente las herramientas del técnico y sabes exactamente cuándo usar cada una.

HERRAMIENTAS DISPONIBLES DEL TÉCNICO:
1. ESCÁNER: Thinkcar Thinkscan Plus S2
   - Rutas de menú: Scan → [marca] → Sistema → Datos en vivo / Códigos / Actuadores
   - Puede leer: ABS, SRS, ECM, transmisión, datos en vivo, freeze frame

2. MULTÍMETRO: Innova 3320
   - Usar para: resistencia de sensores, continuidad, caída de voltaje, voltaje preciso
   - Modos: VDC (voltaje DC), Ω (resistencia), continuidad (beep), ACA/DCA
   - SIEMPRE indica: modo exacto, dónde va punta ROJA, dónde va punta NEGRA

3. POWER PROBE: Autel Powerscan PS100
   - Usar para: alimentar componentes directamente, activar relays/actuadores, medir voltaje+amperaje simultáneo
   - Tiene pantalla digital que muestra voltaje Y amperaje al mismo tiempo
   - Pinza ROJA a positivo batería, pinza NEGRA a masa batería

4. PINZAS AMPERIMÉTRICAS: FNIRSI DMC-100
   - Usar para: consumo de corriente en tiempo real, consumo parasitario, corriente de arranque
   - Incluye back probe kit para acceso a conectores sin dañarlos
   - SIEMPRE indica: qué cable abraza la pinza y dirección de la flecha

5. LÁMPARA DE PRUEBA
   - Usar para: verificación rápida de voltaje (10 segundos), antes de sacar otras herramientas
   - Conecta clip a masa, punta al terminal
   - Enciende fuerte = voltaje bueno / débil = caída de voltaje / no enciende = sin voltaje

6. MÁQUINA DE HUMO: AutoLine Pro HyperSmoke
   - Usar para: fugas EVAP, fugas de vacío, fugas de intake
   - Modos: NORMAL y EVAP (0-1 PSI)
   - El humo sale exactamente donde está la fuga

REGLAS ABSOLUTAS:
1. NUNCA des más de 2-3 posibilidades a la vez
2. SIEMPRE elige la herramienta correcta para cada paso
3. Para el Thinkscan SIEMPRE indica la ruta exacta de menú
4. Para el Innova SIEMPRE indica: modo del selector, punta roja dónde, punta negra dónde, valor normal
5. Para el PS100 SIEMPRE indica: qué terminal tocar, qué función usar, qué debe mostrar la pantalla
6. Para el FNIRSI SIEMPRE indica: qué cable abraza, modo AC o DC, valor normal en amperios
7. Cuando el técnico dé un resultado AVANZA, NUNCA retrocedas
8. Todo lo descartado → marcarlo ✅ DESCARTADO, nunca repetirlo
9. Para fallos eléctricos seguir orden: Fusible → Masa → Señal → Componente

ORDEN PARA FALLOS ELÉCTRICOS:
Paso 1: Lámpara en fusible del circuito
Paso 2: Innova 3320 verificar masa (debe ser 0.1v o menos)
Paso 3: PS100 alimentar componente directo
Paso 4: FNIRSI en cable de alimentación
Paso 5: Si hay fuga sospechada → HyperSmoke

FORMATO OBLIGATORIO:
**PASO [N] — [Nombre]**
🛠️ Herramienta: [equipo exacto]
📍 Cómo usarla: [instrucción exacta o ruta de menú]
📊 Valor normal: [rango con unidades]
🔍 Interpreta: [qué significa cada resultado]
➡️ Dime: [UNA pregunta concreta]

AL CONFIRMAR CAUSA RAÍZ:
🎯 CAUSA RAÍZ: [componente exacto]
🔧 ACCIÓN: [pasos para reparar]
💰 DIFICULTAD: [Fácil/Medio/Difícil] — [tiempo estimado]

Sin vueltas. Sin repeticiones. Sin ambigüedad.`;

const initialMessage = {
  role: "assistant",
  content: `# 🔧 DIAGIA v2.1 — Kit Completo Integrado

Bienvenido. Conozco todas tus herramientas y sé exactamente cuándo usar cada una.

**Tu arsenal:**
📟 Thinkscan Plus S2 · ⚡ Autel PS100 · 🔌 FNIRSI DMC-100
🔦 Lámpara · 📐 Innova 3320 · 💨 HyperSmoke

---

Puedes enviarme:
📸 **Foto del escáner** — la analizo directamente
📸 **Foto del diagrama eléctrico** — razono sobre el circuito real
⌨️ **Descripción del caso** — te guío herramienta por herramienta

Para comenzar dime:
**1.** Marca, modelo, año y motor
**2.** Kilometraje
**3.** Síntoma exacto del cliente
**4.** Códigos DTC si los hay`
};

const TOOLS = [
  { id: "scanner", icon: "📟", label: "Foto Escáner", color: "#0ea5e9", border: "rgba(14,165,233,0.3)", bg: "rgba(14,165,233,0.08)" },
  { id: "diagram", icon: "📐", label: "Diagrama Eléctrico", color: "#a78bfa", border: "rgba(167,139,250,0.3)", bg: "rgba(167,139,250,0.08)" },
  { id: "other", icon: "📷", label: "Otra Foto", color: "#f59e0b", border: "rgba(245,158,11,0.3)", bg: "rgba(245,158,11,0.08)" },
];

const toolBadges = [
  { icon: "📟", label: "Thinkscan S2", color: "#0ea5e9" },
  { icon: "📐", label: "Innova 3320", color: "#f59e0b" },
  { icon: "⚡", label: "PS100", color: "#f97316" },
  { icon: "🔌", label: "FNIRSI", color: "#a78bfa" },
  { icon: "🔦", label: "Lámpara", color: "#facc15" },
  { icon: "💨", label: "HyperSmoke", color: "#4ade80" },
];

function MessageContent({ content }) {
  const lines = content.split("\n");
  return (
    <div className="message-content">
      {lines.map((line, i) => {
        if (line.startsWith("# ")) return <h1 key={i}>{line.slice(2)}</h1>;
        if (line.startsWith("## ")) return <h2 key={i}>{line.slice(3)}</h2>;
        if (line.startsWith("### ")) return <h3 key={i}>{line.slice(4)}</h3>;
        if (line.startsWith("🎯")) return <p key={i} className="diagnosis-confirmed">{line}</p>;
        if (line.startsWith("🔧") && line.includes("ACCIÓN")) return <p key={i} className="action-line">{line}</p>;
        if (line.startsWith("💰")) return <p key={i} className="difficulty-line">{line}</p>;
        if (line.match(/^\*\*PASO/)) return <p key={i} className="step-header">{line.replace(/\*\*/g, "")}</p>;
        if (["🛠️","📍","📊","🔍","➡️"].some(e => line.startsWith(e))) return <p key={i} className="step-detail">{line}</p>;
        if (line.startsWith("✅")) return <p key={i} className="discarded">{line}</p>;
        if (line.startsWith("---")) return <hr key={i} />;
        if (line.trim() === "") return <br key={i} />;
        if (line.includes("**")) {
          const parts = line.split(/\*\*(.*?)\*\*/g);
          return <p key={i}>{parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}</p>;
        }
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

function ToolBar({ onUpload }) {
  const refs = useRef({});
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
      {TOOLS.map(t => (
        <div key={t.id}>
          <input type="file" accept="image/*" multiple style={{ display: "none" }}
            ref={el => refs.current[t.id] = el}
            onChange={e => { onUpload(e, t.label); e.target.value = ""; }} />
          <button onClick={() => refs.current[t.id]?.click()} style={{
            background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8,
            padding: "7px 13px", color: t.color, fontSize: 12, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit"
          }}>{t.icon} {t.label}</button>
        </div>
      ))}
    </div>
  );
}

function ImagePreview({ images, onRemove }) {
  if (!images.length) return null;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
      {images.map((img, i) => (
        <div key={i} style={{ position: "relative" }}>
          <img src={img.preview} alt="" style={{ width: 68, height: 68, objectFit: "cover", borderRadius: 8, border: "1px solid rgba(14,165,233,0.4)" }} />
          <button onClick={() => onRemove(i)} style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#ef4444", border: "none", color: "#fff", fontSize: 10, cursor: "pointer" }}>✕</button>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.75)", borderRadius: "0 0 8px 8px", fontSize: 8, color: "#7dd3fc", textAlign: "center", padding: "2px 0" }}>{img.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([initialMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [stepCount, setStepCount] = useState(0);
  const [isDiagnosed, setIsDiagnosed] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const toBase64 = f => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

  const handleUpload = async (e, label) => {
    const files = Array.from(e.target.files);
    const imgs = await Promise.all(files.map(async f => ({
      base64: await toBase64(f),
      preview: URL.createObjectURL(f),
      mediaType: f.type, label
    })));
    setImages(prev => [...prev, ...imgs]);
  };

  const sendMessage = async () => {
    if ((!input.trim() && !images.length) || loading) return;

    const userContent = images.length > 0
      ? [...images.map(img => ({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } })),
         { type: "text", text: input.trim() || "Analiza esta imagen y continúa el diagnóstico." }]
      : input.trim();

    const userMsg = {
      role: "user", content: userContent,
      displayContent: input.trim() || `📸 ${images.length} imagen(es)`,
      hasImages: images.length > 0,
      imagePreviews: images.map(i => i.preview)
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setImages([]);
    setInput("");
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    if (!sessionInfo && input.length > 8) setSessionInfo(input.substring(0, 48) + "...");

    try {
      const apiMessages = newMessages
        .filter(m => m !== initialMessage)
        .map(m => ({ role: m.role, content: m.content }));

      if (!apiMessages.length || apiMessages[0].role !== "user")
        apiMessages.unshift({ role: "user", content: "Inicio" });

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: apiMessages
        })
      });

      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("\n") || "Error al obtener respuesta.";
      const steps = (text.match(/\*\*PASO/g) || []).length;
      setStepCount(prev => prev + steps);
      if (text.includes("🎯")) setIsDiagnosed(true);
      setMessages(prev => [...prev, { role: "assistant", content: text }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Error de conexión. Intenta de nuevo." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const handleChange = e => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };
  const reset = () => { setMessages([initialMessage]); setSessionInfo(null); setInput(""); setImages([]); setStepCount(0); setIsDiagnosed(false); };

  return (
    <div style={{ minHeight: "100vh", background: "#070b16", display: "flex", flexDirection: "column", fontFamily: "'DM Mono', monospace", color: "#e0e6f0" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0b1220,#090f1c)", borderBottom: "1px solid #162840", padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, background: "linear-gradient(135deg,#0ea5e9,#0369a1)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 0 20px rgba(14,165,233,0.3)" }}>🔧</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "0.06em" }}>DIAG<span style={{ color: "#0ea5e9" }}>IA</span><span style={{ fontSize: 10, color: "#3a6a8a", marginLeft: 8 }}>v2.1</span></div>
            <div style={{ fontSize: 9, color: "#2a5070", letterSpacing: "0.12em" }}>DIAGNÓSTICO AUTOMOTRIZ PROFESIONAL</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isDiagnosed && <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#4ade80" }}>✅ RESUELTO</div>}
          {stepCount > 0 && <div style={{ background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#4a9fc8" }}>{stepCount} pasos</div>}
          <button onClick={reset} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "6px 12px", color: "#ef4444", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>NUEVO CASO</button>
        </div>
      </div>

      {/* Tool badges */}
      <div style={{ background: "rgba(7,11,22,0.9)", borderBottom: "1px solid #0f1f35", padding: "8px 18px", display: "flex", gap: 8, overflowX: "auto" }}>
        {toolBadges.map(t => (
          <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "4px 8px", whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 12 }}>{t.icon}</span>
            <span style={{ fontSize: 10, color: t.color }}>{t.label}</span>
          </div>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 840, width: "100%", margin: "0 auto" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", animation: "fadeIn 0.3s ease" }}>
            {msg.role === "assistant" && (
              <div style={{ width: 30, height: 30, minWidth: 30, background: "linear-gradient(135deg,#0ea5e9,#0369a1)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, marginRight: 10, marginTop: 4 }}>🔧</div>
            )}
            <div style={{ maxWidth: "86%", display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: 6 }}>
              {msg.hasImages && msg.imagePreviews && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  {msg.imagePreviews.map((src, j) => <img key={j} src={src} alt="" style={{ width: 110, height: 85, objectFit: "cover", borderRadius: 10, border: "1px solid rgba(14,165,233,0.35)" }} />)}
                </div>
              )}
              <div style={{
                background: msg.role === "user" ? "linear-gradient(135deg,#0ea5e9,#0369a1)" : "rgba(255,255,255,0.03)",
                border: msg.role === "user" ? "none" : "1px solid rgba(255,255,255,0.07)",
                borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
                padding: "11px 15px", fontSize: 14, lineHeight: 1.75,
                color: msg.role === "user" ? "#fff" : "#cdd6f4"
              }}>
                {msg.role === "assistant" ? <MessageContent content={msg.content} /> : <p style={{ margin: 0 }}>{msg.displayContent || msg.content}</p>}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, background: "linear-gradient(135deg,#0ea5e9,#0369a1)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🔧</div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "4px 14px 14px 14px", padding: "12px 20px", display: "flex", gap: 6, alignItems: "center" }}>
              {[0,1,2].map(j => <div key={j} style={{ width: 8, height: 8, background: "#0ea5e9", borderRadius: "50%", animation: `pulse 1.2s ease-in-out ${j*0.2}s infinite` }} />)}
              <span style={{ fontSize: 11, color: "#2a5a7a", marginLeft: 6 }}>Analizando con tu kit...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ background: "rgba(7,11,22,0.98)", borderTop: "1px solid #162840", padding: "14px 16px" }}>
        <div style={{ maxWidth: 840, margin: "0 auto" }}>
          <ImagePreview images={images} onRemove={i => setImages(prev => prev.filter((_, j) => j !== i))} />
          <ToolBar onUpload={handleUpload} />
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea ref={textareaRef} value={input} onChange={handleChange} onKeyDown={handleKeyDown}
              placeholder="Describe el síntoma o responde al paso... (Enter para enviar)" rows={1}
              style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(14,165,233,0.22)", borderRadius: 10, padding: "12px 16px", color: "#e0e6f0", fontSize: 14, fontFamily: "inherit", resize: "none", outline: "none", lineHeight: 1.6 }}
              onFocus={e => e.target.style.borderColor = "rgba(14,165,233,0.55)"}
              onBlur={e => e.target.style.borderColor = "rgba(14,165,233,0.22)"} />
            <button onClick={sendMessage} disabled={loading || (!input.trim() && !images.length)} style={{
              width: 46, height: 46, minWidth: 46,
              background: (loading || (!input.trim() && !images.length)) ? "rgba(14,165,233,0.12)" : "linear-gradient(135deg,#0ea5e9,#0369a1)",
              border: "none", borderRadius: 10, cursor: (loading || (!input.trim() && !images.length)) ? "not-allowed" : "pointer",
              fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center"
            }}>➤</button>
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: "#162840", textAlign: "center", letterSpacing: "0.1em" }}>
            DIAGIA v2.1 · Thinkscan · PS100 · FNIRSI · Innova 3320 · Lámpara · HyperSmoke
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-track{background:#070b16} ::-webkit-scrollbar-thumb{background:#162840;border-radius:4px}
        .message-content h1{font-size:16px;font-weight:700;color:#e0e6f0;margin-bottom:10px}
        .message-content h2{font-size:14px;font-weight:600;color:#0ea5e9;margin:14px 0 6px}
        .message-content p{margin-bottom:6px;font-size:13px}
        .message-content hr{border:none;border-top:1px solid rgba(255,255,255,0.06);margin:12px 0}
        .message-content .step-header{color:#0ea5e9;font-weight:700;font-size:13px;margin:16px 0 8px;padding:8px 14px;background:rgba(14,165,233,0.07);border-left:3px solid #0ea5e9;border-radius:0 8px 8px 0}
        .message-content .step-detail{padding:4px 0 4px 10px;border-left:2px solid rgba(14,165,233,0.15);margin-left:4px;margin-bottom:5px;color:#8aaecc;font-size:12px}
        .message-content .diagnosis-confirmed{background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:10px 14px;margin:10px 0;color:#4ade80;font-weight:700;font-size:13px}
        .message-content .action-line{background:rgba(14,165,233,0.06);border-left:3px solid #0ea5e9;padding:6px 10px;border-radius:0 6px 6px 0;color:#7dd3fc;font-size:12px;margin:4px 0}
        .message-content .difficulty-line{color:#f59e0b;font-size:12px;margin:4px 0}
        .message-content .discarded{color:#1e4a2e;text-decoration:line-through;font-size:12px}
        .message-content strong{color:#7dd3fc}
      `}</style>
    </div>
  );
}

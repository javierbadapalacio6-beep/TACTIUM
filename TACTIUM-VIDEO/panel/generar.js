// «Generar contenido»: el panel que abre el botón «+». Habla con /api/generar
// del servidor local y va pintando el progreso y el resultado.
(function () {
  const { useState, useEffect, useRef } = React;

  const TIPOS = [
    { id: "carrusel", label: "Carrusel · post · story", icon: "carousel", pide: "carruseles" },
    { id: "reel", label: "Reel vertical", icon: "reel", pide: "piezas" },
    { id: "video16x9", label: "Vídeo 16:9", icon: "video", pide: "piezas" },
    { id: "foto", label: "Foto con Gemini", icon: "post", pide: "prompt" },
  ];

  // `inicial` ({tipo, id}) abre el modal ya apuntando a una pieza; `onHecho` avisa al panel
  // cuando termina bien, para que recargue los archivos de esa pieza.
  function Generar({ onClose, inicial, onHecho }) {
    const [cat, setCat] = useState({ carruseles: [], piezas: [], fotos: [] });
    const [tipo, setTipo] = useState(inicial?.tipo || "carrusel");
    const [id, setId] = useState(inicial?.id || "");
    const [prompt, setPrompt] = useState("");
    const [aspecto, setAspecto] = useState("4:5");
    const [log, setLog] = useState([]);
    const [estado, setEstado] = useState("listo"); // listo · corriendo · ok · error
    const [archivos, setArchivos] = useState([]);
    const fuente = useRef(null);
    const logRef = useRef(null);

    useEffect(() => { fetch("/api/catalogo").then((r) => r.json()).then(setCat).catch(() => {}); }, []);
    useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

    const t = TIPOS.find((x) => x.id === tipo);
    const opciones = t.pide === "carruseles" ? cat.carruseles : t.pide === "piezas" ? cat.piezas : [];
    const idActual = t.pide === "prompt" ? id : (id || opciones[0] || "");
    const puede = estado !== "corriendo" && (t.pide === "prompt" ? /^[A-Za-z0-9_-]+$/.test(id) && prompt.trim() : !!idActual);

    const lanzar = () => {
      setLog([]); setArchivos([]); setEstado("corriendo");
      const q = new URLSearchParams({ tipo, id: idActual, prompt, aspecto });
      const es = new EventSource(`/api/generar?${q}`);
      fuente.current = es;
      es.addEventListener("inicio", (e) => setLog((l) => [...l, "$ " + JSON.parse(e.data).comando]));
      es.addEventListener("linea", (e) => setLog((l) => [...l.slice(-200), JSON.parse(e.data).l]));
      es.addEventListener("fin", (e) => { const d = JSON.parse(e.data); setEstado(d.code === 0 ? "ok" : "error"); setArchivos(d.archivos); es.close(); if (d.code === 0) onHecho?.(); });
      es.onerror = () => { setEstado("error"); es.close(); };
    };
    const parar = () => { fuente.current?.close(); setEstado("listo"); };

    return html`
      <div class="modal" role="dialog" aria-label="Generar contenido" onClick=${(e) => e.target === e.currentTarget && onClose()}>
        <div class="modal__box">
          <div class="modal__head">
            <div class="modal__title">Generar contenido</div>
            <button type="button" class="round" style=${{ width: 44, height: 44 }} aria-label="Cerrar" onClick=${onClose}><${Icon} name="close" /></button>
          </div>

          <div class="modal__tipos">
            ${TIPOS.map((x) => html`
              <button key=${x.id} type="button" class=${"pill pill--sm " + (tipo === x.id ? "" : "pill--off")} onClick=${() => { setTipo(x.id); setId(""); setArchivos([]); }}>
                <${Icon} name=${x.icon} />${x.label}
              </button>`)}
          </div>

          <div class="modal__form">
            ${t.pide === "prompt" ? html`
              <label class="field"><span>Nombre del archivo</span><input value=${id} onInput=${(e) => setId(e.target.value)} placeholder="p. ej. capitan-vestuario" /></label>
              <label class="field"><span>Qué quieres ver</span><textarea rows="3" value=${prompt} onInput=${(e) => setPrompt(e.target.value)} placeholder="Un capitán en el banquillo apuntando la alineación en una libreta, luz de club de noche…"></textarea></label>
              <label class="field"><span>Formato</span>
                <select value=${aspecto} onChange=${(e) => setAspecto(e.target.value)}><option value="4:5">4:5 · post</option><option value="9:16">9:16 · story</option><option value="16:9">16:9 · vídeo</option></select>
              </label>` : html`
              <label class="field"><span>Pieza</span>
                <select value=${idActual} onChange=${(e) => setId(e.target.value)}>${opciones.map((o) => html`<option key=${o} value=${o}>${o}</option>`)}</select>
              </label>
              <div class="field__hint">${tipo === "carrusel" ? "Usa la spec de carruseles/<id>.json. Cambia el texto ahí y vuelve a generar." : "Renderiza con Remotion. Tarda uno o dos minutos por pieza."}</div>`}
          </div>

          <div class="modal__actions">
            <button type="button" class="pill pill--on modal__go" disabled=${!puede} onClick=${lanzar}>
              ${estado === "corriendo" ? "Generando…" : "Generar"}
            </button>
            ${estado === "corriendo" ? html`<button type="button" class="pill pill--sm pill--off" onClick=${parar}>Parar</button>` : null}
            <span class=${"modal__estado modal__estado--" + estado}>${{ listo: "", corriendo: "en marcha", ok: "listo", error: "ha fallado" }[estado]}</span>
          </div>

          ${log.length ? html`<pre class="modal__log" ref=${logRef}>${log.join("\n")}</pre>` : null}

          ${archivos.length ? html`
            <div class="modal__result">
              ${archivos.map((a) => a.endsWith(".mp4")
                ? html`<video key=${a} src=${a} controls style=${{ width: 220, borderRadius: 16, background: "#000" }}></video>`
                : html`<a key=${a} href=${a} target="_blank" rel="noopener"><img src=${a} alt="" style=${{ width: 120, borderRadius: 12 }} /></a>`)}
            </div>` : null}
        </div>
      </div>`;
  }

  window.Generar = Generar;
})();

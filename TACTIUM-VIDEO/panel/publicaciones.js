// Panel de publicaciones de @tactium.io.
//
// Lee el calendario (`/api/calendario`) y las cifras reales de Instagram
// (`/api/instagram`) y enseña, para cada pieza, qué se sube, cuándo, a qué hora
// y por qué, con su resultado cuando ya está publicada. Todo lo que se cambia
// aquí (estado, día, hora, vínculo con Instagram) se guarda en calendario.json.
(function () {
  const { useState, useEffect, useMemo, useRef } = React;

  // ── Fechas, siempre en hora de Madrid ───────────────────────────────────
  const TZ = "Europe/Madrid";
  const ahoraMadrid = () => {
    const f = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
    return { fecha: f.slice(0, 10), hora: f.slice(11, 16) };
  };
  const d12 = (f) => new Date(f + "T12:00:00Z");
  const fmtFecha = (f, o) => new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", ...o }).format(d12(f)).replace(".", "");
  const fechaLarga = (f) => fmtFecha(f, { weekday: "long", day: "numeric", month: "long" });
  const fechaCorta = (f) => fmtFecha(f, { day: "numeric", month: "short" });
  const diaCorto = (f) => fmtFecha(f, { weekday: "short" });
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const sumarDias = (f, n) => { const d = d12(f); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const num = (n) => (n == null ? "—" : Number(n).toLocaleString("es-ES"));
  const hace = (iso) => {
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    return min < 1 ? "ahora mismo" : min < 60 ? `hace ${min} min` : `hace ${Math.round(min / 60)} h`;
  };

  const TIPOS = {
    reel: { et: "Reel", plural: "Reels", icon: "reel" },
    carrusel: { et: "Carrusel", plural: "Carruseles", icon: "carousel" },
    post: { et: "Post", plural: "Posts", icon: "post" },
    story: { et: "Story", plural: "Stories", icon: "story" },
  };
  const ESTADOS = { listo: "Listo", grabar: "Por grabar", publicado: "Publicado" };
  const CARRILES = { lanzamiento: "Lanzamiento", capitan: "Capitán", club: "Clubes", jugador: "Jugador" };
  const TODOS_TIPOS = { reel: true, carrusel: true, post: true, story: true };
  const TODOS_ESTADOS = { listo: true, grabar: true, publicado: true };

  const orden = (a, b) => (a.fecha || "9999").localeCompare(b.fecha || "9999") || (a.hora || "").localeCompare(b.hora || "");
  /** Tenía día y hora, ya ha pasado y no consta como publicada. */
  const pasada = (p, ahora) => !!p.fecha && p.estado !== "publicado" && (p.fecha < ahora.fecha || (p.fecha === ahora.fecha && !!p.hora && p.hora <= ahora.hora));
  const cuando = (p, ahora) => {
    if (!p.fecha) return "Sin fecha";
    if (p.fecha === ahora.fecha) return `Hoy ${p.hora || ""}`;
    if (p.fecha === sumarDias(ahora.fecha, 1)) return `Mañana ${p.hora || ""}`;
    return `${cap(diaCorto(p.fecha))} ${fmtFecha(p.fecha, { day: "numeric" })} · ${p.hora || ""}`;
  };
  const semanaDe = (cal, fecha) => {
    const s = cal.semanas.find((w) => fecha >= w.desde && fecha <= w.hasta);
    if (s) return s.n;
    return fecha < cal.semanas[0].desde ? cal.semanas[0].n : cal.semanas[cal.semanas.length - 1].n;
  };

  /** ¿Cumple su objetivo? Solo se puede decir con la publicación vinculada. */
  function evaluar(p, m, an) {
    if (!m || typeof m.reach !== "number") return null;
    if (p.tipo === "reel" && an?.medianas?.reel) return { ok: m.reach >= an.medianas.reel, texto: `Alcance ${num(m.reach)} · mediana de tus reels ${num(an.medianas.reel)}` };
    if (p.tipo === "carrusel") { const r = m.reach ? (m.saved || 0) / m.reach : 0; return { ok: r >= 0.01, texto: `Guardados: ${(r * 100).toFixed(1).replace(".", ",")} % del alcance (objetivo 1 %)` }; }
    if (p.tipo === "post" && an?.medianas?.feed) return { ok: m.reach >= an.medianas.feed, texto: `Alcance ${num(m.reach)} · mediana de tus posts ${num(an.medianas.feed)}` };
    return null;
  }
  const cifrasCortas = (m) => (m.tipo === "reel" ? `${num(m.views)} vis · ${num(m.reach)} alc` : `${num(m.reach)} alc · ${num(m.saved)} guard`);

  // ── Piezas sueltas ──────────────────────────────────────────────────────
  const Redondo = ({ label, onClick, oscuro, tam = 44, disabled, children, clase = "" }) => html`
    <button type="button" class=${"round " + (oscuro ? "round--dark " : "") + clase} style=${{ width: tam, height: tam }}
      aria-label=${label} title=${label} onClick=${onClick} disabled=${disabled}>${children}</button>`;

  const Estado = ({ p, ahora }) => html`
    <${React.Fragment}>
      <span class=${"estado estado--" + p.estado}>${ESTADOS[p.estado]}</span>
      ${pasada(p, ahora) ? html`<span class="estado estado--tarde">Pasada la hora</span>` : null}
    <//>`;

  function Miniatura({ p }) {
    if (p.tipo === "reel" && p.archivos?.length) return html`<img class="pz__mini" src=${`/api/poster?id=${p.generar.id}`} alt="" loading="lazy" />`;
    if (p.archivos?.length) return html`<img class="pz__mini" src=${p.archivos[0].url} alt="" loading="lazy" />`;
    return html`<span class="pz__mini pz__mini--vacia" title="Sin archivo todavía"><${Icon} name="alert" size=${16} /></span>`;
  }

  function Tarjeta({ p, m, an, ahora, onAbrir, nf, nfg }) {
    const T = TIPOS[p.tipo];
    const abrir = () => onAbrir(p.id);
    if (p.tipo === "story") return html`
      <button type="button" class="pz pz--story" onClick=${abrir} aria-label=${`Abrir la ficha de ${p.id}: ${p.titulo}`}>
        <div class="pz__top"><span class="pz__hora">${p.hora || "—"}</span><span class="pz__tipo"><${Icon} name=${T.icon} size=${13} />${T.et} · ${p.id}</span></div>
        <div class="pz__titulo">${p.titulo}</div>
        <div class="pz__sticker">${p.sticker}</div>
        <div class="pz__pie"><${Estado} p=${p} ahora=${ahora} /><${NubeChip} f=${nf} /></div>
      </button>`;
    const ev = evaluar(p, m, an);
    return html`
      <button type="button" class="pz" onClick=${abrir} aria-label=${`Abrir la ficha de ${p.id}: ${p.titulo}`}>
        <div class="pz__top"><span class="pz__hora">${p.hora || "—"}</span><span class="pz__tipo"><${Icon} name=${T.icon} size=${13} />${T.et}</span></div>
        <div class="pz__cuerpo">
          <${Miniatura} p=${p} />
          <div style=${{ minWidth: 0 }}><div class="pz__titulo">${p.titulo}</div><div class="pz__id">${p.id} · ${CARRILES[p.carril]}</div></div>
        </div>
        <div class="pz__porque">${p.porque}</div>
        <div class="pz__pie">
          <${Estado} p=${p} ahora=${ahora} />
          <${NubeChip} f=${nf} />
          ${p.estado === "grabar" ? html`<${NubeChip} f=${nfg} />` : null}
          ${m ? html`<span class="pz__cifras">${cifrasCortas(m)}</span>` : null}
          ${ev ? html`<span class=${"estado " + (ev.ok ? "estado--ok" : "estado--tarde")}>${ev.ok ? "Cumple" : "Por debajo"}</span>` : null}
        </div>
      </button>`;
  }

  // ── Vista: semana ───────────────────────────────────────────────────────
  function VistaSemana({ cal, semana, piezas, media, an, ahora, onAbrir, onSemana, onHoy, onGenerar, nubeF, onProgramarSemana }) {
    const s = cal.semanas.find((w) => w.n === semana);
    const dias = Array.from({ length: 7 }, (_, i) => sumarDias(s.desde, i));
    const primera = cal.semanas[0].n, ultima = cal.semanas[cal.semanas.length - 1].n;
    return html`
      <div class="sem__head">
        <div style=${{ minWidth: 0 }}>
          <div class="sem__eyebrow">Semana ${s.n} de ${cal.semanas.length} · ${fechaCorta(s.desde)} – ${fechaCorta(s.hasta)} · ${CARRILES[s.carril]}</div>
          <div class="sem__titulo">${s.titulo}</div>
          <div class="sem__porque" title=${s.porque}><b>Por qué:</b> ${s.porque}</div>
        </div>
        <div class="sem__acciones">
          <${Redondo} label="Semana anterior" onClick=${() => onSemana(semana - 1)} disabled=${semana <= primera}><${Icon} name="left" /><//>
          <${Redondo} label="Semana siguiente" onClick=${() => onSemana(semana + 1)} disabled=${semana >= ultima}><${Icon} name="right" /><//>
          <button type="button" class="btn" onClick=${onHoy}><${Icon} name="home" size=${14} />Hoy</button>
          <button type="button" class="btn" onClick=${onProgramarSemana}><${Icon} name="cloud" size=${14} />Programar semana</button>
          <button type="button" class="btn btn--osc" onClick=${() => onGenerar({})}><${Icon} name="plus" size=${14} />Generar</button>
        </div>
      </div>
      <div class="dias">
        <div class="dias__linea"></div>
        ${dias.map((f) => {
          const del = piezas.filter((p) => p.fecha === f).sort(orden);
          const esHoy = f === ahora.fecha;
          return html`
            <div key=${f} class=${"dia" + (esHoy ? " dia--hoy" : "")}>
              <div class="dia__cab">
                <div class=${"dia__marca" + (esHoy ? " dia__marca--hoy" : del.length ? " dia__marca--con" : "")} aria-hidden="true">${del.length || ""}</div>
                <div class="dia__nombre"><b>${cap(diaCorto(f))}</b> ${fechaCorta(f)}${esHoy ? " · hoy" : ""}</div>
              </div>
              ${del.length
                ? del.map((p) => html`<${Tarjeta} key=${p.id} p=${p} m=${p.ig ? media[p.ig] : null} an=${an} ahora=${ahora} onAbrir=${onAbrir} nf=${nubeF[p.id]} nfg=${nubeF[p.id + "-grabar"]} />`)
                : html`<div class="dia__vacio">Nada que subir</div>`}
            </div>`;
        })}
      </div>`;
  }

  // ── Vista: mes ──────────────────────────────────────────────────────────
  function VistaMes({ cal, piezas, media, an, ahora, onAbrir, nubeF }) {
    const conFecha = piezas.filter((p) => p.fecha);
    if (!conFecha.length) return html`<div class="vacio">Ninguna pieza cumple los filtros. Pulsa el botón de filtros para verlas todas.</div>`;
    return html`
      <table class="mes">
        <thead><tr><th>Día</th><th>Hora</th><th>Formato</th><th>Pieza</th><th>Por qué</th><th>Estado</th><th>Resultado</th></tr></thead>
        <tbody>
          ${cal.semanas.map((s) => {
            const filas = conFecha.filter((p) => p.semana === s.n).sort(orden);
            if (!filas.length) return null;
            return html`
              <${React.Fragment} key=${s.n}>
                <tr class="mes__semana"><td colSpan="7">Semana ${s.n} · ${s.titulo}<small>${fechaCorta(s.desde)} – ${fechaCorta(s.hasta)} · ${s.porque}</small></td></tr>
                ${filas.map((p) => {
                  const m = p.ig ? media[p.ig] : null;
                  const ev = evaluar(p, m, an);
                  return html`
                    <tr key=${p.id} class="fila" onClick=${() => onAbrir(p.id)}>
                      <td>${cap(diaCorto(p.fecha))} ${fechaCorta(p.fecha)}</td>
                      <td class="num">${p.hora || "—"}</td>
                      <td><span class="pz__tipo"><${Icon} name=${TIPOS[p.tipo].icon} size=${13} />${TIPOS[p.tipo].et}</span></td>
                      <td><button type="button" class="mes__tit" onClick=${(e) => { e.stopPropagation(); onAbrir(p.id); }}>${p.id} · ${p.titulo}</button></td>
                      <td><div class="mes__porque" title=${p.porque}>${p.porque}</div></td>
                      <td><div class="pz__pie"><${Estado} p=${p} ahora=${ahora} /><${NubeChip} f=${nubeF[p.id]} />${p.estado === "grabar" ? html`<${NubeChip} f=${nubeF[p.id + "-grabar"]} />` : null}</div></td>
                      <td>${m ? html`<span class="num">${cifrasCortas(m)}</span>${ev ? html` <span class=${"estado " + (ev.ok ? "estado--ok" : "estado--tarde")}>${ev.ok ? "Cumple" : "Por debajo"}</span>` : null}` : html`<span class="pz__sticker">${p.tipo === "story" ? p.sticker : p.objetivo}</span>`}</td>
                    </tr>`;
                })}
              <//>`;
          })}
        </tbody>
      </table>`;
  }

  // ── Vista: horas ────────────────────────────────────────────────────────
  function Barras({ datos }) {
    const max = Math.max(1, ...datos.map((d) => d.v || 0));
    return html`
      <div class="barras" role="img" aria-label=${datos.map((d) => `${d.et}: ${d.v == null ? "sin datos" : num(d.v)}`).join(", ")}>
        ${datos.map((d) => html`
          <div key=${d.et} class=${"barra" + (d.top ? " barra--top" : "")}>
            <span class="barra__v">${d.v == null ? "—" : num(d.v)}</span>
            <div class="barra__col" style=${{ height: `${d.v ? Math.max(4, (d.v / max) * 120) : 4}px` }}></div>
            <span class="barra__et">${d.et}${d.sub ? html`<br />${d.sub}` : null}</span>
            <span class="barra__n">${d.n} ${d.n === 1 ? "pub." : "pubs."}</span>
          </div>`)}
      </div>`;
  }

  function VistaHoras({ an, igEstado, piezas }) {
    if (!an) return html`<div class="vacio">${igEstado === "error" ? "No hay conexión con Instagram: sin datos no se pueden justificar las horas." : "Cargando tus datos de Instagram…"}</div>`;
    const mejor = (xs, min) => xs.filter((x) => x.n >= min).sort((a, b) => b.mediana - a.mediana)[0];
    const fr = an.reels.franjas, top = mejor(fr, 2);
    const dias = an.reels.dias, topDia = mejor(dias, 3);
    const ff = an.feed.franjas, topF = mejor(ff, 2);
    const recos = [
      { tipo: "reel", r: an.recomendaciones.reel },
      { tipo: "carrusel", r: an.recomendaciones.carrusel },
      { tipo: "post", r: an.recomendaciones.post },
      { tipo: "story", r: an.recomendaciones.story },
    ];
    // Qué piezas del calendario no están a la hora que dicen los datos.
    const distintas = (tipo, hora) => piezas.filter((p) => p.tipo === tipo && p.fecha && p.hora && p.hora !== hora);
    const peor = [...dias.filter((d) => d.n >= 3)].sort((a, b) => a.mediana - b.mediana)[0];
    const reelsEnPeor = peor ? piezas.filter((p) => p.tipo === "reel" && p.fecha && (d12(p.fecha).getUTCDay() + 6) % 7 === dias.indexOf(peor)).length : 0;
    return html`
      <div class="horas">
        <div class="bloque">
          <div class="bloque__tit">Reels · alcance según la hora</div>
          <div class="bloque__sub">Mediana de alcance de tus ${an.muestras.reels} reels, por franja (hora de Madrid)</div>
          <${Barras} datos=${fr.map((f) => ({ et: f.nombre, sub: `${f.desde}–${f.hasta} h`, v: f.mediana, n: f.n, top: f === top }))} />
          <div class="bloque__nota">${an.recomendaciones.reel.texto}</div>
        </div>
        <div style=${{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div class="bloque">
            <div class="bloque__tit">Reels · alcance según el día</div>
            <div class="bloque__sub">Mediana por día de la semana. Con menos de 3 reels, el día no cuenta.</div>
            <${Barras} datos=${dias.map((d) => ({ et: d.dia, v: d.mediana, n: d.n, top: d === topDia }))} />
            ${an.dias ? html`<div class="bloque__nota">${an.dias}${peor && reelsEnPeor ? ` El calendario tiene ${reelsEnPeor} reel${reelsEnPeor > 1 ? "s" : ""} en ${peor.largo}: puedes moverlos desde su ficha.` : ""}</div>` : null}
          </div>
          <div class="bloque">
            <div class="bloque__tit">Carruseles y posts · según la hora</div>
            <div class="bloque__sub">${an.muestras.feed} publicaciones: pocas para sacar un patrón firme</div>
            <${Barras} datos=${ff.map((f) => ({ et: f.nombre, sub: `${f.desde}–${f.hasta} h`, v: f.mediana, n: f.n, top: f === topF }))} />
          </div>
        </div>
        <div class="bloque">
          <div class="bloque__tit">Horas de subida del calendario</div>
          <div class="bloque__sub">Por qué cada formato va a su hora</div>
          ${recos.map(({ tipo, r }) => {
            const otras = distintas(tipo, r.hora);
            return html`
              <div key=${tipo} class="reco">
                <span class="reco__hora">${r.hora}</span>
                <span class="reco__fmt"><${Icon} name=${TIPOS[tipo].icon} size=${14} />${TIPOS[tipo].plural}<span class=${"conf conf--" + (r.confianza === "media" ? "media" : r.confianza === "baja" ? "baja" : "")}>${r.confianza === "sin datos" ? "sin datos" : "confianza " + r.confianza}</span></span>
                <span class="reco__txt">${r.texto}${tipo !== "story" && otras.length ? ` Hay ${otras.length} pieza${otras.length > 1 ? "s" : ""} a otra hora: ${otras.map((p) => `${p.id} (${p.hora})`).join(", ")}.` : ""}</span>
              </div>`;
          })}
        </div>
      </div>`;
  }

  // ── Vista: publicado ────────────────────────────────────────────────────
  function VistaPublicado({ ig, igEstado, piezas, fTipo, onAbrir }) {
    if (!ig) return html`<div class="vacio">${igEstado === "error" ? "No hay conexión con Instagram." : "Cargando tus publicaciones…"}</div>`;
    const deQuien = Object.fromEntries(piezas.filter((p) => p.ig).map((p) => [p.ig, p]));
    const lista = ig.media.filter((m) => fTipo[m.tipo]).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    if (!lista.length) return html`<div class="vacio">Ninguna publicación de los formatos marcados.</div>`;
    return html`
      <div class="rejilla">
        ${lista.map((m) => {
          const p = deQuien[m.id];
          return html`
            <div key=${m.id} class="pubcard">
              <a href=${m.enlace} target="_blank" rel="noopener" aria-label=${`Abrir en Instagram: ${m.titular}`}>
                ${m.miniatura ? html`<img class="pubcard__img" src=${`/api/miniatura?id=${m.id}`} alt="" loading="lazy" />` : html`<div class="pubcard__img"></div>`}
              </a>
              <div class="pubcard__cuerpo">
                <div class="pubcard__meta"><span>${cap(diaCorto(m.fecha))} ${fechaCorta(m.fecha)} · ${m.hora} h</span><span>${TIPOS[m.tipo]?.et || m.tipo}</span></div>
                <a class="pubcard__tit" href=${m.enlace} target="_blank" rel="noopener" style=${{ color: "inherit", textDecoration: "none" }}>${m.titular || "Sin texto"}</a>
                <div class="pubcard__cifras">
                  ${m.tipo === "reel" ? html`<span><b>${num(m.views)}</b> vis</span>` : null}
                  <span><b>${num(m.reach)}</b> alc</span><span><b>${num(m.saved)}</b> guard</span><span><b>${num(m.shares)}</b> comp</span>
                </div>
                <div>${p
                  ? html`<button type="button" class="chip-id" style=${{ border: 0, cursor: "pointer" }} onClick=${() => onAbrir(p.id)}>Pieza ${p.id}</button>`
                  : html`<span class="chip-id chip-id--no">Sin pieza del calendario</span>`}</div>
              </div>
            </div>`;
        })}
      </div>`;
  }

  // ── Vista: repuesto ─────────────────────────────────────────────────────
  function VistaRepuesto({ piezas, onAbrir }) {
    const lista = piezas.filter((p) => !p.fecha);
    if (!lista.length) return html`<div class="vacio">No queda nada en el banco de repuesto con los filtros marcados.</div>`;
    return html`
      <div class="sem__head" style=${{ height: "auto", marginBottom: 14 }}>
        <div>
          <div class="sem__eyebrow">Banco de repuesto · ${lista.length} piezas sin fecha</div>
          <div class="sem__titulo">Para un día sin reel o si algo falla</div>
          <div class="sem__porque">Abre una y ponle día y hora para meterla en el calendario.</div>
        </div>
      </div>
      <div class="rejilla">
        ${lista.map((p) => html`
          <div key=${p.id} class="pubcard">
            <button type="button" style=${{ border: 0, padding: 0, background: "none", cursor: "pointer" }} onClick=${() => onAbrir(p.id)} aria-label=${`Abrir ${p.id}`}>
              ${p.archivos?.[0] ? html`<img class="pubcard__img" src=${p.archivos[0].url} alt="" loading="lazy" />` : html`<div class="pubcard__img"></div>`}
            </button>
            <div class="pubcard__cuerpo">
              <div class="pubcard__meta"><span>${p.id} · ${TIPOS[p.tipo].et}</span><span>${CARRILES[p.carril]}</span></div>
              <div class="pubcard__tit">${p.titulo}</div>
              <div class="pz__porque">${p.porque}</div>
              <div><button type="button" class="btn btn--osc" style=${{ height: 36 }} onClick=${() => onAbrir(p.id)}><${Icon} name="calendar" size=${14} />Programar</button></div>
            </div>
          </div>`)}
      </div>`;
  }

  // ── Ficha de una pieza ──────────────────────────────────────────────────
  function Ficha({ p, ig, piezas, an, ahora, onClose, onGuardar, onGenerar, avisar, nube, nf, onNube }) {
    const media = ig?.media || [];
    const porId = useMemo(() => Object.fromEntries(media.map((m) => [m.id, m])), [media]);
    const m = p.ig ? porId[p.ig] : null;
    const rec = an?.recomendaciones?.[p.tipo];
    const [i, setI] = useState(0);
    const [fecha, setFecha] = useState(p.fecha || "");
    const [hora, setHora] = useState(p.hora || "");
    const [sel, setSel] = useState("");
    const preRef = useRef(null);
    useEffect(() => { setFecha(p.fecha || ""); setHora(p.hora || ""); }, [p.fecha, p.hora]);

    const T = TIPOS[p.tipo];
    const semana = p.semana ? `Semana ${p.semana}` : "Repuesto";
    const texto = [p.caption, p.cta, p.hashtags].filter(Boolean).join("\n\n");
    const imagenes = (p.archivos || []).filter((a) => !a.video);
    const videos = (p.archivos || []).filter((a) => a.video);
    const cambiada = (fecha || "") !== (p.fecha || "") || (hora || "") !== (p.hora || "");
    const ev = evaluar(p, m, an);
    const deOtra = Object.fromEntries(piezas.filter((x) => x.ig && x.id !== p.id).map((x) => [x.ig, x.id]));
    const candidatas = media.filter((x) => x.tipo === p.tipo)
      .sort((a, b) => (p.fecha ? Math.abs(d12(a.fecha) - d12(p.fecha)) - Math.abs(d12(b.fecha) - d12(p.fecha)) : b.timestamp.localeCompare(a.timestamp)))
      .slice(0, 25);

    const copiar = async () => {
      try { await navigator.clipboard.writeText(texto); avisar("Texto copiado"); }
      catch {
        const r = document.createRange(); r.selectNodeContents(preRef.current);
        const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        avisar("Seleccionado: pulsa Ctrl+C para copiarlo");
      }
    };
    const guardarCuando = () => {
      if (fecha && !hora) return avisar("Falta la hora", true);
      onGuardar({ fecha: fecha || null, hora: fecha ? hora : null }, fecha ? "Día y hora guardados" : "Movida al repuesto");
    };

    return html`
      <div class="modal" role="dialog" aria-modal="true" aria-label=${`Ficha de ${p.id}`} onClick=${(e) => e.target === e.currentTarget && onClose()}>
        <div class="modal__box ficha">
          <div class="modal__head">
            <div>
              <div class="ficha__eyebrow">${T.et} · ${p.id} · ${semana} · ${CARRILES[p.carril]}</div>
              <div class="ficha__titulo">${p.titulo}</div>
            </div>
            <${Redondo} label="Cerrar la ficha" onClick=${onClose}><${Icon} name="close" /><//>
          </div>

          <div class="ficha__grid">
            <div>
              <div class="ficha__prev">
                ${videos.length
                  ? html`<video key=${videos[0].url} src=${videos[0].url} controls preload="metadata" poster=${p.generar ? `/api/poster?id=${p.generar.id}` : undefined}></video>`
                  : imagenes.length
                    ? html`
                      <img src=${imagenes[Math.min(i, imagenes.length - 1)].url} alt=${`Diapositiva ${i + 1} de ${p.id}`} />
                      ${imagenes.length > 1 ? html`
                        <div class="ficha__prevnav">
                          <${Redondo} label="Diapositiva anterior" tam=${36} onClick=${() => setI((i - 1 + imagenes.length) % imagenes.length)}><${Icon} name="left" size=${14} /><//>
                          <span class="ficha__contador">${Math.min(i, imagenes.length - 1) + 1} / ${imagenes.length}</span>
                          <${Redondo} label="Diapositiva siguiente" tam=${36} onClick=${() => setI((i + 1) % imagenes.length)}><${Icon} name="right" size=${14} /><//>
                        </div>` : null}`
                    : html`<div class="ficha__sinarchivo"><b>${p.estado === "grabar" ? "Por grabar" : "Sin archivo"}</b>${p.notas || "Todavía no hay nada renderizado para esta pieza."}</div>`}
              </div>
              ${(p.archivos || []).length ? html`
                <div class="ficha__archivos">
                  ${videos.map((a) => html`<a key=${a.url} href=${a.url} download><${Icon} name="download" size=${13} />Descargar · ${a.formato}</a>`)}
                  ${imagenes.length ? html`<a href=${imagenes[0].url} download onClick=${(e) => {
                    if (imagenes.length < 2) return;
                    // Varias imágenes: se descargan una tras otra (el navegador puede pedir permiso una vez).
                    e.preventDefault();
                    imagenes.forEach((a, k) => setTimeout(() => { const l = document.createElement("a"); l.href = a.url; l.download = ""; document.body.appendChild(l); l.click(); l.remove(); }, k * 350));
                  }}><${Icon} name="download" size=${13} />Descargar ${imagenes.length > 1 ? `las ${imagenes.length} imágenes` : "la imagen"} · ${imagenes[0].formato}</a>` : null}
                </div>` : null}
            </div>

            <div class="ficha__info">
              <div class="campo">
                <span class="campo__et">Cuándo se sube</span>
                <div class="campo__fila">
                  <label><span class="sr">Día</span><input id=${`fecha-${p.id}`} type="date" value=${fecha} onInput=${(e) => setFecha(e.target.value)} /></label>
                  <label><span class="sr">Hora</span><input id=${`hora-${p.id}`} type="time" value=${hora} onInput=${(e) => setHora(e.target.value)} /></label>
                  <button type="button" class="btn btn--osc" disabled=${!cambiada} onClick=${guardarCuando}><${Icon} name="check" size=${14} />Guardar</button>
                  ${p.fecha ? html`<button type="button" class="btn" onClick=${() => onGuardar({ fecha: null, hora: null }, "Movida al repuesto")}><${Icon} name="stack" size=${14} />Al repuesto</button>` : null}
                </div>
                <span class="campo__txt">${p.fecha ? `${cap(fechaLarga(p.fecha))} a las ${p.hora}` : "Sin fecha: está en el banco de repuesto."}${pasada(p, ahora) ? " Ya ha pasado la hora y no consta como publicada." : ""}</span>
              </div>

              ${rec ? html`
                <div class="campo">
                  <span class="campo__et">Por qué a esa hora</span>
                  <span class="campo__txt">${rec.texto}${p.hora && rec.hora !== p.hora ? ` La hora recomendada para ${T.plural.toLowerCase()} es ${rec.hora}.` : ""}</span>
                </div>` : null}

              <div class="campo">
                <span class="campo__et">Publicación automática</span>
                <${NubeFicha} p=${p} f=${nf} fg=${nube?.filas?.find((x) => x.pieza === p.id + "-grabar")} nube=${nube} onAccion=${onNube} />
              </div>

              <div class="campo">
                <span class="campo__et">Por qué esta pieza</span>
                <span class="campo__txt">${p.porque}</span>
              </div>

              <div class="campo">
                <span class="campo__et">Objetivo</span>
                <span class="campo__txt">${p.objetivo}${ev ? html` · <span class=${"estado " + (ev.ok ? "estado--ok" : "estado--tarde")}>${ev.ok ? "Cumple" : "Por debajo"}</span> <span style=${{ color: "var(--muted)" }}>${ev.texto}</span>` : ""}</span>
              </div>

              <div class="campo">
                <span class="campo__et">Estado</span>
                <div class="segmento" role="group" aria-label="Estado de la pieza">
                  ${Object.entries(ESTADOS).map(([k, v]) => html`
                    <button key=${k} type="button" aria-pressed=${p.estado === k} onClick=${() => p.estado !== k && onGuardar({ estado: k }, `Marcada como ${v.toLowerCase()}`)}>${v}</button>`)}
                </div>
              </div>

              <div class="campo">
                <span class="campo__et">En Instagram</span>
                ${m ? html`
                  <div class="metricas">
                    ${p.tipo === "reel" ? html`<div class="metrica"><b>${num(m.views)}</b><span>Visualizaciones</span></div>` : null}
                    <div class="metrica"><b>${num(m.reach)}</b><span>Alcance</span></div>
                    <div class="metrica"><b>${num(m.saved)}</b><span>Guardados</span></div>
                    <div class="metrica"><b>${num(m.shares)}</b><span>Compartidos</span></div>
                    <div class="metrica"><b>${num(m.likes)}</b><span>Me gusta</span></div>
                    <div class="metrica"><b>${num(m.comments)}</b><span>Comentarios</span></div>
                  </div>
                  <div class="campo__fila">
                    <a class="btn" href=${m.enlace} target="_blank" rel="noopener"><${Icon} name="external" size=${14} />Ver en Instagram</a>
                    <button type="button" class="btn btn--peligro" onClick=${() => onGuardar({ ig: null }, "Desvinculada")}><${Icon} name="link" size=${14} />Desvincular</button>
                    <span class="pz__sticker">${p.igAuto ? "Vinculada sola: mismo día y mismo formato." : `Publicada el ${fechaLarga(m.fecha)} a las ${m.hora} h.`}</span>
                  </div>`
                : p.tipo === "story" ? html`<span class="campo__txt">Instagram solo da las cifras de una story durante sus 24 horas: mira las respuestas al sticker (${p.sticker}) en la app y márcala como publicada aquí.</span>`
                : !ig ? html`<span class="campo__txt">Sin conexión con Instagram todavía.</span>`
                : candidatas.length ? html`
                  <div class="campo__fila">
                    <label style=${{ flex: 1, minWidth: 0 }}><span class="sr">Publicación de Instagram</span>
                      <select id=${`ig-${p.id}`} value=${sel} onChange=${(e) => setSel(e.target.value)} style=${{ width: "100%" }}>
                        <option value="">Elige su publicación en Instagram…</option>
                        ${candidatas.map((x) => html`<option key=${x.id} value=${x.id}>${cap(diaCorto(x.fecha))} ${fechaCorta(x.fecha)} · ${x.hora} h · ${x.titular.slice(0, 48)}${deOtra[x.id] ? ` (ahora es de ${deOtra[x.id]})` : ""}</option>`)}
                      </select>
                    </label>
                    <button type="button" class="btn btn--osc" disabled=${!sel} onClick=${() => onGuardar({ ig: sel }, "Vinculada con Instagram")}><${Icon} name="link" size=${14} />Vincular</button>
                  </div>
                  <span class="pz__sticker">Cuando la subas, se vincula sola si ese día solo hay un ${T.et.toLowerCase()} publicado.</span>`
                : html`<span class="campo__txt">Todavía no hay ningún ${T.et.toLowerCase()} publicado en la cuenta.</span>`}
              </div>
            </div>
          </div>

          <div class="campo">
            <span class="campo__et">Texto para Instagram</span>
            <pre class="texto-copia" ref=${preRef}>${texto}</pre>
            ${p.tipo === "story" ? html`<span class="campo__txt">Sticker al subirla: <b>${p.sticker}</b>. Déjalo en el tercio inferior, que la imagen ya viene con el hueco.</span>` : null}
            ${p.notas && p.estado === "grabar" ? html`<div class="aviso">${p.notas}</div>` : null}
          </div>

          <div class="ficha__acciones">
            <button type="button" class="btn btn--osc" onClick=${copiar}><${Icon} name="copy" size=${14} />Copiar texto</button>
            ${p.generar ? html`<button type="button" class="btn" onClick=${() => onGenerar(p.generar)}><${Icon} name="refresh" size=${14} />${p.archivos?.length ? "Volver a generar" : "Generar"}</button>` : null}
            ${p.generar?.tipo === "reel" ? html`<button type="button" class="btn" onClick=${() => onGenerar({ tipo: "video16x9", id: p.generar.id })}><${Icon} name="video" size=${14} />Generar versión 16:9</button>` : null}
          </div>
        </div>
      </div>`;
  }

  // ── Barra de semanas ────────────────────────────────────────────────────
  function BarraSemanas({ cal, semana, vista, onSemana, onMes, onRepuesto }) {
    const repuesto = cal.piezas.filter((p) => !p.fecha).length;
    return html`
      <div class="calbar">
        <${Redondo} label="Ver el mes entero" oscuro tam=${40} onClick=${onMes}><${Icon} name="list" /><//>
        <div class="calbar__mes"><b>${cal.mes.split(" ")[0]}</b>${cal.mes.split(" ")[1]}</div>
        ${cal.semanas.map((s) => {
          const ps = cal.piezas.filter((p) => p.semana === s.n);
          const hechas = ps.filter((p) => p.estado !== "grabar").length;
          const on = vista === "semana" && semana === s.n;
          return html`
            <button key=${s.n} type="button" class=${"semseg" + (on ? " semseg--on" : "")} onClick=${() => onSemana(s.n)}
              aria-label=${`Semana ${s.n}, ${s.titulo}: ${hechas} de ${ps.length} piezas listas`} aria-current=${on ? "true" : undefined}>
              <span class="semseg__et"><b>Sem ${s.n}</b>${fechaCorta(s.desde)}</span>
              ${Object.keys(TIPOS).map((t) => {
                const n = ps.filter((p) => p.tipo === t).length;
                return n ? html`<span key=${t} class="semseg__ic" title=${`${n} ${TIPOS[t].plural.toLowerCase()}`}><${Icon} name=${TIPOS[t].icon} size=${12} /><span class="calbar__badge">${n}</span></span>` : null;
              })}
              <span class="semseg__prog" title="Listas o publicadas / total">${hechas}/${ps.length}</span>
            </button>`;
        })}
        <button type="button" class=${"semseg" + (vista === "repuesto" ? " semseg--on" : "")} style=${{ flex: "none" }} onClick=${onRepuesto}>
          <span class="semseg__et"><b>Repuesto</b>${repuesto} sin fecha</span>
        </button>
      </div>`;
  }

  // ── El panel ────────────────────────────────────────────────────────────
  const PESTANAS = [
    { id: "semana", label: "Semana", icon: "calendar" },
    { id: "mes", label: "Mes", icon: "list" },
    { id: "horas", label: "Horas", icon: "clock" },
    { id: "publicado", label: "Publicado", icon: "check" },
    { id: "repuesto", label: "Repuesto", icon: "stack" },
    { id: "avisos", label: "Avisos", icon: "bell" },
  ];

  function PanelPublicaciones() {
    const [cal, setCal] = useState(null);
    const [calError, setCalError] = useState("");
    const [ig, setIg] = useState(null);
    const [igEstado, setIgEstado] = useState("cargando"); // cargando · actualizando · ok · error
    const [vista, setVista] = useState("semana");
    const [semana, setSemana] = useState(1);
    const [fTipo, setFTipo] = useState(TODOS_TIPOS);
    const [fEstado, setFEstado] = useState(TODOS_ESTADOS);
    const [ficha, setFicha] = useState(null);
    const [generar, setGenerar] = useState(null);
    const [toast, setToast] = useState(null);
    const [nube, setNube] = useState(null);
    const [programarSemana, setProgramarSemana] = useState(false);
    const [ahora, setAhora] = useState(ahoraMadrid());
    const toastT = useRef(null);

    const avisar = (texto, error) => { setToast({ texto, error }); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 2800); };

    const cargarCal = () => fetch("/api/calendario").then((r) => r.json()).then((d) => { if (d.error) throw new Error(d.error); setCal(d); return d; });
    const cargarIg = (fresco) => {
      setIgEstado(fresco ? "actualizando" : "cargando");
      return fetch("/api/instagram" + (fresco ? "?fresco=1" : "")).then((r) => r.json()).then((d) => {
        if (d.error) throw new Error(d.error);
        setIg(d); setIgEstado("ok");
        if (d.vinculadas) { cargarCal(); avisar(`${d.vinculadas} pieza${d.vinculadas > 1 ? "s" : ""} vinculada${d.vinculadas > 1 ? "s" : ""} con su publicación`); }
        else if (fresco) avisar("Datos de Instagram actualizados");
      }).catch((e) => { setIgEstado("error"); if (fresco) avisar(`Instagram no responde: ${e.message}`, true); });
    };

    const cargarNube = () => fetch("/api/nube").then((r) => r.json()).then((d) => {
      if (d.error) throw new Error(d.error);
      setNube(d);
      if (d.sincronizadas) { cargarCal(); avisar("Publicación de la nube pasada al calendario"); }
    }).catch(() => setNube((n) => n || { configurada: false, filas: [], avisos: [] }));

    // Programar, publicar, cancelar o probar en la nube (una pieza o varias).
    const accionNube = async (accion, id) => {
      const cuerpo = Array.isArray(id) ? { ids: id } : { id };
      const r = await fetch(`/api/nube/${accion}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
      const d = await r.json();
      await Promise.all([cargarNube(), cargarCal()]);
      if (d.error) { avisar(d.error, true); throw new Error(d.error); }
      if (Array.isArray(id)) avisar(`${d.hechas.length} programada${d.hechas.length === 1 ? "" : "s"}${d.fallos.length ? ` · ${d.fallos.length} con error: ${d.fallos.map((f) => f.id).join(", ")}` : ""}`, d.fallos.length > 0);
      else avisar({ programar: "Programada en la nube", cancelar: "Programación cancelada", publicar: d.fila?.estado === "publicada" ? "Publicada en Instagram" : `Instagram: ${d.resultado}`, probar: `Instagram: ${d.resultado}` }[accion]);
      if (accion === "publicar") cargarIg(true);
      return d;
    };

    useEffect(() => {
      cargarCal().then((d) => setSemana(semanaDe(d, ahoraMadrid().fecha))).catch((e) => setCalError(e.message));
      cargarIg(false);
      cargarNube();
      const t = setInterval(() => { setAhora(ahoraMadrid()); cargarNube(); }, 60000);
      return () => clearInterval(t);
    }, []);

    useEffect(() => {
      const tecla = (e) => { if (e.key === "Escape") { if (generar) setGenerar(null); else if (programarSemana) setProgramarSemana(false); else if (ficha) setFicha(null); } };
      document.addEventListener("keydown", tecla);
      return () => document.removeEventListener("keydown", tecla);
    }, [generar, ficha, programarSemana]);

    const guardar = (id, cambios, mensaje) =>
      fetch("/api/calendario/pieza", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, cambios }) })
        .then((r) => r.json())
        .then((p) => { if (p.error) throw new Error(p.error); setCal((c) => ({ ...c, piezas: c.piezas.map((x) => (x.id === id ? p : x)) })); avisar(mensaje || "Guardado"); })
        .catch((e) => avisar(e.message, true));

    const media = useMemo(() => Object.fromEntries((ig?.media || []).map((m) => [m.id, m])), [ig]);
    const nubeF = useMemo(() => Object.fromEntries((nube?.filas || []).map((f) => [f.pieza, f])), [nube]);

    if (calError) return html`<div class="page"><div class="vacio">No se pudo cargar el calendario: ${calError}</div></div>`;
    if (!cal) return html`<div class="page"><div class="vacio">Cargando el calendario…</div></div>`;

    const an = ig?.analisis;
    const visibles = cal.piezas.filter((p) => fTipo[p.tipo] && fEstado[p.estado]);
    const programadas = cal.piezas.filter((p) => p.fecha).sort(orden);
    const proxima = programadas.find((p) => p.estado !== "publicado" && p.hora && (p.fecha > ahora.fecha || (p.fecha === ahora.fecha && p.hora > ahora.hora)));
    const porGrabar = programadas.filter((p) => p.estado === "grabar").length;
    const irHoy = () => { setVista("semana"); setSemana(semanaDe(cal, ahora.fecha)); setFicha(null); };
    const filtrosPorDefecto = () => { setFTipo(TODOS_TIPOS); setFEstado(TODOS_ESTADOS); avisar("Filtros restablecidos"); };
    const cuenta = ig?.cuenta;
    const pieza = ficha && cal.piezas.find((p) => p.id === ficha);

    const cifras = [
      { label: "Seguidores", value: num(cuenta?.followers_count) },
      { label: "Alcance 7 días", value: num(ig?.alcance7d) },
      { label: "Publicaciones", value: num(cuenta?.media_count) },
      { label: "Próxima subida", value: proxima ? cuando(proxima, ahora) : "—", sub: proxima ? `${nubeActiva(nubeF[proxima.id]) ? (nubeF[proxima.id].tipo === "aviso" ? "Aviso · " : "Sale sola · ") : ""}${TIPOS[proxima.tipo].et} · ${proxima.titulo}` : "Nada pendiente", onClick: proxima ? () => setFicha(proxima.id) : null, ancho: 190 },
      { label: "Por grabar", value: String(porGrabar), sub: "Ver cuáles", onClick: () => { setFTipo(TODOS_TIPOS); setFEstado({ listo: false, grabar: true, publicado: false }); setVista("mes"); } },
    ];

    return html`
      <div class="page">
        <div class="shell">
          <div class="panel pub">
            <div class="header">
              <div class="header__notch"></div>
              <div class="header__tab">
                <${Redondo} label="Volver a hoy" tam=${52} onClick=${irHoy}><${Icon} name="home" /><//>
                <div class="header__title">Contenido</div>
              </div>
              <div class="header__tabs" role="tablist">
                ${PESTANAS.map((t) => html`
                  <button key=${t.id} type="button" role="tab" aria-selected=${vista === t.id} class=${"pill " + (vista === t.id ? "pill--on" : "")} onClick=${() => setVista(t.id)}>
                    <${Icon} name=${t.icon} />${t.label}
                  </button>`)}
              </div>
            </div>

            <a class="profile" href=${`https://www.instagram.com/${cuenta?.username || "tactium.io"}/`} target="_blank" rel="noopener" aria-label="Abrir el perfil en Instagram">
              <div class="profile__avatar">
                <img src=${cuenta?.profile_picture_url || "/public/img/logo-t.png"} alt="" referrerpolicy="no-referrer" />
              </div>
              <div>
                <div class="profile__meta">@${cuenta?.username || "tactium.io"}</div>
                <div class="profile__name">${cuenta?.name || "TACTIUM"}</div>
                <div class="profile__link">Abrir en Instagram <${Icon} name="external" size=${11} /></div>
              </div>
            </a>

            <div class="stats">
              ${cifras.map((c) => {
                const cuerpo = html`
                  <div class="stat__label">${c.label}</div>
                  <div class="stat__value">${c.value}</div>
                  ${c.sub ? html`<div class="stat__sub">${c.sub}</div>` : null}`;
                return c.onClick
                  ? html`<button key=${c.label} type="button" class="stat stat--boton" style=${{ width: c.ancho || 100 }} onClick=${c.onClick}>${cuerpo}</button>`
                  : html`<div key=${c.label} class="stat" style=${{ width: c.ancho || 100 }}>${cuerpo}</div>`;
              })}
            </div>

            <div class="filters">
              <${Redondo} label="Restablecer filtros" tam=${50} onClick=${filtrosPorDefecto}><${Icon} name="sliders" size=${18} /><//>
              ${Object.entries(TIPOS).map(([k, t]) => html`
                <button key=${k} type="button" aria-pressed=${!!fTipo[k]} class=${"pill pill--sm " + (fTipo[k] ? "" : "pill--off")} onClick=${() => setFTipo({ ...fTipo, [k]: !fTipo[k] })}>${t.plural}</button>`)}
              <span class="filters__sep"></span>
              ${Object.entries(ESTADOS).map(([k, v]) => html`
                <button key=${k} type="button" aria-pressed=${!!fEstado[k]} class=${"pill pill--sm " + (fEstado[k] ? "" : "pill--off")} onClick=${() => setFEstado({ ...fEstado, [k]: !fEstado[k] })}>${v}</button>`)}
              <div class="filters__fin">
                <span>${igEstado === "ok" ? `Instagram ${hace(ig.actualizado)}` : igEstado === "error" ? "Instagram sin conexión" : "Cargando Instagram…"}</span>
                <${Redondo} label="Actualizar los datos de Instagram" tam=${44} clase=${igEstado === "actualizando" || igEstado === "cargando" ? "girando" : ""} disabled=${igEstado === "actualizando"} onClick=${() => cargarIg(true)}><${Icon} name="refresh" /><//>
              </div>
            </div>

            <div class="vista">
              ${vista === "semana" ? html`<${VistaSemana} cal=${cal} semana=${semana} piezas=${visibles} media=${media} an=${an} ahora=${ahora} onAbrir=${setFicha} onSemana=${setSemana} onHoy=${irHoy} onGenerar=${setGenerar} nubeF=${nubeF} onProgramarSemana=${() => setProgramarSemana(true)} />`
                : vista === "mes" ? html`<${VistaMes} cal=${cal} piezas=${visibles} media=${media} an=${an} ahora=${ahora} onAbrir=${setFicha} nubeF=${nubeF} />`
                : vista === "avisos" ? html`<${VistaAvisos} nube=${nube} onAbrir=${setFicha} />`
                : vista === "horas" ? html`<${VistaHoras} an=${an} igEstado=${igEstado} piezas=${cal.piezas} />`
                : vista === "publicado" ? html`<${VistaPublicado} ig=${ig} igEstado=${igEstado} piezas=${cal.piezas} fTipo=${fTipo} onAbrir=${setFicha} />`
                : html`<${VistaRepuesto} piezas=${visibles} onAbrir=${setFicha} />`}
            </div>

            <${BarraSemanas} cal=${cal} semana=${semana} vista=${vista}
              onSemana=${(n) => { setSemana(n); setVista("semana"); }} onMes=${() => setVista("mes")} onRepuesto=${() => setVista("repuesto")} />
          </div>
        </div>

        ${pieza ? html`<${Ficha} p=${pieza} ig=${ig} piezas=${cal.piezas} an=${an} ahora=${ahora} avisar=${avisar}
          onClose=${() => setFicha(null)} onGuardar=${(cambios, msg) => guardar(pieza.id, cambios, msg)} onGenerar=${(g) => setGenerar(g)}
          nube=${nube} nf=${nubeF[pieza.id]} onNube=${accionNube} />` : null}
        ${programarSemana ? html`<${ProgramarSemana} semana=${cal.semanas.find((w) => w.n === semana)} piezas=${cal.piezas.filter((p) => p.semana === semana)} filas=${nubeF}
          onCerrar=${() => setProgramarSemana(false)} onConfirmar=${async (ids) => { await accionNube("programar", ids); setProgramarSemana(false); }} />` : null}
        ${generar ? html`<${Generar} inicial=${generar.tipo ? generar : null} onClose=${() => setGenerar(null)} onHecho=${() => cargarCal()} />` : null}
        ${toast ? html`<div class=${"toast" + (toast.error ? " toast--error" : "")} role="status">${toast.texto}</div>` : null}
      </div>`;
  }

  window.PanelPublicaciones = PanelPublicaciones;
})();

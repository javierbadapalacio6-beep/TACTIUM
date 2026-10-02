// Componentes del panel. Todos reciben datos; ninguno sabe de cardiología ni
// de publicaciones. La adaptación se hace en `data.js`.
(function () {
  const html = htm.bind(React.createElement);
  const { useState } = React;

  const Round = ({ size = 52, dark, ring, label, onClick, children, style }) => html`
    <button type="button" aria-label=${label} onClick=${onClick}
      class=${"round " + (dark ? "round--dark " : "") + (ring ? "round--ring " : "")}
      style=${{ width: size, height: size, ...style }}>${children}</button>`;

  const Header = ({ title, tabs, onTab }) => html`
    <div class="header">
      <div class="header__notch"></div>
      <div class="header__tab">
        <${Round} size=${52} label="Cerrar"><${Icon} name="close" /><//>
        <div class="header__title">${title}</div>
      </div>
      <div class="header__tabs">
        ${tabs.map((t, i) => html`
          <button key=${i} type="button" class=${"pill " + (t.active ? "pill--on" : "")} onClick=${() => onTab(i)}>
            <${Icon} name=${t.icon} />${t.label}
          </button>`)}
      </div>
    </div>`;

  const Profile = ({ meta, name, avatar }) => html`
    <div class="profile">
      <div class="profile__avatar">
        ${avatar ? html`<img src=${avatar} alt="" />` : html`
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none"><circle cx="30" cy="22" r="12" fill="#d8cfc5"/><path d="M8 58c2-14 11-20 22-20s20 6 22 20" fill="#d8cfc5"/></svg>`}
      </div>
      <div><div class="profile__meta">${meta}</div><div class="profile__name">${name}</div></div>
    </div>`;

  const Stats = ({ stats }) => html`
    <div class="stats">
      ${stats.map((s, i) => html`
        <div key=${i} class="stat" style=${{ width: s.width || 100 }}>
          <div class="stat__label">${s.label}</div>
          <div class="stat__value">${s.value}${s.unit ? html` <span class="stat__unit">${s.unit}</span>` : null}</div>
        </div>`)}
    </div>`;

  const Filters = ({ filters, onToggle }) => html`
    <div class="filters">
      <${Round} size=${50} label="Filtros"><${Icon} name="sliders" size=${18} /><//>
      ${filters.map((f, i) => html`
        <button key=${i} type="button" class=${"pill pill--sm " + (f.on ? "" : "pill--off")} onClick=${() => onToggle(i)}>${f.label}</button>`)}
    </div>`;

  const Chip = ({ icon, label, count }) => html`
    <div class="chip"><span class="chip__icon"><${Icon} name=${icon} /></span><span class="chip__label">${label}</span><span class="chip__count">${count}</span></div>`;

  const CardHead = ({ title }) => html`
    <div class="card__head"><div class="card__title">${title}</div><${Round} ring size=${36} label="Comparar"><${Icon} name="scale" size=${14} /><//></div>`;

  const ChartCard = (c) => html`
    <div class="card">
      <${CardHead} title=${c.title} />
      <div class="chart">
        <div class="chart__day" style=${{ left: c.dayX }}>${c.day}</div>
        <svg width="226" height="62" viewBox="0 0 226 62" style=${{ position: "absolute", left: 0, top: 0 }} aria-hidden="true">
          <path d=${c.band} fill="var(--band)" />
          <path d=${c.area} fill="var(--accent)" />
          <path d=${c.cursor || `M${c.cursorX} 4v56`} stroke="var(--ink)" stroke-width="1" />
        </svg>
        <div class="chart__tag" style=${{ left: c.tagX }}>${c.tag}<small>${c.tagSmall}</small></div>
      </div>
      <div class="card__foot">
        <div>Average: <b>${c.avg}</b> <span style=${{ fontSize: 10 }}>${c.avgSmall}</span></div>
        <div class=${"card__delta card__delta--" + c.dir}>${c.delta} <i>${c.dir === "up" ? "▲" : "▼"}</i></div>
      </div>
    </div>`;

  const TagsCard = (c) => html`
    <div class="card" style=${{ borderRadius: "30px 30px 0 0", minHeight: 150 }}>
      <${CardHead} title=${c.title} />
      <div class="tags">
        <div style=${{ display: "flex", gap: 8, flexWrap: "wrap" }}>${c.tags.map((t) => html`<span key=${t} class="tag">${t}</span>`)}</div>
        ${c.figure ? html`<svg width="70" height="90" viewBox="0 0 70 90" fill="none" aria-hidden="true"><circle cx="35" cy="12" r="9" fill="#f0c8a0"/><path d="M20 30c8-8 22-8 30 0l4 30H16z" fill="#e8b48a"/><path d="M22 60h26l-3 28H25z" fill="#9fc6a3"/><circle cx="35" cy="12" r="9" fill="none" stroke="#ff7a45" stroke-width="2"/><circle cx="46" cy="42" r="6" fill="#ff5a3c" opacity=".7"/><circle cx="26" cy="58" r="5" fill="#3fd77a" opacity=".7"/></svg>` : null}
      </div>
    </div>`;

  const EcgCard = (c) => html`
    <div class="card" style=${{ borderRadius: "30px 30px 0 0", minHeight: 150 }}>
      <${CardHead} title=${c.title} />
      <svg width="226" height="50" viewBox="0 0 226 50" fill="none" aria-hidden="true">
        <path d="M0 30h20l6-10 6 20 8-38 8 46 6-18h30l6-10 6 20 8-38 8 46 6-18h30l6-10 6 20 8-38 8 46 6-18h30" stroke="var(--ink)" stroke-width="1.3"/>
        <path d="M0 34h226" stroke="#ff7a45" stroke-width="1" stroke-dasharray="2 3"/>
      </svg>
    </div>`;

  const CARD = { chart: ChartCard, tags: TagsCard, ecg: EcgCard };

  // Un grupo de la línea de tiempo: hito, eje, chips a la izquierda, tarjetas a la derecha
  // y los «cables» que los unen, dibujados en SVG relativo al grupo.
  const Group = ({ g }) => html`
    <div class="group" style=${{ left: g.x }}>
      <svg class="group__wires" width="520" height="520" viewBox="0 0 520 520" aria-hidden="true">
        <path d="M0 14 c0 0 100 0 100 40 v100" stroke="var(--dark)" stroke-width="1.2" fill="none"/>
        ${g.chips.map((_, i) => html`<path key=${i} d=${`M${(g.chipW || 180)} ${160 + i * 62} c40 0 40 ${20 - i * 30} ${(g.cardsX || 230) - (g.chipW || 180) - 50} ${20 - i * 30}`} stroke="var(--dark)" stroke-width="1.2" fill="none"/>`)}
        <path d=${`M100 154 v120 c0 40 40 40 80 40 h${(g.cardsX || 230) - 180}`} stroke="var(--dark)" stroke-width="1.2" fill="none"/>
      </svg>
      <div class="group__axis"></div>
      <div class="group__mark"><${Icon} name=${g.markIcon} size=${18} /></div>
      <div class="group__title">${g.label}<small>${g.sub}</small></div>
      <div class="group__chips">${g.chips.map((c, i) => html`<${Chip} key=${i} ...${c} />`)}</div>
      <div class="group__nav">
        <button type="button" aria-label="Semana anterior"><${Icon} name="up" size=${12} /></button>
        <button type="button" aria-label="Semana siguiente"><${Icon} name="down" size=${12} /></button>
      </div>
      ${g.sub2 ? html`<div class="group__sub">${g.sub2}</div>` : null}
      <div class="group__cards" style=${{ left: g.cardsX || 230 }}>${g.cards.map((c, i) => { const C = CARD[c.type]; return html`<${C} key=${i} ...${c} />`; })}</div>
    </div>`;

  const Timeline = ({ groups, onAdd }) => html`
    <div class="timeline">
      <div class="timeline__line"></div>
      ${groups.map((g, i) => html`<${Group} key=${i} g=${g} />`)}
      <${Round} size=${52} dark label="Añadir" onClick=${onAdd} style=${{ position: "absolute", right: 44, top: -12, fontSize: 26, fontWeight: 300 }}>+<//>
    </div>`;

  // Un elemento de la barra: texto de mes, puntos suspensivos o icono con contador.
  const CalItem = ({ it }) => typeof it === "string"
    ? (it === "···" ? html`<span class="calbar__dots">···</span>` : html`<span>${it}</span>`)
    : html`<span class="calbar__ic"><${Icon} name=${it.icon} size=${12} />${it.badge ? html`<span class="calbar__badge">${it.badge}</span>` : null}</span>`;

  const CalendarBar = ({ start, items, now }) => html`
    <div class="calbar">
      <${Round} size=${40} dark label="Calendario"><${Icon} name="calendar" /><//>
      <div class="calbar__month"><span>${start.month}</span><b>${start.year}</b></div>
      <div class="calbar__items">${items.map((it, i) => html`<${CalItem} key=${i} it=${it} />`)}</div>
      <div class="calbar__now">${now.map((it, i) => html`<${CalItem} key=${i} it=${it} />`)}</div>
    </div>`;

  Object.assign(window, { html, Header, Profile, Stats, Filters, Timeline, CalendarBar });
})();

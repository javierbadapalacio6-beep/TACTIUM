// Iconos de trazo, por nombre. Se dibujan inline para heredar el color del texto.
(function () {
  const P = (d, extra = "") => `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
  window.ICONS = {
    close: P('<path d="M3 3l10 10M13 3L3 13"/>'),
    search: P('<circle cx="6.5" cy="6.5" r="4.5"/><path d="M10 10l4 4"/>'),
    visit: P('<rect x="3" y="2" width="10" height="12" rx="2"/><path d="M6 6h4M6 9h4"/>'),
    pill: P('<rect x="1.5" y="6" width="13" height="5" rx="2.5" transform="rotate(-40 8 8)"/><path d="M6 5l3.5 5"/>'),
    lab: P('<path d="M6 2h4M7 2v5l-4 6.5A1 1 0 0 0 4 15h8a1 1 0 0 0 1-1.5L9 7V2"/>'),
    allergy: P('<circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3"/>'),
    dna: P('<path d="M4 2c0 4 8 4 8 8M12 2c0 4-8 4-8 8M4 14c0-2 2-3 4-3M12 14c0-2-2-3-4-3"/>'),
    sliders: P('<path d="M4 2v12M8 2v12M12 2v12"/><circle cx="4" cy="6" r="1.8" fill="#fff"/><circle cx="8" cy="10" r="1.8" fill="#fff"/><circle cx="12" cy="7" r="1.8" fill="#fff"/>'),
    scale: P('<path d="M8 2v12M3 5h10M3 5l-2 5h4zM13 5l-2 5h4z"/>'),
    calendar: P('<rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 7h12M5 1.5v3M11 1.5v3"/>'),
    up: P('<path d="M3 10l5-5 5 5"/>'),
    down: P('<path d="M3 6l5 5 5-5"/>'),
    plus: P('<path d="M8 3v10M3 8h10"/>'),
    home: P('<path d="M2.5 7.5L8 3l5.5 4.5V13a1 1 0 0 1-1 1h-3v-3.5h-3V14h-3a1 1 0 0 1-1-1z"/>'),
    list: P('<path d="M5.5 4h8M5.5 8h8M5.5 12h8"/><circle cx="2.5" cy="4" r=".6" fill="currentColor"/><circle cx="2.5" cy="8" r=".6" fill="currentColor"/><circle cx="2.5" cy="12" r=".6" fill="currentColor"/>'),
    clock: P('<circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/>'),
    check: P('<path d="M3 8.5l3 3 7-7"/>'),
    stack: P('<rect x="3" y="6" width="10" height="8" rx="1.5"/><path d="M4.5 4h7M6 2h4"/>'),
    refresh: P('<path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v3h-3"/>'),
    left: P('<path d="M10 3L5 8l5 5"/>'),
    right: P('<path d="M6 3l5 5-5 5"/>'),
    copy: P('<rect x="5" y="5" width="8.5" height="8.5" rx="1.5"/><path d="M3 10.5V3.5A1 1 0 0 1 4 2.5h7"/>'),
    link: P('<path d="M6.5 9.5l3-3M7 4.5l1.2-1.2a2.6 2.6 0 0 1 3.7 3.7L10.7 8.2M9 11.5l-1.2 1.2a2.6 2.6 0 0 1-3.7-3.7L5.3 7.8"/>'),
    external: P('<path d="M9 2.5h4.5V7M13.5 2.5L7.5 8.5M12 9.5V13a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5H7"/>'),
    alert: P('<path d="M8 2l6.5 11.5h-13z"/><path d="M8 6.5v3M8 11.5v.2"/>'),
    download: P('<path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10"/>'),
    cloud: P('<path d="M4.5 12.5h7.2a2.8 2.8 0 0 0 .3-5.6 4 4 0 0 0-7.7-1A3.4 3.4 0 0 0 4.5 12.5z"/>'),
    send: P('<path d="M14 2L7 9M14 2l-4.5 12-2.5-5-5-2.5z"/>'),
    bell: P('<path d="M4 11V7.5a4 4 0 0 1 8 0V11l1.2 1.5H2.8zM6.5 14h3"/>'),
    trash: P('<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9"/>'),
    // Para el panel de publicaciones
    reel: P('<rect x="2" y="2" width="12" height="12" rx="3"/><path d="M2 6h12M6 2l2 4M10 2l2 4M7 9l3 1.5L7 12z"/>'),
    carousel: P('<rect x="4" y="3" width="8" height="10" rx="2"/><path d="M1.5 5v6M14.5 5v6"/>'),
    story: P('<circle cx="8" cy="8" r="6" stroke-dasharray="3 2"/><circle cx="8" cy="8" r="3"/>'),
    post: P('<rect x="2" y="2" width="12" height="12" rx="3"/><circle cx="6" cy="6" r="1.2"/><path d="M14 11l-3.5-3.5L4 14"/>'),
    video: P('<rect x="2" y="4" width="9" height="8" rx="2"/><path d="M11 7l3-2v6l-3-2z"/>'),
  };
  window.Icon = ({ name, size = 16 }) =>
    React.createElement("span", {
      style: { display: "inline-flex", width: size, height: size },
      dangerouslySetInnerHTML: { __html: (window.ICONS[name] || "").replace(/width="16" height="16"/, `width="${size}" height="${size}"`) },
    });
})();

// Arranque del panel.
//   /                → panel de publicaciones de @tactium.io (publicaciones.js)
//   /?datos=demo     → el diseño de referencia (cardiología) con datos de muestra
(function () {
  const { useState } = React;

  function Demo() {
    const [data, setData] = useState(window.DATA);
    const onTab = (i) => setData({ ...data, tabs: data.tabs.map((t, j) => ({ ...t, active: j === i })) });
    const onToggle = (i) => setData({ ...data, filters: data.filters.map((f, j) => (j === i ? { ...f, on: !f.on } : f)) });
    return html`
      <div class="page">
        <div class="shell">
          <div class="panel">
            <${Header} title=${data.title} tabs=${data.tabs} onTab=${onTab} />
            <${Profile} ...${data.profile} />
            <${Stats} stats=${data.stats} />
            <${Filters} filters=${data.filters} onToggle=${onToggle} />
            <${Timeline} groups=${data.timeline} onAdd=${() => (location.href = "/")} />
            <div class="peek" style=${{ top: 606, height: 150 }}></div>
            <div class="peek" style=${{ top: 776, height: 60 }}></div>
            <${CalendarBar} ...${data.calendar} />
          </div>
        </div>
      </div>`;
  }

  const esDemo = new URLSearchParams(location.search).get("datos") === "demo";
  document.title = esDemo ? "Panel · diseño de referencia" : "Contenido · @tactium.io";
  ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(esDemo ? Demo : window.PanelPublicaciones));
})();

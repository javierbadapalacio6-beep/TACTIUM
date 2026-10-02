// Datos del panel. Es lo ÚNICO que cambia para llevar el mismo diseño a otro
// dominio: hoy es la muestra clínica del diseño de referencia; para el panel
// de publicaciones se sustituye por semanas, piezas (reels, carruseles,
// stories, posts) y métricas de la cuenta. Ver `data-publicaciones.js`.
window.DATA = {
  title: "Cardiology",
  tabs: [
    { icon: "search", label: "Treatment Dynamics", active: true },
    { icon: "visit", label: "Visits" },
    { icon: "pill", label: "Medications" },
    { icon: "lab", label: "Labs" },
    { icon: "allergy", label: "Allergies" },
    { icon: "dna", label: "Genetics" },
  ],
  profile: { meta: "Female, 24", name: "Tiffany\nWoodward", avatar: null },
  stats: [
    { label: "Diagnosys", value: "Hypertension", width: 170 },
    { label: "Heart Rate", value: "89", unit: "bpm" },
    { label: "Pressure", value: "100", unit: "/ 67" },
    { label: "Oxygen", value: "98", unit: "%" },
    { label: "Temperature", value: "36.8", unit: "°C" },
  ],
  filters: [
    { label: "Office Visits", on: true },
    { label: "Medications", on: true },
    { label: "Labs", on: true },
    { label: "Procedures" },
    { label: "Hospitalizations" },
    { label: "Imaging" },
  ],
  timeline: [
    {
      x: 150, label: "Aug", sub: "I Week", sub2: "II Week", markIcon: "visit",
      chips: [{ icon: "pill", label: "Aspirin", count: "x2" }],
      cards: [
        {
          type: "chart", title: "Blood Pressure", day: "Friday", dayX: 150, tagX: 112,
          tag: "180", tagSmall: "/ 110", cursorX: 148,
          band: "M0 40 C30 24 50 30 80 34 S130 50 160 40 S200 26 226 34 V62 H0Z",
          area: "M0 26 C30 10 50 18 80 22 S130 36 160 24 S200 10 226 18 V40 C200 30 180 44 160 44 S110 44 80 36 S40 30 0 40Z",
          avg: "160", avgSmall: "/ 110", delta: "+10", dir: "up",
        },
        { type: "tags", title: "Symptoms", tags: ["Headache"], figure: true },
      ],
    },
    {
      x: 640, label: "Sep", sub: "I Week", markIcon: "visit",
      chips: [{ icon: "pill", label: "bisoprolol", count: "x3" }, { icon: "pill", label: "Aspirin", count: "x2" }],
      cards: [
        {
          type: "chart", title: "Blood Pressure", day: "Thursday", dayX: 122, tagX: 92,
          tag: "135", tagSmall: "/ 92", cursorX: 128,
          band: "M0 38 C30 28 50 34 80 30 S130 44 160 38 S200 30 226 36 V62 H0Z",
          area: "M0 24 C30 14 50 22 80 18 S130 32 160 26 S200 16 226 22 V36 C200 30 180 40 160 40 S110 42 80 32 S40 34 0 38Z",
          avg: "130", avgSmall: "/ 90", delta: "-20", dir: "down",
        },
        { type: "ecg", title: "ECG" },
      ],
    },
  ],
  calendar: {
    start: { month: "Jan", year: "2022" },
    items: [
      { icon: "visit" }, { icon: "pill", badge: 6 }, "···", "Feb", { icon: "lab" }, "Mar", "···", "Apr",
      { icon: "visit" }, { icon: "pill", badge: 2 }, { icon: "lab", badge: 3 }, "···", "May", { icon: "visit" },
      "Jun", { icon: "visit" }, { icon: "lab" }, "···", "Jul", { icon: "visit" }, { icon: "pill", badge: 6 }, { icon: "lab" },
    ],
    now: ["Aug", { icon: "visit" }, { icon: "pill" }, { icon: "lab", badge: 4 }, "Sep", { icon: "visit" }, { icon: "pill", badge: 2 }, { icon: "lab", badge: 6 }],
  },
};

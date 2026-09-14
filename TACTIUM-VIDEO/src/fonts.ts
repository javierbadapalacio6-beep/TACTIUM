import { continueRender, delayRender, staticFile } from "remotion";

const faces: Array<[string, string, string]> = [
  ["Satoshi", "fonts/satoshi-400.woff2", "400"],
  ["Satoshi", "fonts/satoshi-500.woff2", "500"],
  ["Satoshi", "fonts/satoshi-700.woff2", "700"],
  ["Satoshi", "fonts/satoshi-900.woff2", "900"],
  ["JetBrains Mono", "fonts/jbmono-400.woff2", "400"],
  ["JetBrains Mono", "fonts/jbmono-500.woff2", "500"],
  ["JetBrains Mono", "fonts/jbmono-700.woff2", "700"],
];

const handle = delayRender("fonts");

Promise.all(
  faces.map(([family, file, weight]) => {
    const font = new FontFace(family, `url(${staticFile(file)})`, { weight });
    // `document.fonts` se tipa como FontFaceSet sin `add` en la lib DOM de este
    // TS; en el navegador existe. Cast mínimo en vez de ampliar la lib entera.
    return font.load().then((f) => (document.fonts as unknown as Set<FontFace>).add(f));
  }),
)
  .then(() => continueRender(handle))
  .catch((err) => {
    // Sin fuente vendida el render sigue con el fallback del stack.
    console.error(err);
    continueRender(handle);
  });

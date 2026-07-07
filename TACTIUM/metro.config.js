// Default Metro config para proyectos Expo SDK 54+. Extender desde
// `expo/metro-config` deja que Expo Router, asset registry, SVG, etc.
// se configuren automáticamente. Si en el futuro necesitamos custom
// (ej. añadir extensiones, transformer), exportar config modificada.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;

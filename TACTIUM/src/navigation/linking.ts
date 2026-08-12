import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';

import type { RootStackParamList } from './types';

// Deep linking (esquema propio `tactium://` + dominio para los futuros
// Universal Links). El esquema ya está declarado en app.json, así que los
// enlaces `tactium://…` funcionan SIN build nativo → esto se publica por OTA.
// Los prefijos `https://tactium.io` quedan preparados para cuando el dominio
// sirva `apple-app-site-association`/`assetlinks.json` (eso sí necesita build).
//
// Caso principal — VOLVER A LA APP TRAS PAGAR un torneo: el pago se hace en la
// web (Stripe) y el `success_url` vuelve a `tactium://tournament/{id}?paid=1`,
// que aterriza en la ficha del torneo (ya publicado). Se usa la vista pública
// `TournamentFollow` a propósito: existe en el árbol de navegación CON y SIN
// sesión y lee de RPCs públicas, así que resuelve sea cual sea el rol de quien
// paga (club o capitán) y sin depender de que la pestaña Torneos esté montada.
//
// Nota OAuth: el login con Google usa `WebBrowser.openAuthSessionAsync`, que
// captura el redirect `tactium://auth-callback` ANTES de que llegue al sistema,
// así que no pasa por aquí. Y aunque llegara, `auth-callback` no casa con
// ninguna ruta y React Navigation lo ignora sin romper nada.
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    // Prefijo del esquema resuelto por Expo (tactium:// en build, exp:// en dev).
    Linking.createURL('/'),
    'tactium://',
    'https://tactium.io',
    'https://www.tactium.io',
  ],
  config: {
    screens: {
      // Ficha pública del torneo. `?paid=1` (vuelta del pago), `?initialTab=…`
      // y demás query params se inyectan como params de la ruta.
      TournamentFollow: 'tournament/:tournamentId',
      // Explorar torneos abiertos.
      ExploreTournaments: 'tournaments',
    },
  },
};

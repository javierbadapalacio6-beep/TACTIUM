# Paridad web ↔ app · auditoría 2026-09-19

Repaso de qué sabe hacer la app (`TACTIUM/src`) y no sabe hacer la web
(`tactium-web`), pantalla por pantalla y acción por acción.

## Método (para repetirlo)

No se comparan pantallas ni botones, que engañan: se compara la **superficie
funcional real**, o sea todas las llamadas a RPC y todas las escrituras a
tablas de cada lado. Una capacidad que no aparece ahí, no existe.

```bash
# RPCs de cada lado (ojo: hay llamadas partidas en varias líneas)
grep -rzoE "\.rpc\(\s*['\"][a-z0-9_]+['\"]" TACTIUM/src tactium-web

# Tablas que escribe cada lado
grep -rzoE "from\(\s*['\"][a-z0-9_]+['\"]\s*\)[^;]{0,260}\.(insert|update|delete|upsert)\(" .
```

Recuento: la app usa **21 RPCs**, la web **23**. De las de la app, **14 no
existen en la web**. La app escribe 13 tablas; 4 de ellas la web no las toca
(`lineup_variants`, `profiles`, `team_invitations`, `team_members`).

---

## 1. Roto, no ausente — arréglese primero

**Borrar cuenta (web · Ajustes → Zona de peligro).** La pantalla está entera:
diálogo de dos pasos, aviso de lo que se pierde, confirmación escribiendo el
correo. Y al confirmar **no hace nada**: cierra la ventana y ya.

```ts
// components/settings/ZonaPeligro.tsx:38
if (!emailOk) return;
// Aquí irá la llamada al RPC `delete_my_account`.
setOpen(false);
```

Esto es peor que no tenerlo. El usuario cree que ha borrado su cuenta y sus
datos siguen ahí — con el agravante de que es un derecho que el RGPD obliga a
atender. La app sí llama a `delete_my_account`.

---

## 2. Huecos por área

### Cuenta y datos personales
| Falta en la web | Cómo lo hace la app |
|---|---|
| Editar el perfil: nombre, nombre de usuario | escribe en `profiles` |
| Subir, cambiar o quitar el avatar | `services/avatar.ts` + Storage |
| Exportar mis datos (RGPD) | RPC `export_my_data` |

La web tiene un botón "exportar" en Mis datos, pero **solo vuelca los cuatro
campos que se ven en pantalla**, no el volcado completo. No cumple lo mismo.

### Equipo
| Falta en la web | Cómo lo hace la app |
|---|---|
| Borrar equipo | RPC `delete_team` |
| Desvincular a un jugador de su ficha | RPC `captain_unclaim_player` |
| Cubrir un equipo con la suscripción del club | RPC `cover_team` |

Lo demás del equipo sí está: editar plantilla, quitar jugador, invitaciones
(`create_team_invitation`), escanear ranking, editar equipo.

### Alineación
| Falta en la web | Cómo lo hace la app |
|---|---|
| Fijar qué variante es la oficial | RPC `set_active_lineup_variant` |
| Clonar las parejas de una variante a otra | RPC `clone_lineup_variant_pairs` |
| Compartir la alineación como tarjeta | `LineupShareCard` |

La web **lee** las variantes y marca cuál está activa, pero no puede cambiarla:
se pueden preparar alternativas y no elegir ninguna.

### Jornada
| Falta en la web | Cómo lo hace la app |
|---|---|
| Eliminar una jornada | — |
| Compartir el resultado | `PhotoShareCard` |

Cerrar acta, avisar al equipo y la foto del partido sí están.

### Club
| Falta en la web | Cómo lo hace la app |
|---|---|
| Borrar club | RPC `delete_club` |
| Renumerar las jornadas de la temporada | RPC `renumber_season_matchdays` |
| **Cambiar de club activo** | selector en la app |

Lo del club activo no es una funcionalidad que falte, es un **bug**:

```ts
// lib/session.tsx:159
const myClub = clubRes.data?.[0]?.club_id ?? null;
```

Se coge el primer club de `club_members` sin ordenar y no hay selector en
ninguna parte. Con dos clubes solo puedes gestionar uno, y cuál te toca es
arbitrario. Verificado en producción el 19-09: bloqueó por completo poder
conectar Stripe al segundo club.

### Torneos
El detalle de torneo es la pantalla más desigual: ~60 acciones en la app frente
a ~23 en la web. La web cubre lo troncal (inscripciones, grupos, clasificación,
cuadro, horario, configuración, cuota, condiciones, portada, siembra, alta
manual, marcar pagos, rejilla de horario). Falta:

- Mover una inscripción de categoría
- Agrupar categorías en bloque
- Reenviar por correo el enlace de pago
- Días de cada fase (`tournament_phase_days`)
- Limpiar el horario generado
- Borrar el torneo

### Suscripción
| Falta en la web | Cómo lo hace la app |
|---|---|
| Cambio de plan programado | RPC `set_scheduled_plan_change` |

La web enlaza a `/pro` para cambiar de plan; la app muestra de forma persistente
"pasarás a X el [fecha]".

### Compartir (transversal)
La app tiene tres tarjetas para compartir (`PhotoShareCard`,
`LineupShareCard`, más el share de código de torneo) usadas en cinco pantallas.
**En la web no hay ninguna.** Es toda la capa social de salida del producto.

### Federación
Aparentemente cubierta, y en algunas cosas la web va por delante: lee
`fcp_actas`, `fcp_historico`, `fcp_ligas`, `fcp_partidos`, `fcp_rankings` y
`fcp_team_links` directamente. Pendiente de mirar con lupa: el **cuadro de
playoff** y los filtros del explorador (la app tiene "en juego", "play off",
"restablecer filtros").

---

## 3. Solo en la app, y está bien así

- `start_subscription_trial` — en web la prueba la abre Stripe Checkout.
- `sync_subscription_from_revenuecat` — específico de las tiendas.
- `link_subscription_to_club` — reconciliación de compras restauradas (IAP).

## 4. Solo en la web, y está bien así

Capa pública que la app no necesita: `explore_tournaments`,
`public_get_tournament`, `tournament_lookup`, `tournament_signup*`,
`claim_partner_by_code`, `my_tournaments`, `import_fcp_roster`,
`get_club_home_schedule`, `search_community`, `social_feed`.

---

## Orden sugerido

1. **Borrar cuenta** — está mintiendo al usuario, y es obligación legal.
2. **Selector de club** — bloquea a cualquier gestor con más de un club.
3. **Editar perfil y avatar** — es lo primero que intenta todo el mundo.
4. **Exportar datos completo** — mismo motivo legal que el punto 1.
5. Borrar equipo / club / jornada / torneo — destructivas, hoy solo en móvil.
6. Variante activa de alineación — la funcionalidad está a medias.
7. Compartir — es crecimiento, no mantenimiento; va aparte.

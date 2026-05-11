# TACTIUM — React Native App

App móvil construida con Expo + TypeScript, React Navigation y Zustand.

## 🚀 Arrancar el proyecto

```bash
# 1. Instalar dependencias
cd TACTIUM
npm install

# 2. Iniciar Expo
npx expo start

# 3. Abrir en simulador iOS (necesitas Xcode en Mac)
#    Pulsa 'i' en la terminal

# 4. O escanea el QR con la app Expo Go en tu móvil
```

## 📁 Estructura

```
TACTIUM/
├── App.tsx                  # Entry point
├── src/
│   ├── core/
│   │   ├── theme/           # Colors, Typography, Spacing
│   │   ├── hooks/           # Custom hooks
│   │   └── utils/           # Helpers
│   ├── features/
│   │   ├── home/
│   │   │   ├── screens/     # HomeScreen
│   │   │   └── components/
│   │   └── profile/
│   │       ├── screens/     # ProfileScreen
│   │       └── components/
│   ├── navigation/
│   │   ├── RootNavigator.tsx
│   │   ├── TabNavigator.tsx
│   │   └── types.ts
│   ├── components/
│   │   └── ui/              # Button, etc.
│   └── store/
│       ├── appStore.ts      # Zustand: UI state
│       └── authStore.ts     # Zustand: Auth state
```

## 🧱 Stack

| Librería | Versión | Uso |
|---|---|---|
| Expo | ~52 | Framework base |
| TypeScript | ^5.3 | Tipado estático |
| React Navigation | ^6 | Navegación |
| Zustand | ^5 | Estado global |

## 📱 Pantallas incluidas

- **Home** — Pantalla principal con saludo y bienvenida
- **Profile** — Perfil de usuario con opciones y logout

## ✨ Añadir nueva feature

1. Crear carpeta en `src/features/miFeature/`
2. Añadir `screens/` y `components/`
3. Registrar la pantalla en `src/navigation/types.ts`
4. Añadir al navigator correspondiente

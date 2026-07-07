// Declaraciones mínimas para dependencias cuyo paquete puede no estar
// instalado en el entorno de CI/typecheck. Se pueden retirar cuando
// node_modules esté garantizado en todos los entornos.

declare module 'react-native-view-shot' {
  export function captureRef(
    ref: unknown,
    options?: {
      format?: 'png' | 'jpg' | 'webm' | 'raw';
      quality?: number;
      result?: 'tmpfile' | 'base64' | 'data-uri';
      width?: number;
      height?: number;
    },
  ): Promise<string>;
}

declare module 'react-native-qrcode-svg' {
  import type { ComponentType } from 'react';

  const QRCode: ComponentType<{
    value: string;
    size?: number;
    color?: string;
    backgroundColor?: string;
    quietZone?: number;
  }>;
  export default QRCode;
}

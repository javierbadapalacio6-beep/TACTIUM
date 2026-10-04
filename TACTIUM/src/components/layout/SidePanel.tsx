import React from 'react';

import { BottomSheet } from '@components/ui/BottomSheet';
import { useLayout } from '@components/ui/ResponsiveFrame';
import { PanelModal } from './PanelModal';

export interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Título de la cabecera (en tablet). */
  title?: string;
  /** CTA fija abajo, fuera del scroll. */
  footer?: React.ReactNode;
  scrollable?: boolean;
  /** Ancho en tablet (por defecto 420). */
  width?: number;
}

/**
 * Panel a la DERECHA de 420 px (fondo, scrim, cerrar con la X o tocando
 * fuera, entrada deslizando). Sustituye en tablet a las hojas de ficha y
 * de «Plantilla ▾». En MÓVIL cae a la BottomSheet de siempre, así que la
 * pantalla puede usarlo sin preguntar el modo.
 *
 *   <SidePanel open={!!player} onClose={() => setPlayer(null)} title="Ficha">
 *     <PlayerCard player={player} />
 *   </SidePanel>
 */
export const SidePanel: React.FC<SidePanelProps> = ({
  open,
  onClose,
  children,
  title,
  footer,
  scrollable = true,
  width,
}) => {
  const { isTablet } = useLayout();
  if (!isTablet) {
    return (
      <BottomSheet open={open} onClose={onClose} footer={footer} scrollable={scrollable}>
        {children}
      </BottomSheet>
    );
  }
  return (
    <PanelModal
      open={open}
      onClose={onClose}
      variant="side"
      title={title}
      footer={footer}
      scrollable={scrollable}
      width={width}
    >
      {children}
    </PanelModal>
  );
};

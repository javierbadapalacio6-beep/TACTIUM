"use client";

import { useCallback, useEffect, useState } from "react";

import { IconBell, IconCheck, IconTrash } from "@/components/Icon";
import { Btn, Card, CardHead, PageHeader } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import {
  deleteAllNotifications,
  deleteNotification,
  fetchNotifications,
  markNotificationRead,
  markNotificationsRead,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { WRITES_ENABLED } from "@/lib/writes";

import { NoticeList, type Notice } from "./NoticeList";
import { announceNoticesChanged, asRead, toNotice } from "./notices";

const PAGE = 20;

/**
 * `/avisos`: la campana entera, con paginación. Misma lista que el
 * desplegable (agrupada por día, botones en línea); aquí se pueden ver los
 * antiguos. Cada cambio avisa a la campana para que vuelva a contar.
 */
export function NoticesPage() {
  const { user } = useSession();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirst = useCallback(async () => {
    setError(null);
    try {
      const rows = await fetchNotifications({ offset: 0, limit: PAGE });
      setNotices(rows.map(toNotice));
      setMore(rows.length === PAGE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los avisos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadFirst();
  }, [user, loadFirst]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const rows = await fetchNotifications({ offset: notices.length, limit: PAGE });
      setNotices((ns) => {
        const seen = new Set(ns.map((n) => n.id));
        return [...ns, ...rows.map(toNotice).filter((n) => !seen.has(n.id))];
      });
      setMore(rows.length === PAGE);
    } catch {
      /* el botón sigue ahí para reintentar */
    } finally {
      setLoadingMore(false);
    }
  }

  function marcarLeidos(ids: string[]) {
    setNotices((ns) => ns.map((n) => (ids.includes(n.id) ? asRead(n) : n)));
    if (!WRITES_ENABLED) return;
    Promise.all(ids.map((id) => markNotificationRead(id)))
      .catch(() => {})
      .finally(announceNoticesChanged);
  }

  function marcarTodas() {
    setNotices((ns) => ns.map(asRead));
    if (!WRITES_ENABLED) return;
    markNotificationsRead().catch(() => {}).finally(announceNoticesChanged);
  }

  function borrar(ids: string[]) {
    setNotices((ns) => ns.filter((n) => !ids.includes(n.id)));
    if (!WRITES_ENABLED) return;
    Promise.all(ids.map((id) => deleteNotification(id)))
      .catch(() => {})
      .finally(announceNoticesChanged);
  }

  function vaciar() {
    setNotices([]);
    setMore(false);
    if (!WRITES_ENABLED) return;
    deleteAllNotifications().catch(() => {}).finally(announceNoticesChanged);
  }

  const unread = notices.filter((n) => n.unread).length;

  return (
    <div className="tw-page-narrow">
      <PageHeader
        title="Avisos"
        lede="Convocatorias, alineaciones, torneos y gente que te sigue."
        actions={
          notices.length > 0 ? (
            <>
              {unread > 0 && (
                <Btn size="sm" icon={<IconCheck size={15} />} onClick={marcarTodas}>
                  Marcar leídos
                </Btn>
              )}
              <Btn size="sm" variant="danger-ghost" icon={<IconTrash size={15} />} onClick={vaciar}>
                Vaciar
              </Btn>
            </>
          ) : undefined
        }
      />

      {loading ? (
        <SkeletonCard />
      ) : error ? (
        <Card>
          <EmptyState
            icon={<IconBell size={22} />}
            title="No se pudieron cargar los avisos"
            body={error}
            action={
              <Btn size="sm" onClick={() => void loadFirst()}>
                Reintentar
              </Btn>
            }
          />
        </Card>
      ) : notices.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconBell size={22} />}
            title="Estás al día"
            body="Cuando tu capitán publique una alineación, te convoquen o alguien te siga, lo verás aquí."
          />
        </Card>
      ) : (
        <Card flush>
          <CardHead title="Todos" count={unread > 0 ? `${unread} sin leer` : undefined} />
          <NoticeList
            notices={notices}
            onNavigate={() => {}}
            onDelete={borrar}
            onRead={marcarLeidos}
          />
          {more && (
            <div style={{ padding: 12, borderTop: "1px solid var(--line)", textAlign: "center" }}>
              <Btn size="sm" variant="quiet" disabled={loadingMore} onClick={() => void loadMore()}>
                {loadingMore ? "Cargando…" : "Ver más antiguos"}
              </Btn>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'
import {
  ensureZeloPushSubscription,
  sendZeloPushTest,
  type ZeloPushPermission,
} from '../lib/push'

type ZeloNotification = {
  id: string
  empresa_id: string
  user_id: string
  ordem_id: string | null
  tipo: string
  titulo: string
  mensagem: string
  dados: Record<string, unknown>
  lida_em: string | null
  created_at: string
}

const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function NotificationCenter({
  companyId,
  userId,
  onOpenOrder,
}: {
  companyId: string
  userId: string
  onOpenOrder?: (orderId: string) => void
}) {
  const [items, setItems] = useState<ZeloNotification[]>([])
  const [open, setOpen] = useState(false)
  const [permission, setPermission] = useState<ZeloPushPermission>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )
  const [pushActive, setPushActive] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [testSent, setTestSent] = useState(false)
  const [error, setError] = useState('')

  const unread = useMemo(() => items.filter(item => !item.lida_em).length, [items])

  const load = useCallback(async () => {
    const { data, error: dbError } = await supabase
      .from('notificacoes')
      .select('id,empresa_id,user_id,ordem_id,tipo,titulo,mensagem,dados,lida_em,created_at')
      .eq('empresa_id', companyId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (dbError) {
      setError(dbError.message)
      return
    }

    setItems((data ?? []) as ZeloNotification[])
  }, [companyId, userId])

  useEffect(() => {
    void load()

    const channel = supabase
      .channel(`zelo-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'nethanel_os',
          table: 'notificacoes',
          filter: `user_id=eq.${userId}`,
        },
        payload => {
          const item = payload.new as ZeloNotification
          if (item.empresa_id !== companyId) return
          setItems(current => [item, ...current.filter(existing => existing.id !== item.id)].slice(0, 30))
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [companyId, userId, load])

  useEffect(() => {
    if (typeof Notification === 'undefined') {
      setPermission('unsupported')
      return
    }

    setPermission(Notification.permission)

    if (Notification.permission !== 'granted') {
      setPushActive(false)
      return
    }

    let cancelled = false
    setPushBusy(true)

    void ensureZeloPushSubscription(companyId, userId)
      .then(result => {
        if (cancelled) return
        setPermission(result.permission)
        setPushActive(result.active)
      })
      .catch(err => {
        if (cancelled) return
        setPushActive(false)
        setError(err instanceof Error ? err.message : 'Não foi possível ativar o Push neste dispositivo.')
      })
      .finally(() => {
        if (!cancelled) setPushBusy(false)
      })

    return () => {
      cancelled = true
    }
  }, [companyId, userId])

  async function enableBrowserAlerts() {
    setPushBusy(true)
    setTestSent(false)
    setError('')

    try {
      const result = await ensureZeloPushSubscription(companyId, userId, true)
      setPermission(result.permission)
      setPushActive(result.active)

      if (result.permission === 'denied') {
        setError('As notificações foram bloqueadas no navegador.')
      } else if (result.permission === 'unsupported') {
        setError('Este navegador não oferece notificações Push para o Zelo.')
      }
    } catch (err) {
      setPushActive(false)
      setError(err instanceof Error ? err.message : 'Não foi possível ativar o Push neste dispositivo.')
    } finally {
      setPushBusy(false)
    }
  }

  async function testPush() {
    setPushBusy(true)
    setTestSent(false)
    setError('')

    try {
      await sendZeloPushTest(companyId)
      setTestSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o Push de teste.')
    } finally {
      setPushBusy(false)
    }
  }

  async function markRead(item: ZeloNotification) {
    if (item.lida_em) return
    const now = new Date().toISOString()
    const { error: dbError } = await supabase
      .from('notificacoes')
      .update({ lida_em: now })
      .eq('id', item.id)
      .eq('user_id', userId)

    if (dbError) {
      setError(dbError.message)
      return
    }

    setItems(current => current.map(existing => existing.id === item.id ? { ...existing, lida_em: now } : existing))
  }

  async function markAllRead() {
    const now = new Date().toISOString()
    const { error: dbError } = await supabase
      .from('notificacoes')
      .update({ lida_em: now })
      .eq('user_id', userId)
      .eq('empresa_id', companyId)
      .is('lida_em', null)

    if (dbError) {
      setError(dbError.message)
      return
    }

    setItems(current => current.map(item => ({ ...item, lida_em: item.lida_em ?? now })))
  }

  async function openItem(item: ZeloNotification) {
    await markRead(item)
    setOpen(false)
    if (item.ordem_id && onOpenOrder) onOpenOrder(item.ordem_id)
  }

  const pushDescription =
    permission === 'denied'
      ? 'Bloqueados pelo navegador.'
      : permission === 'unsupported'
        ? 'Não suportados neste navegador.'
        : pushBusy
          ? 'Preparando este dispositivo...'
          : pushActive
            ? 'Ativados neste dispositivo.'
            : 'Receba avisos mesmo com o Zelo fechado.'

  return <div className="notification-center">
    <button
      type="button"
      className="notification-button"
      aria-label={unread ? `Notificações: ${unread} não lidas` : 'Notificações'}
      onClick={() => setOpen(value => !value)}
    >
      <Icon name="bell"/>
      {unread > 0 && <span className="notification-badge">{unread > 9 ? '9+' : unread}</span>}
    </button>

    {open && <>
      <button className="notification-scrim" aria-label="Fechar notificações" onClick={() => setOpen(false)}/>
      <section className="notification-panel">
        <div className="notification-panel-head">
          <div><span>CENTRAL</span><h2>Notificações</h2></div>
          {unread > 0 && <button type="button" onClick={() => void markAllRead()}>Marcar lidas</button>}
        </div>

        <div className="notification-permission">
          <div>
            <strong>Avisos no celular</strong>
            <span>{pushDescription}</span>
          </div>
          {permission !== 'denied' && permission !== 'unsupported' && (
            pushActive
              ? <button type="button" disabled={pushBusy} onClick={() => void testPush()}>
                  {testSent ? 'Enviado ✓' : pushBusy ? 'Enviando...' : 'Testar'}
                </button>
              : <button type="button" disabled={pushBusy} onClick={() => void enableBrowserAlerts()}>
                  {pushBusy ? 'Ativando...' : 'Ativar'}
                </button>
          )}
        </div>

        {error && <div className="notification-error">{error}</div>}

        <div className="notification-list">
          {items.length ? items.map(item => <button
            type="button"
            key={item.id}
            className={`notification-item ${item.lida_em ? '' : 'unread'}`}
            onClick={() => void openItem(item)}
          >
            <i/>
            <div>
              <strong>{item.titulo}</strong>
              <span>{item.mensagem}</span>
              <small>{dateTimeFmt.format(new Date(item.created_at))}</small>
            </div>
          </button>) : <div className="notification-empty">
            <Icon name="bell"/>
            <strong>Nenhuma notificação</strong>
            <span>Novas atribuições e mudanças importantes aparecerão aqui.</span>
          </div>}
        </div>
      </section>
    </>}
  </div>
}

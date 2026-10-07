import { supabase } from './supabase'

export type ZeloPushPermission = NotificationPermission | 'unsupported'

type PushSetupResult = {
  permission: ZeloPushPermission
  active: boolean
}

function base64UrlToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(raw, char => char.charCodeAt(0))
}

async function registerWorker() {
  if (!('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.register(`${import.meta.env.BASE_URL}zelo-sw.js`)
}

async function getPublicKey() {
  const { data, error } = await supabase.functions.invoke('zelo-push', {
    body: { mode: 'public_key' },
  })

  if (error) throw error

  const publicKey = String((data as { publicKey?: unknown } | null)?.publicKey ?? '')
  if (!publicKey) throw new Error('Chave de Push indisponível.')

  return publicKey
}

async function persistSubscription(
  companyId: string,
  userId: string,
  subscription: PushSubscription,
) {
  const json = subscription.toJSON()
  const p256dh = json.keys?.p256dh
  const authSecret = json.keys?.auth

  if (!p256dh || !authSecret) {
    throw new Error('O navegador não retornou as chaves do Push.')
  }

  const { error } = await supabase.rpc('register_push_subscription', {
    p_empresa_id: companyId,
    p_endpoint: subscription.endpoint,
    p_p256dh: p256dh,
    p_auth_secret: authSecret,
    p_user_agent: navigator.userAgent,
  })

  if (error) throw error

  // userId é mantido no contrato para impedir registro acidental antes
  // de a sessão e a empresa atuais estarem carregadas no componente.
  if (!userId) throw new Error('Usuário inválido para notificações.')
}

export async function ensureZeloPushSubscription(
  companyId: string,
  userId: string,
  requestPermission = false,
): Promise<PushSetupResult> {
  if (
    typeof Notification === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return { permission: 'unsupported', active: false }
  }

  const registration = await registerWorker()
  if (!registration) return { permission: 'unsupported', active: false }

  let permission: NotificationPermission = Notification.permission

  if (permission === 'default' && requestPermission) {
    permission = await Notification.requestPermission()
  }

  if (permission !== 'granted') {
    return { permission, active: false }
  }

  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    const publicKey = await getPublicKey()
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey),
    })
  }

  await persistSubscription(companyId, userId, subscription)
  return { permission, active: true }
}

export async function sendZeloPushTest(companyId: string) {
  const { data, error } = await supabase.functions.invoke('zelo-push', {
    body: { mode: 'test', empresa_id: companyId },
  })

  if (error) throw error

  const result = data as {
    success?: boolean
    devices?: number
    sent?: number
    failed?: number
  } | null

  if (!result?.success || Number(result.sent ?? 0) < 1) {
    throw new Error(
      Number(result.devices ?? 0) < 1
        ? 'Nenhum dispositivo Push está registrado para esta conta.'
        : 'O Push não foi entregue ao dispositivo.',
    )
  }

  return result
}

export async function unregisterZeloPushSubscription() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) return

    await supabase.rpc('unregister_push_subscription', {
      p_endpoint: subscription.endpoint,
    })

    await subscription.unsubscribe()
  } catch (error) {
    console.warn('[ZELO PUSH] Não foi possível remover a inscrição deste dispositivo.', error)
  }
}

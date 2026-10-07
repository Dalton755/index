import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'

type TeamRole = 'admin' | 'gestor' | 'tecnico' | 'financeiro'

type TeamMember = {
  id: string
  user_id: string
  nome: string | null
  email: string | null
  whatsapp: string | null
  papel: TeamRole
  ativo: boolean
  whatsapp_opt_in_at: string | null
  created_at: string
}

type Invite = {
  id: string
  nome: string | null
  email: string | null
  whatsapp: string | null
  whatsapp_opt_in: boolean
  papel: TeamRole
  token: string
  status: string
  expires_at: string
  created_at: string
}

const roleLabels: Record<TeamRole, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  tecnico: 'Técnico',
  financeiro: 'Financeiro',
}

function phoneLabel(value: string | null) {
  if (!value) return ''
  const digits = value.replace(/\D/g, '')
  const national = digits.startsWith('55') ? digits.slice(2) : digits
  if (national.length === 11) return `(${national.slice(0,2)}) ${national.slice(2,7)}-${national.slice(7)}`
  if (national.length === 10) return `(${national.slice(0,2)}) ${national.slice(2,6)}-${national.slice(6)}`
  return value
}

export function TeamPage({ companyId, companyName, currentUserId }: { companyId: string; companyName: string; currentUserId: string }) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('tecnico')
  const [optIn, setOptIn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [shareWhatsapp, setShareWhatsapp] = useState('')

  const load = useCallback(async () => {
    setError('')
    const [membersRes, invitesRes] = await Promise.all([
      supabase
        .from('membros')
        .select('id,user_id,nome,email,whatsapp,papel,ativo,whatsapp_opt_in_at,created_at')
        .eq('empresa_id', companyId)
        .order('created_at'),
      supabase
        .from('convites_equipe')
        .select('id,nome,email,whatsapp,whatsapp_opt_in,papel,token,status,expires_at,created_at')
        .eq('empresa_id', companyId)
        .eq('status', 'pendente')
        .order('created_at', { ascending: false }),
    ])

    const firstError = membersRes.error || invitesRes.error
    if (firstError) {
      setError(firstError.message)
      return
    }

    setMembers((membersRes.data ?? []) as TeamMember[])
    setInvites((invitesRes.data ?? []) as Invite[])
  }, [companyId])

  useEffect(() => { void load() }, [load])

  function inviteUrl(token: string) {
    return `${window.location.origin}${window.location.pathname}?invite=${token}`
  }

  function inviteText(invite: Pick<Invite, 'nome' | 'papel' | 'token'>) {
    const url = inviteUrl(invite.token)
    return `Olá${invite.nome ? ` ${invite.nome}` : ''}! Você foi convidado para fazer parte da equipe ${companyName} no Zelo como ${roleLabels[invite.papel]}. Toque para aceitar e criar seu acesso: ${url}`
  }

  function openWhatsApp(phone: string, text: string) {
    const digits = phone.replace(/\D/g, '')
    const target = digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(target, '_blank', 'noopener,noreferrer')
  }

  async function shareInvite(invite: Invite) {
    const url = inviteUrl(invite.token)
    const text = inviteText(invite)
    if (invite.whatsapp) {
      openWhatsApp(invite.whatsapp, text)
      return
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Convite Zelo', text, url })
      } else {
        await navigator.clipboard.writeText(url)
        setMessage('Link do convite copiado.')
      }
    } catch {
      // O usuário pode cancelar o compartilhamento sem ser um erro do sistema.
    }
  }

  async function createInvite(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    setShareUrl('')
    setShareWhatsapp('')
    try {
      if (!whatsapp.trim() && !email.trim()) throw new Error('Informe o WhatsApp ou e-mail da pessoa.')

      const { data, error: rpcError } = await supabase.rpc('criar_convite_equipe', {
        p_empresa_id: companyId,
        p_nome: name.trim() || null,
        p_email: email.trim() || null,
        p_whatsapp: whatsapp.trim() || null,
        p_papel: role,
      })
      if (rpcError) throw rpcError

      const result = data as { invite_id?: string; token?: string; email?: string | null; whatsapp?: string | null } | null
      if (!result?.invite_id || !result?.token) throw new Error('Não foi possível gerar o convite.')

      if (optIn) {
        const { error: consentError } = await supabase
          .from('convites_equipe')
          .update({ whatsapp_opt_in: true })
          .eq('id', result.invite_id)
          .eq('empresa_id', companyId)
        if (consentError) throw consentError
      }

      const url = inviteUrl(result.token)
      setShareUrl(url)
      setShareWhatsapp(result.whatsapp || whatsapp.trim())

      if (result.whatsapp) {
        const { data: sendResult, error: sendError } = await supabase.functions.invoke('zelo-whatsapp-send', {
          body: {
            kind: 'convite_equipe',
            empresa_id: companyId,
            empresa_nome: companyName,
            convite_id: result.invite_id,
            destino: result.whatsapp,
            nome: name.trim() || 'Profissional',
            papel: role,
            invite_url: url,
          },
        })

        const wa = sendResult as { configured?: boolean; sent?: boolean; fallback_text?: string; error?: string } | null

        if (!sendError && wa?.sent) {
          setMessage(`Convite enviado automaticamente pelo WhatsApp para ${phoneLabel(result.whatsapp)}.`)
        } else {
          const text = wa?.fallback_text || inviteText({ nome: name.trim() || null, papel: role, token: result.token })
          setMessage('Convite criado. Abrindo o WhatsApp com a mensagem pronta para enviar.')
          openWhatsApp(result.whatsapp, text)
        }
      } else {
        setMessage('Convite criado. Compartilhe o link abaixo com a pessoa.')
      }

      setName('')
      setWhatsapp('')
      setEmail('')
      setRole('tecnico')
      setOptIn(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar o convite.')
    } finally {
      setBusy(false)
    }
  }

  async function updateMember(member: TeamMember, patch: Partial<Pick<TeamMember, 'papel' | 'ativo'>>) {
    setBusy(true)
    setError('')
    try {
      const { error: dbError } = await supabase
        .from('membros')
        .update(patch)
        .eq('id', member.id)
        .eq('empresa_id', companyId)
      if (dbError) throw dbError
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar a equipe.')
    } finally {
      setBusy(false)
    }
  }

  async function cancelInvite(id: string) {
    setBusy(true)
    setError('')
    try {
      const { error: dbError } = await supabase
        .from('convites_equipe')
        .update({ status: 'cancelado' })
        .eq('id', id)
        .eq('empresa_id', companyId)
      if (dbError) throw dbError
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível cancelar o convite.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="page-section team-page">
    <div className="page-heading">
      <div><span>GESTÃO</span><h1>Equipe</h1></div>
    </div>

    <div className="team-hero">
      <div>
        <span>EQUIPE DE CAMPO</span>
        <h2>Convide pelo WhatsApp.</h2>
        <p>O técnico recebe um link seguro, cria ou usa sua conta e entra direto na equipe. Gmail não é obrigatório.</p>
      </div>
      <div className="team-count"><strong>{members.filter(m => m.ativo).length}</strong><span>ativos</span></div>
    </div>

    <form className="team-form" onSubmit={createInvite}>
      <div className="section-title"><div><span>NOVO ACESSO</span><h2>Adicionar à equipe</h2></div></div>
      <div className="team-form-grid">
        <label>Nome<input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da pessoa"/></label>
        <label>WhatsApp<input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} inputMode="tel" placeholder="(11) 99999-9999"/></label>
      </div>
      <label>E-mail <small className="field-optional">opcional — pode ser qualquer provedor</small><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="pessoa@email.com"/></label>
      <label>Função
        <select value={role} onChange={e => setRole(e.target.value as TeamRole)}>
          <option value="tecnico">Técnico</option>
          <option value="gestor">Gestor</option>
          <option value="financeiro">Financeiro</option>
          <option value="admin">Administrador</option>
        </select>
      </label>
      {whatsapp.trim() && <label className="consent-check"><input type="checkbox" checked={optIn} onChange={e => setOptIn(e.target.checked)}/><span>A pessoa autorizou receber avisos operacionais do Zelo neste WhatsApp.</span></label>}
      <button className="wide-primary" disabled={busy || (!whatsapp.trim() && !email.trim())}><Icon name="send"/>{busy ? 'Preparando convite...' : whatsapp.trim() ? 'Convidar pelo WhatsApp' : 'Criar convite'}</button>
    </form>

    {error && <div className="form-alert error">{error}</div>}
    {message && <div className="form-alert success">{message}</div>}
    {shareUrl && <div className="invite-share-box"><div><span>LINK DO CONVITE</span><strong>{shareUrl}</strong></div><div className="invite-share-actions">{shareWhatsapp && <button type="button" onClick={() => openWhatsApp(shareWhatsapp, `Convite Zelo: ${shareUrl}`)}>WhatsApp</button>}<button type="button" onClick={() => void navigator.clipboard.writeText(shareUrl)}>Copiar</button></div></div>}

    {invites.length > 0 && <section className="team-section">
      <div className="section-title"><div><span>AGUARDANDO</span><h2>Convites pendentes</h2></div></div>
      <div className="team-list">{invites.map(invite => <article className="invite-card" key={invite.id}>
        <div className="team-avatar pending">{(invite.nome || invite.email || invite.whatsapp || 'P').slice(0, 1).toUpperCase()}</div>
        <div className="team-person"><strong>{invite.nome || invite.email || phoneLabel(invite.whatsapp)}</strong><span>{invite.whatsapp ? phoneLabel(invite.whatsapp) : invite.email || roleLabels[invite.papel]}</span><small>{roleLabels[invite.papel]} • expira em {new Intl.DateTimeFormat('pt-BR').format(new Date(invite.expires_at))}</small></div>
        <div className="team-card-actions"><button type="button" onClick={() => void shareInvite(invite)}>{invite.whatsapp ? 'WhatsApp' : 'Compartilhar'}</button><button type="button" className="danger-text" onClick={() => void cancelInvite(invite.id)}>Cancelar</button></div>
      </article>)}</div>
    </section>}

    <section className="team-section">
      <div className="section-title"><div><span>ACESSOS</span><h2>Membros da equipe</h2></div></div>
      <div className="team-list">{members.map(member => {
        const isSelf = member.user_id === currentUserId
        const initials = (member.nome || member.email || 'P').split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase()
        return <article className={`team-card ${member.ativo ? '' : 'inactive'}`} key={member.id}>
          <div className="team-avatar">{initials}</div>
          <div className="team-person"><strong>{member.nome || 'Sem nome'}</strong><span>{member.whatsapp ? phoneLabel(member.whatsapp) : member.email || 'Sem contato'}</span><small>{member.ativo ? 'Acesso ativo' : 'Acesso desativado'}{member.whatsapp_opt_in_at ? ' • WhatsApp ativo' : ''}</small></div>
          <div className="team-member-controls">
            <select disabled={busy || isSelf} value={member.papel} onChange={e => void updateMember(member, { papel: e.target.value as TeamRole })}>
              <option value="tecnico">Técnico</option>
              <option value="gestor">Gestor</option>
              <option value="financeiro">Financeiro</option>
              <option value="admin">Administrador</option>
            </select>
            {!isSelf && <button type="button" disabled={busy} onClick={() => void updateMember(member, { ativo: !member.ativo })}>{member.ativo ? 'Desativar' : 'Ativar'}</button>}
          </div>
        </article>
      })}</div>
    </section>
  </section>
}

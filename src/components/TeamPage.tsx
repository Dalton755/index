import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Icon } from './Icon'
import { supabase } from '../lib/supabase'

type TeamRole = 'admin' | 'gestor' | 'tecnico' | 'financeiro'

type TeamMember = {
  id: string
  user_id: string
  nome: string | null
  email: string | null
  papel: TeamRole
  ativo: boolean
  created_at: string
}

type Invite = {
  id: string
  nome: string | null
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

export function TeamPage({ companyId, companyName, currentUserId }: { companyId: string; companyName: string; currentUserId: string }) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [name, setName] = useState('')
  const [role, setRole] = useState<TeamRole>('tecnico')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [shareUrl, setShareUrl] = useState('')

  const load = useCallback(async () => {
    setError('')
    const [membersRes, invitesRes] = await Promise.all([
      supabase
        .from('membros')
        .select('id,user_id,nome,email,papel,ativo,created_at')
        .eq('empresa_id', companyId)
        .order('created_at'),
      supabase
        .from('convites_equipe')
        .select('id,nome,papel,token,status,expires_at,created_at')
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
    return `Você foi convidado para fazer parte da equipe ${companyName} no Zelo como ${roleLabels[invite.papel]}. Abra o link para entrar ou criar seu acesso: ${url}`
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url)
    setMessage('Link do convite copiado.')
  }

  async function shareInvite(invite: Invite) {
    const url = inviteUrl(invite.token)
    const text = inviteText(invite)
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Convite Zelo', text, url })
      } else {
        await copyLink(url)
      }
    } catch {
      // Cancelar a folha de compartilhamento não é erro.
    }
  }

  async function createInvite(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    setShareUrl('')
    try {
      const { data, error: rpcError } = await supabase.rpc('criar_convite_equipe', {
        p_empresa_id: companyId,
        p_nome: name.trim() || null,
        p_papel: role,
      })
      if (rpcError) throw rpcError

      const result = data as { invite_id?: string; token?: string } | null
      if (!result?.token) throw new Error('Não foi possível gerar o convite.')

      const url = inviteUrl(result.token)
      setShareUrl(url)
      setMessage('Convite criado. Compartilhe o link com a pessoa.')
      setName('')
      setRole('tecnico')
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
        <h2>Convite simples, sem complicação.</h2>
        <p>Crie um link seguro e envie por onde quiser. A pessoa abre, entra ou cria sua conta e passa a fazer parte da equipe.</p>
      </div>
      <div className="team-count"><strong>{members.filter(m => m.ativo).length}</strong><span>ativos</span></div>
    </div>

    <form className="team-form" onSubmit={createInvite}>
      <div className="section-title"><div><span>NOVO ACESSO</span><h2>Gerar convite</h2></div></div>
      <label>Nome da pessoa<input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: João da Silva"/></label>
      <label>Função
        <select value={role} onChange={e => setRole(e.target.value as TeamRole)}>
          <option value="tecnico">Técnico</option>
          <option value="gestor">Gestor</option>
          <option value="financeiro">Financeiro</option>
          <option value="admin">Administrador</option>
        </select>
      </label>
      <button className="wide-primary" disabled={busy}><Icon name="plus"/>{busy ? 'Gerando...' : 'Gerar link de convite'}</button>
    </form>

    {error && <div className="form-alert error">{error}</div>}
    {message && <div className="form-alert success">{message}</div>}
    {shareUrl && <div className="invite-share-box">
      <div><span>LINK DO CONVITE</span><strong>{shareUrl}</strong></div>
      <div className="invite-share-actions">
        <button type="button" onClick={() => void copyLink(shareUrl)}>Copiar</button>
        <button type="button" onClick={() => {
          const invite = invites.find(item => inviteUrl(item.token) === shareUrl)
          if (invite) void shareInvite(invite)
          else if (navigator.share) void navigator.share({ title: 'Convite Zelo', text: `Convite para a equipe ${companyName}: ${shareUrl}`, url: shareUrl })
        }}>Compartilhar</button>
      </div>
    </div>}

    {invites.length > 0 && <section className="team-section">
      <div className="section-title"><div><span>AGUARDANDO</span><h2>Convites pendentes</h2></div></div>
      <div className="team-list">{invites.map(invite => <article className="invite-card" key={invite.id}>
        <div className="team-avatar pending">{(invite.nome || roleLabels[invite.papel]).slice(0, 1).toUpperCase()}</div>
        <div className="team-person">
          <strong>{invite.nome || 'Convite sem nome'}</strong>
          <span>{roleLabels[invite.papel]}</span>
          <small>Expira em {new Intl.DateTimeFormat('pt-BR').format(new Date(invite.expires_at))}</small>
        </div>
        <div className="team-card-actions">
          <button type="button" onClick={() => void shareInvite(invite)}>Compartilhar</button>
          <button type="button" onClick={() => void copyLink(inviteUrl(invite.token))}>Copiar</button>
          <button type="button" className="danger-text" onClick={() => void cancelInvite(invite.id)}>Cancelar</button>
        </div>
      </article>)}</div>
    </section>}

    <section className="team-section">
      <div className="section-title"><div><span>ACESSOS</span><h2>Membros da equipe</h2></div></div>
      <div className="team-list">{members.map(member => {
        const isSelf = member.user_id === currentUserId
        const initials = (member.nome || member.email || 'P').split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase()
        return <article className={`team-card ${member.ativo ? '' : 'inactive'}`} key={member.id}>
          <div className="team-avatar">{initials}</div>
          <div className="team-person">
            <strong>{member.nome || 'Sem nome'}</strong>
            <span>{member.email || roleLabels[member.papel]}</span>
            <small>{member.ativo ? 'Acesso ativo' : 'Acesso desativado'}</small>
          </div>
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

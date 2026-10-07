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
  email: string
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

export function TeamPage({ companyId, currentUserId }: { companyId: string; currentUserId: string }) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
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
        .select('id,nome,email,papel,token,status,expires_at,created_at')
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

  async function shareInvite(invite: Invite) {
    const url = inviteUrl(invite.token)
    const text = `Você foi convidado para a equipe do Zelo como ${roleLabels[invite.papel]}. Acesse: ${url}`
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
    try {
      const { data, error: rpcError } = await supabase.rpc('criar_convite_equipe', {
        p_empresa_id: companyId,
        p_nome: name.trim() || null,
        p_email: email.trim(),
        p_papel: role,
      })
      if (rpcError) throw rpcError

      const result = data as { status?: string; token?: string; email?: string } | null
      if (result?.status === 'adicionado') {
        setMessage('A pessoa já tinha uma conta e foi adicionada à equipe.')
      } else if (result?.token) {
        const url = inviteUrl(result.token)
        setShareUrl(url)
        setMessage('Convite criado. Compartilhe o link com a pessoa.')
      }

      setName('')
      setEmail('')
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
        <h2>Cada pessoa vê só o que precisa.</h2>
        <p>Técnicos recebem suas próprias OS e agenda. Gestores organizam a operação e o financeiro fica protegido.</p>
      </div>
      <div className="team-count"><strong>{members.filter(m => m.ativo).length}</strong><span>ativos</span></div>
    </div>

    <form className="team-form" onSubmit={createInvite}>
      <div className="section-title"><div><span>NOVO ACESSO</span><h2>Adicionar à equipe</h2></div></div>
      <div className="team-form-grid">
        <label>Nome<input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da pessoa"/></label>
        <label>E-mail<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="pessoa@empresa.com"/></label>
      </div>
      <label>Função
        <select value={role} onChange={e => setRole(e.target.value as TeamRole)}>
          <option value="tecnico">Técnico</option>
          <option value="gestor">Gestor</option>
          <option value="financeiro">Financeiro</option>
          <option value="admin">Administrador</option>
        </select>
      </label>
      <button className="wide-primary" disabled={busy || !email.trim()}><Icon name="plus"/>{busy ? 'Salvando...' : 'Adicionar / convidar'}</button>
    </form>

    {error && <div className="form-alert error">{error}</div>}
    {message && <div className="form-alert success">{message}</div>}
    {shareUrl && <div className="invite-share-box"><div><span>LINK DO CONVITE</span><strong>{shareUrl}</strong></div><button type="button" onClick={() => void navigator.clipboard.writeText(shareUrl)}>Copiar</button></div>}

    {invites.length > 0 && <section className="team-section">
      <div className="section-title"><div><span>AGUARDANDO</span><h2>Convites pendentes</h2></div></div>
      <div className="team-list">{invites.map(invite => <article className="invite-card" key={invite.id}>
        <div className="team-avatar pending">{(invite.nome || invite.email).slice(0, 1).toUpperCase()}</div>
        <div className="team-person"><strong>{invite.nome || invite.email}</strong><span>{invite.nome ? invite.email : roleLabels[invite.papel]}</span><small>{roleLabels[invite.papel]} • expira em {new Intl.DateTimeFormat('pt-BR').format(new Date(invite.expires_at))}</small></div>
        <div className="team-card-actions"><button type="button" onClick={() => void shareInvite(invite)}>Compartilhar</button><button type="button" className="danger-text" onClick={() => void cancelInvite(invite.id)}>Cancelar</button></div>
      </article>)}</div>
    </section>}

    <section className="team-section">
      <div className="section-title"><div><span>ACESSOS</span><h2>Membros da equipe</h2></div></div>
      <div className="team-list">{members.map(member => {
        const isSelf = member.user_id === currentUserId
        const initials = (member.nome || member.email || 'P').split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase()
        return <article className={`team-card ${member.ativo ? '' : 'inactive'}`} key={member.id}>
          <div className="team-avatar">{initials}</div>
          <div className="team-person"><strong>{member.nome || 'Sem nome'}</strong><span>{member.email || 'Sem e-mail'}</span><small>{member.ativo ? 'Acesso ativo' : 'Acesso desativado'}</small></div>
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

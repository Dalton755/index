import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type AssignableMember = {
  user_id: string
  nome: string | null
  email: string | null
  papel: string
}

export function AssignmentControl({
  companyId,
  orderId,
  currentAssignee,
  onChanged,
}: {
  companyId: string
  orderId: string
  currentAssignee: string | null
  onChanged: () => Promise<void>
}) {
  const [members, setMembers] = useState<AssignableMember[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error: dbError } = await supabase
      .from('membros')
      .select('user_id,nome,email,papel')
      .eq('empresa_id', companyId)
      .eq('ativo', true)
      .in('papel', ['admin', 'gestor', 'tecnico'])
      .order('nome')
    if (dbError) {
      setError(dbError.message)
      return
    }
    setMembers((data ?? []) as AssignableMember[])
  }, [companyId])

  useEffect(() => { void load() }, [load])

  async function assign(value: string) {
    setBusy(true)
    setError('')
    try {
      const { error: dbError } = await supabase
        .from('ordens_servico')
        .update({ tecnico_responsavel: value || null })
        .eq('empresa_id', companyId)
        .eq('id', orderId)
      if (dbError) throw dbError
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atribuir o atendimento.')
    } finally {
      setBusy(false)
    }
  }

  return <article className="detail-card assignment-control">
    <div>
      <span>RESPONSÁVEL</span>
      <strong>Técnico do atendimento</strong>
      <small>Ao atribuir, esta OS entra automaticamente na agenda do profissional.</small>
    </div>
    <select disabled={busy} value={currentAssignee ?? ''} onChange={e => void assign(e.target.value)}>
      <option value="">Sem responsável</option>
      {members.map(member => <option key={member.user_id} value={member.user_id}>{member.nome || member.email || 'Profissional'} — {member.papel === 'tecnico' ? 'Técnico' : member.papel === 'gestor' ? 'Gestor' : 'Administrador'}</option>)}
    </select>
    {error && <div className="form-alert error">{error}</div>}
  </article>
}

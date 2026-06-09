import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import type { Profile } from '../types/database'

import Modal from '../components/Modal'
import { Navigate } from 'react-router-dom'

const LEVEL_LABELS: Record<number, string> = { 0: 'ADMIN', 1: '운영자', 2: '직원' }
const LEVEL_COLORS: Record<number, string> = { 0: 'bg-violet-100 text-violet-700', 1: 'bg-blue-100 text-blue-700', 2: 'bg-slate-100 text-slate-600' }

export default function Admin() {
  const { profile } = useAuth()

  if (profile?.level !== 0) return <Navigate to="/" replace />

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteModal, setInviteModal] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', name: '', level: '1', employee_id: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    const { data } = await supabase.from('profiles').select('*').order('level')
    setProfiles(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setMsg('')
    try {
      // Create user via admin API (requires service role key — this uses anon key with signUp)
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { name: form.name } }
      })
      if (authErr) throw authErr
      const userId = authData.user?.id
      if (!userId) throw new Error('사용자 생성 실패')

      // Create profile
      const { error: profileErr } = await supabase.from('profiles').upsert([{
        id: userId,
        name: form.name,
        level: parseInt(form.level),
        employee_id: form.employee_id || null,
      }])
      if (profileErr) throw profileErr

      setMsg('✅ 계정 생성 완료! 이메일 인증 후 로그인 가능합니다.')
      setForm({ email: '', password: '', name: '', level: '1', employee_id: '' })
      await load()
    } catch (err: any) {
      setMsg('❌ ' + (err.message || '오류 발생'))
    }
    setSaving(false)
  }

  const handleLevelChange = async (id: string, level: number) => {
    await supabase.from('profiles').update({ level }).eq('id', id)
    await load()
  }

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400">로딩 중...</div>

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-6 space-y-4">
        <div className="flex justify-end">
          <button onClick={() => setInviteModal(true)} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">+ 계정 생성</button>
        </div>
        {/* Level guide */}
        <div className="bg-violet-50 rounded-2xl border border-violet-200 p-5">
          <div className="font-bold text-violet-800 text-sm mb-3">권한 레벨 안내</div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><span className="font-bold text-violet-700">Level 0 — ADMIN</span><p className="text-violet-600 text-xs mt-1">시스템 설정, 계정 관리, 권한 변경</p></div>
            <div><span className="font-bold text-blue-700">Level 1 — 운영자</span><p className="text-blue-600 text-xs mt-1">전체 데이터 읽기/쓰기, 연차 승인</p></div>
            <div><span className="font-bold text-slate-700">Level 2 — 직원</span><p className="text-slate-600 text-xs mt-1">본인 정보 조회, 연차 신청</p></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 font-bold text-sm">사용자 목록 ({profiles.length}명)</div>
          <table className="w-full border-collapse">
            <thead><tr>{['이름','이메일','직원 연결','레벨','관리'].map(h => (
              <th key={h} className="bg-slate-50 px-4 py-3 text-left text-xs font-bold text-slate-500 border-b border-slate-200">{h}</th>
            ))}</tr></thead>
            <tbody>
              {profiles.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-slate-400 py-8">없음</td></tr>
              ) : profiles.map(p => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-sm">{p.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono">{p.id.slice(0,8)}...</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{p.employee_id || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${LEVEL_COLORS[p.level]}`}>
                      Level {p.level} — {LEVEL_LABELS[p.level]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.id !== profile?.id && (
                      <select value={p.level} onChange={e => handleLevelChange(p.id, parseInt(e.target.value))}
                        className="border-1.5 border-slate-200 rounded-lg px-2 py-1 text-xs outline-none">
                        <option value={0}>Level 0 — ADMIN</option>
                        <option value={1}>Level 1 — 운영자</option>
                        <option value={2}>Level 2 — 직원</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={inviteModal} onClose={() => { setInviteModal(false); setMsg('') }} title="새 계정 생성" size="sm">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">이름 *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
              className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">이메일 *</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required
              className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">초기 비밀번호 *</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6}
              className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">레벨</label>
              <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
                className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none">
                <option value="1">Level 1 — 운영자</option>
                <option value="2">Level 2 — 직원</option>
                <option value="0">Level 0 — ADMIN</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">연결 직원 사번</label>
              <input value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} placeholder="0001"
                className="w-full border-1.5 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>
          {msg && <div className={`rounded-xl px-4 py-2.5 text-sm ${msg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{msg}</div>}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => { setInviteModal(false); setMsg('') }} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-semibold">취소</button>
            <button type="submit" disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">
              {saving ? '생성 중...' : '생성'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

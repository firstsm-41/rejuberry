import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Tab = 'login' | 'register'
type RegStep = 'verify' | 'setup'

interface VerifiedEmp {
  employee_id: string
  emp_level: number
  emp_name: string
}

const LEVEL_LABEL: Record<number, { text: string; color: string }> = {
  0: { text: 'ADMIN',  color: 'text-violet-600' },
  1: { text: '운영자', color: 'text-blue-600' },
  2: { text: '직원',   color: 'text-slate-600' },
}

export default function Login() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('login')

  // ── 로그인 state ──────────────────────────────
  const [loginEmail, setLoginEmail]       = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError]       = useState('')
  const [loginLoading, setLoginLoading]   = useState(false)

  // ── 가입 state ────────────────────────────────
  const [regStep, setRegStep]           = useState<RegStep>('verify')
  const [verName, setVerName]           = useState('')
  const [verBirth, setVerBirth]         = useState('')
  const [verifiedEmp, setVerifiedEmp]   = useState<VerifiedEmp | null>(null)
  const [regEmail, setRegEmail]         = useState('')
  const [regPassword, setRegPassword]   = useState('')
  const [regPassword2, setRegPassword2] = useState('')
  const [regError, setRegError]         = useState('')
  const [regLoading, setRegLoading]     = useState(false)
  const [regDone, setRegDone]           = useState(false)

  // ── 로그인 ────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword })
    if (error) setLoginError('이메일 또는 비밀번호가 올바르지 않습니다.')
    else navigate('/')
    setLoginLoading(false)
  }

  // ── Step 1: 이름 + 생년월일 인증 ──────────────
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError('')
    setRegLoading(true)

    // birth date 형식 변환: YYYY-MM-DD
    const birth = verBirth  // input type="date" 가 이미 YYYY-MM-DD 반환

    const { data, error } = await supabase.rpc('verify_employee', {
      p_name: verName.trim(),
      p_birth_date: birth,
    })

    if (error || !data || data.length === 0) {
      setRegError('일치하는 직원 정보가 없거나 이미 계정이 있습니다.')
      setRegLoading(false)
      return
    }

    setVerifiedEmp({
      employee_id: data[0].employee_id,
      emp_level:   data[0].emp_level,
      emp_name:    verName.trim(),
    })
    setRegStep('setup')
    setRegLoading(false)
  }

  // ── Step 2: 이메일 + 비밀번호 설정 ────────────
  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!verifiedEmp) return
    setRegError('')

    if (regPassword !== regPassword2) {
      setRegError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (regPassword.length < 6) {
      setRegError('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    setRegLoading(true)

    // 계정 생성 — options.data 에 직원 정보를 담으면 DB trigger가 profiles 자동 생성
    const { error: signUpErr } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: {
        data: {
          name:        verifiedEmp.emp_name,
          level:       verifiedEmp.emp_level,
          employee_id: verifiedEmp.employee_id,
        },
      },
    })

    if (signUpErr) {
      setRegError(signUpErr.message.includes('already') ? '이미 사용 중인 이메일입니다.' : signUpErr.message)
      setRegLoading(false)
      return
    }

    setRegDone(true)
    setRegLoading(false)
  }

  const resetReg = () => {
    setRegStep('verify')
    setVerName(''); setVerBirth('')
    setVerifiedEmp(null)
    setRegEmail(''); setRegPassword(''); setRegPassword2('')
    setRegError(''); setRegDone(false)
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center text-white font-bold text-2xl shadow-xl mx-auto mb-4">
            리
          </div>
          <h1 className="text-white text-xl font-bold">리쥬베리의원</h1>
          <p className="text-slate-400 text-sm mt-1">인사관리 시스템</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            {(['login','register'] as Tab[]).map(t => (
              <button key={t} onClick={() => { setTab(t); resetReg(); setLoginError('') }}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${tab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                {t === 'login' ? '로그인' : '직원 가입'}
              </button>
            ))}
          </div>

          <div className="p-8">

            {/* ── 로그인 탭 ─────────────────────────────── */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">이메일</label>
                  <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required
                    placeholder="이메일 입력"
                    className="w-full border-1.5 border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">비밀번호</label>
                  <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required
                    placeholder="비밀번호 입력"
                    className="w-full border-1.5 border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors" />
                </div>
                {loginError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-600">{loginError}</div>
                )}
                <button type="submit" disabled={loginLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                  {loginLoading ? '로그인 중...' : '로그인'}
                </button>
              </form>
            )}

            {/* ── 가입 탭 ───────────────────────────────── */}
            {tab === 'register' && (
              <>
                {/* 완료 화면 */}
                {regDone ? (
                  <div className="text-center py-4 space-y-4">
                    <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto text-2xl">✓</div>
                    <div>
                      <p className="font-bold text-slate-800">{verifiedEmp?.emp_name}님, 가입 완료!</p>
                      <p className="text-sm text-slate-500 mt-1">
                        권한: <span className={`font-semibold ${LEVEL_LABEL[verifiedEmp?.emp_level ?? 2].color}`}>
                          {LEVEL_LABEL[verifiedEmp?.emp_level ?? 2].text}
                        </span>
                      </p>
                    </div>
                    <button onClick={() => setTab('login')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm">
                      로그인하러 가기
                    </button>
                  </div>

                ) : regStep === 'verify' ? (
                  /* Step 1: 이름 + 생년월일 */
                  <form onSubmit={handleVerify} className="space-y-4">
                    <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-700">
                      등록된 직원만 가입할 수 있습니다.<br />이름과 생년월일을 입력하세요.
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">성명</label>
                      <input value={verName} onChange={e => setVerName(e.target.value)} required
                        placeholder="실명 입력"
                        className="w-full border-1.5 border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">생년월일</label>
                      <input type="date" value={verBirth} onChange={e => setVerBirth(e.target.value)} required
                        className="w-full border-1.5 border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
                    </div>
                    {regError && (
                      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-600">{regError}</div>
                    )}
                    <button type="submit" disabled={regLoading}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-xl text-sm">
                      {regLoading ? '확인 중...' : '본인 확인'}
                    </button>
                  </form>

                ) : (
                  /* Step 2: 이메일 + 비밀번호 설정 */
                  <form onSubmit={handleSetup} className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm">
                      <span className="font-bold text-green-700">{verifiedEmp?.emp_name}</span>
                      <span className="text-green-600">님 확인됐습니다.</span>
                      <span className={`ml-2 font-semibold text-xs ${LEVEL_LABEL[verifiedEmp?.emp_level ?? 2].color}`}>
                        ({LEVEL_LABEL[verifiedEmp?.emp_level ?? 2].text})
                      </span>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">로그인 이메일</label>
                      <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required
                        placeholder="사용할 이메일 입력"
                        className="w-full border-1.5 border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">비밀번호 (6자 이상)</label>
                      <input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} required minLength={6}
                        placeholder="비밀번호 설정"
                        className="w-full border-1.5 border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">비밀번호 확인</label>
                      <input type="password" value={regPassword2} onChange={e => setRegPassword2(e.target.value)} required
                        placeholder="비밀번호 재입력"
                        className="w-full border-1.5 border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
                    </div>
                    {regError && (
                      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-600">{regError}</div>
                    )}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setRegStep('verify'); setRegError('') }}
                        className="flex-none bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold py-2.5 px-4 rounded-xl text-sm">
                        이전
                      </button>
                      <button type="submit" disabled={regLoading}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-xl text-sm">
                        {regLoading ? '생성 중...' : '계정 생성'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

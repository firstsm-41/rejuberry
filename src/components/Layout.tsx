import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/useAuth'

const ICON = {
  dashboard: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',
  employees: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 3.13a4 4 0 0 1 0 7.75',
  schedule:  'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  leave:     'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h4',
  overtime:  'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zM12 6v6l4 2',
  changes:   'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6M9 15h6',
  admin:     'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  guide:     'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
}

interface NavItem { to: string; label: string; icon: string; exact?: boolean }

const managerNav: NavItem[] = [
  { to: '/',           label: '대시보드',    icon: ICON.dashboard, exact: true },
  { to: '/employees',  label: '직원 명단',   icon: ICON.employees },
  { to: '/personnel',  label: '인사관리',    icon: ICON.admin },
  { to: '/schedule',   label: '근무표',      icon: ICON.schedule },
  { to: '/leave',      label: '연차 관리',   icon: ICON.leave },
  { to: '/overtime',   label: '오버타임 확인', icon: ICON.overtime },
  { to: '/changes',    label: '입퇴사 관리', icon: ICON.changes },
  { to: '/guide',      label: '사용 설명서', icon: ICON.guide },
]

const staffNav: NavItem[] = [
  { to: '/',          label: '대시보드',    icon: ICON.dashboard, exact: true },
  { to: '/schedule',  label: '근무표',      icon: ICON.schedule },
  { to: '/leave',     label: '연차 관리',   icon: ICON.leave },
  { to: '/overtime',  label: '오버타임 등록', icon: ICON.overtime },
  { to: '/guide',     label: '사용 설명서', icon: ICON.guide },
]

export default function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const level = profile?.level ?? 2
  const [drawerOpen, setDrawerOpen] = useState(false)

  const navItems = level <= 1 ? managerNav : staffNav

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-all ${
      isActive ? 'bg-blue-500/20 text-blue-300' : 'text-slate-400 hover:bg-white/8 hover:text-slate-200'
    }`

  const SidebarContent = (
    <>
      {/* Brand */}
      <div className="px-4 py-5 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center text-white font-bold text-sm shadow-lg">
            리
          </div>
          <div>
            <div className="text-white text-sm font-bold">리쥬베리의원</div>
            <div className="text-slate-400 text-xs mt-0.5">인사관리 시스템</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.exact ?? false}
            onClick={() => setDrawerOpen(false)} className={navLinkClass}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="flex-shrink-0">
              <path d={item.icon} />
            </svg>
            {item.label}
          </NavLink>
        ))}

        {/* Admin only */}
        {level === 0 && (
          <NavLink to="/admin" onClick={() => setDrawerOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-all ${
                isActive ? 'bg-violet-500/20 text-violet-300' : 'text-slate-400 hover:bg-white/8 hover:text-slate-200'
              }`
            }>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="flex-shrink-0">
              <path d={ICON.admin} />
            </svg>
            시스템 관리
          </NavLink>
        )}
      </nav>

      {/* User info */}
      <div className="p-4 border-t border-slate-700/60">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {profile?.name?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-slate-200 text-xs font-semibold truncate">{profile?.name || '사용자'}</div>
            <div className="text-slate-500 text-xs">
              {level === 0 ? 'ADMIN' : level === 1 ? '운영자' : '직원'}
            </div>
          </div>
        </div>
        <button onClick={handleSignOut}
          className="w-full text-xs text-slate-500 hover:text-slate-300 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-left px-2">
          로그아웃
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 bg-slate-900 flex-col flex-shrink-0">
        {SidebarContent}
      </aside>

      {/* Mobile drawer + backdrop */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setDrawerOpen(false)} />
      )}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 flex flex-col transform transition-transform duration-200 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {SidebarContent}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 bg-slate-900 flex-shrink-0">
          <button onClick={() => setDrawerOpen(true)} className="text-slate-200 p-1 -ml-1" aria-label="메뉴 열기">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center text-white font-bold text-xs">리</div>
            <span className="text-white text-sm font-bold">리쥬베리의원</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

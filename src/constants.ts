export const DEPTS = ['대표원장','부원장','총괄실장','실장','코디','간호','피부1(시술)','피부2(관리)','마케팅','미분류'] as const
export type Dept = (typeof DEPTS)[number]

export const STATS_DEPTS = DEPTS.filter(d => d !== '마케팅' && d !== '미분류')

// 통계/근무 집계에서 제외하는 부서 (대시보드 상단 별도 표기)
export const EXTRA_DEPTS = ['마케팅','미분류']

export const POSITIONS = ['대표원장','부원장','총괄실장','상담실장','VIP실장','코디네이터','간호팀장','간호조무사','간호사','피부1팀 팀장','피부2팀 팀장','피부관리사','마케팅팀 이사','마케팅팀 실장','마케팅팀 디자이너','청소','기타']

export const DEPT_COLORS: Record<string, string> = {
  '대표원장':'#1e40af','부원장':'#1d4ed8','총괄실장':'#6d28d9',
  '실장':'#7c3aed','코디':'#0369a1','간호':'#047857',
  '피부1(시술)':'#9d174d','피부2(관리)':'#92400e',
  '마케팅':'#0f766e','미분류':'#6b7280',
}

export const DAYS_KR = ['일','월','화','수','목','금','토'] as const

export type WorkStatus = 'D' | 'S' | 'H' | 'Y' | 'OFF' | ''

export const STATUS_ORDER: WorkStatus[] = ['D','S','H','Y','OFF','']

export const STATUS_CFG: Record<string, { label:string; bg:string; color:string }> = {
  D:   { label:'근무', bg:'#bfdbfe', color:'#0f172a' },
  S:   { label:'추가', bg:'#ddd6fe', color:'#0f172a' },
  H:   { label:'반차', bg:'#bbf7d0', color:'#0f172a' },
  Y:   { label:'연차', bg:'#fed7aa', color:'#0f172a' },
  OFF: { label:'휴무', bg:'#fecaca', color:'#0f172a' },
  '':  { label:'공백', bg:'transparent', color:'transparent' },
}

export const TEAM_GROUPS: Array<{ label: string; depts: string[]; color: string }> = [
  { label: '의료진',      depts: ['대표원장', '부원장'], color: '#1d4ed8' },
  { label: '실장',        depts: ['총괄실장', '실장'],   color: '#7c3aed' },
  { label: '코디',        depts: ['코디'],               color: '#0369a1' },
  { label: '간호',        depts: ['간호'],               color: '#047857' },
  { label: '피부1(시술)', depts: ['피부1(시술)'],        color: '#9d174d' },
  { label: '피부2(관리)', depts: ['피부2(관리)'],        color: '#92400e' },
  { label: '마케팅',      depts: ['마케팅'],             color: '#0f766e' },
]

// 근무표 표시용 그룹 (의료진·실장 묶음 + 미분류까지 전체 포함)
export const SCHEDULE_GROUPS: Array<{ label: string; depts: string[]; color: string }> = [
  { label: '의료진',      depts: ['대표원장', '부원장'], color: '#1e40af' },
  { label: '실장',        depts: ['총괄실장', '실장'],   color: '#6d28d9' },
  { label: '코디',        depts: ['코디'],               color: '#0369a1' },
  { label: '간호',        depts: ['간호'],               color: '#047857' },
  { label: '피부1(시술)', depts: ['피부1(시술)'],        color: '#9d174d' },
  { label: '피부2(관리)', depts: ['피부2(관리)'],        color: '#92400e' },
  { label: '마케팅',      depts: ['마케팅'],             color: '#0f766e' },
  { label: '미분류',      depts: ['미분류'],             color: '#6b7280' },
]

// 근무표 화면·이미지에 실제로 표시할 그룹 (마케팅·미분류 제외 — 근무 파트만)
export const SCHEDULE_VISIBLE_GROUPS = SCHEDULE_GROUPS.filter(
  g => g.label !== '마케팅' && g.label !== '미분류'
)

// 근무 교환 가능 "파트 그룹" — 총괄실장+실장, 대표원장+부원장은 같은 파트로 묶임 (DB swap_group과 일치)
export const swapGroupOf = (dept: string): string =>
  SCHEDULE_GROUPS.find(g => g.depts.includes(dept))?.label ?? dept

export const DEFAULT_OFF_QUOTAS: Record<string, number> = {
  '실장': 1, '코디': 1, '간호': 1, '피부1(시술)': 1, '피부2(관리)': 1,
}

export const DEPTS = ['대표원장','부원장','총괄실장','실장','코디','간호','피부1(시술)','피부2(관리)','마케팅','미분류'] as const
export type Dept = (typeof DEPTS)[number]

export const STATS_DEPTS = DEPTS.filter(d => d !== '마케팅' && d !== '미분류')

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

export const TEAM_GROUPS = [
  { label: '진료진', depts: ['대표원장', '부원장'],   color: '#1d4ed8' },
  { label: '실장',   depts: ['총괄실장', '실장'],     color: '#7c3aed' },
  { label: '코디',   depts: ['코디'],                 color: '#0369a1' },
  { label: '간호',   depts: ['간호'],                 color: '#047857' },
  { label: '피부1',  depts: ['피부1(시술)'],           color: '#9d174d' },
  { label: '피부2',  depts: ['피부2(관리)'],           color: '#92400e' },
  { label: '마케팅', depts: ['마케팅'],                color: '#0f766e' },
] as const

export const DEFAULT_OFF_QUOTAS: Record<string, number> = {
  '실장': 1, '코디': 1, '간호': 1, '피부1(시술)': 1, '피부2(관리)': 1,
}

import { useState } from 'react'
import { useAuth } from '../store/useAuth'
import { STATUS_CFG } from '../constants'

interface Section {
  icon: string
  title: string
  steps: string[]
}

const STATUS_LEGEND: Array<{ key: string; desc: string }> = [
  { key: 'D',   desc: '정상 근무' },
  { key: 'S',   desc: '추가 근무' },
  { key: 'H',   desc: '반차 (오전/오후)' },
  { key: 'Y',   desc: '연차 (휴가)' },
  { key: 'OFF', desc: '휴무 (오프)' },
]

const managerSections: Section[] = [
  {
    icon: '📊', title: '대시보드',
    steps: [
      '오늘 근무 중인 직원만 팀별로 표시됩니다.',
      '상단 카드에서 총원·근무·휴무·연차 인원을 한눈에 확인합니다.',
      '생일자가 있으면 상단에 배너로 표시됩니다.',
    ],
  },
  {
    icon: '🗓️', title: '근무표 작성',
    steps: [
      '셀을 클릭하면 근무 상태(D·S·H·Y·OFF)를 선택할 수 있습니다.',
      '키보드 단축키: D·S·H·Y·O 키로 빠르게 입력, 방향키로 셀 이동.',
      '셀 선택 후 "복사" 버튼 → 다른 셀들을 클릭하면 연속 붙여넣기(엑셀처럼). Esc로 취소.',
      '엑셀·이미지로 내보내거나 인쇄할 수 있습니다.',
      '작성이 끝나면 "확정"하면 직원에게 확정 상태로 표시됩니다.',
    ],
  },
  {
    icon: '🌴', title: '연차 관리',
    steps: [
      '연차 현황·내역·달력 탭으로 전체 직원 연차를 관리합니다.',
      '"연차 등록"으로 직원 대신 연차를 기입할 수 있습니다.',
      '실제 연차 사용 일수는 근무표의 연차(Y)·반차(H) 기준으로 자동 집계됩니다.',
      '총 연차 일수는 직원별로 직접 수정 가능합니다.',
    ],
  },
  {
    icon: '⏱️', title: '오버타임',
    steps: [
      '◀ ▶ 버튼으로 이전·다음 달 기록을 조회합니다.',
      '오버타임은 매월 1일 0시에 리셋됩니다(이월되지 않음).',
      '직원 카드를 클릭하면 전체 적립·사용 내역을 볼 수 있습니다.',
    ],
  },
  {
    icon: '👥', title: '직원·인사관리',
    steps: [
      '직원 명단에서 전체 재직자를 팀별로 확인합니다.',
      '인사관리에서 직원 신규 등록·수정·삭제가 가능합니다.',
      '급여는 "급여 보기" 토글로 가릴 수 있습니다.',
      '입퇴사 관리에서 입사·퇴사 이력을 기록합니다.',
    ],
  },
]

const staffSections: Section[] = [
  {
    icon: '📊', title: '대시보드',
    steps: [
      '오늘 근무 중인 동료를 팀별로 확인할 수 있습니다.',
    ],
  },
  {
    icon: '🗓️', title: '근무표 보기',
    steps: [
      '전체 직원의 근무표를 조회할 수 있습니다.',
      '"확정 전" 배너가 있으면 아직 변경될 수 있는 근무표입니다.',
      '확정된 근무표에서 본인 셀을 클릭하면 같은 팀 동료와 근무 교환을 신청할 수 있습니다.',
    ],
  },
  {
    icon: '🌴', title: '연차 신청',
    steps: [
      '"연차 신청"으로 연차·반차를 신청합니다(신청일시가 함께 기록됩니다).',
      '반차는 오전/오후를 선택하며 종료일은 시작일과 같습니다.',
      '신청 내역은 관리자가 근무표에 반영합니다.',
      '잔여 연차는 근무표의 연차(Y)·반차(H) 기준으로 계산됩니다.',
    ],
  },
  {
    icon: '⏱️', title: '오버타임 등록',
    steps: [
      '오버타임 적립·사용을 분 단위로 등록합니다.',
      '매월 1일 0시에 리셋됩니다(이월되지 않음).',
    ],
  },
]

export default function Guide() {
  const { profile } = useAuth()
  const level = profile?.level ?? 2
  const isManager = level <= 1
  const sections = isManager ? managerSections : staffSections
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-4 sm:p-6 max-w-3xl w-full mx-auto space-y-5">
        {/* 헤더 */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 sm:p-6 text-white">
          <div className="text-2xl mb-1">📖</div>
          <h1 className="text-lg sm:text-xl font-bold">사용 설명서</h1>
          <p className="text-blue-100 text-sm mt-1">
            {isManager ? '운영자' : '직원'}용 안내 · {profile?.name}님
          </p>
        </div>

        {/* 근무 상태 범례 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
          <div className="text-sm font-bold text-slate-700 mb-3">근무 상태 표기</div>
          <div className="flex flex-wrap gap-2">
            {STATUS_LEGEND.map(({ key, desc }) => {
              const cfg = STATUS_CFG[key]
              return (
                <div key={key} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                  <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 4, padding: '2px 7px', fontWeight: 800, fontSize: 12 }}>{key}</span>
                  <span className="text-xs text-slate-600">{desc}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 섹션 아코디언 */}
        <div className="space-y-3">
          {sections.map((sec, i) => {
            const isOpen = open === i
            return (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <button onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center gap-3 px-4 sm:px-5 py-4 text-left hover:bg-slate-50 transition-colors">
                  <span className="text-xl">{sec.icon}</span>
                  <span className="font-bold text-slate-800 flex-1">{sec.title}</span>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                    className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {isOpen && (
                  <ol className="px-4 sm:px-5 pb-4 space-y-2">
                    {sec.steps.map((step, j) => (
                      <li key={j} className="flex gap-3 text-sm text-slate-600">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">{j + 1}</span>
                        <span className="flex-1 leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )
          })}
        </div>

        {/* 문의 */}
        <div className="bg-slate-100 rounded-2xl p-4 sm:p-5 text-center">
          <p className="text-sm text-slate-500">
            궁금한 점이 있으면 관리자에게 문의하세요.
          </p>
        </div>
      </div>
    </div>
  )
}

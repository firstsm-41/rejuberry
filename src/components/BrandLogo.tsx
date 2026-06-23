import { useState } from 'react'

// 앱 로고 — 한 곳에서 관리.
// 사용법: 로고 파일을 public/logo.png 로 저장하면 자동으로 표시됩니다.
//   (다른 파일명/형식을 쓰려면 LOGO_URL 만 바꾸세요. 예: '/logo.svg')
// 파일이 없으면 핑크 그라데이션 'RB' 박스로 폴백합니다.
const LOGO_URL = '/logo.png'

export default function BrandLogo({
  size = 36,
  rounded = 'rounded-xl',
}: { size?: number; rounded?: string }) {
  const [failed, setFailed] = useState(false)

  if (!failed) {
    return (
      <div className={`bg-white flex items-center justify-center overflow-hidden flex-shrink-0 ${rounded}`}
        style={{ width: size, height: size }}>
        <img src={LOGO_URL} alt="리쥬베리 워크스페이스"
          onError={() => setFailed(true)}
          className="object-contain"
          style={{ width: size * 0.92, height: size * 0.92 }} />
      </div>
    )
  }

  // 폴백: 파일이 아직 없을 때
  return (
    <div
      className={`bg-gradient-to-br from-pink-300 to-pink-500 flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0 ${rounded}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      RB
    </div>
  )
}

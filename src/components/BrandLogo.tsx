// 앱 로고 — 한 곳에서 관리.
// 로고 이미지 파일을 받으면:
//   1) 파일을 src/assets/logo.png (또는 .svg) 로 저장
//   2) 아래 USE_IMAGE 를 true 로 바꾸고 import 주석을 해제
// 그러면 로그인·사이드바·모바일 상단바 로고가 한 번에 교체됩니다.

// import logoUrl from '../assets/logo.png'
const logoUrl = ''
const USE_IMAGE = false

export default function BrandLogo({
  size = 36,
  rounded = 'rounded-xl',
}: { size?: number; rounded?: string }) {
  if (USE_IMAGE && logoUrl) {
    return (
      <img src={logoUrl} alt="리쥬베리 워크스페이스"
        className={`object-cover ${rounded}`}
        style={{ width: size, height: size }} />
    )
  }
  return (
    <div
      className={`bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center text-white font-bold shadow-lg ${rounded}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      리
    </div>
  )
}

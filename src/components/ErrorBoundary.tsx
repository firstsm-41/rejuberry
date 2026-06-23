import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

// 렌더링 중 오류가 나면 앱이 하얗게 멈추지 않고 안내 화면을 보여준 뒤
// '홈으로 돌아가기'로 복구할 수 있게 합니다.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('앱 오류:', error, info)
  }

  handleHome = () => {
    // 전체 새로고침으로 상태를 깨끗하게 초기화하며 홈으로 이동
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-lg font-bold text-slate-800 mb-1.5">일시적인 오류가 발생했습니다</h1>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              잠시 후 다시 시도해주세요.<br />문제가 계속되면 관리자에게 문의해주세요.
            </p>
            <button onClick={this.handleHome}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
              홈으로 돌아가기
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

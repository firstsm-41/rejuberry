interface PageHeaderProps {
  title: string
  action?: React.ReactNode
}

export default function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
      <h1 className="text-lg font-bold text-slate-800">{title}</h1>
      {action && <div>{action}</div>}
    </div>
  )
}

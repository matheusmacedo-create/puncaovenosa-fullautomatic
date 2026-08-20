import { ArrowLeft } from 'lucide-react'

export function RedCross({ className = '' }: { className?: string }) {
  return <span className={`red-cross ${className}`} aria-hidden="true"><i /><b /></span>
}

export function ClinicalHeader({ step, total = 9, back }: { step: number; total?: number; back?: () => void }) {
  return (
    <header className="clinical-header">
      <div className="clinical-identity">
        {back ? <button className="icon-button" onClick={back} aria-label="Voltar"><ArrowLeft /></button> : <RedCross />}
        <span>Curso de Punção Venosa</span>
      </div>
      <span className="step-code">ETAPA {step}/{total}</span>
    </header>
  )
}

export function VisualQr({ size = 'large' }: { size?: 'small' | 'large' }) {
  const cells = Array.from({ length: 169 }, (_, i) => {
    const x = i % 13; const y = Math.floor(i / 13)
    const finder = (x < 4 && y < 4) || (x > 8 && y < 4) || (x < 4 && y > 8)
    return finder || ((x * 7 + y * 11 + x * y) % 5 < 2)
  })
  return <div className={`visual-qr ${size}`} role="img" aria-label="QR Code de identificação">{cells.map((on, i) => <i key={i} className={on ? 'on' : ''} />)}</div>
}

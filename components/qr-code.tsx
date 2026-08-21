'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/**
 * QR Code de verdade — o que existia antes era um desenho decorativo, que
 * não codificava nada e por isso nenhum aplicativo conseguia ler.
 *
 * Gerado no navegador, a partir de uma string que já veio do nosso servidor.
 * Não há chamada a serviço externo: dado de aluno e código de pagamento não
 * precisam passar por terceiros só para virar imagem.
 *
 * Sai como PNG em data URL, e não como SVG injetado: evita `innerHTML` e
 * imprime bem, que é o caso de uso da ficha do aluno.
 */
export function CodigoQr({ conteudo, descricao, lado = 220 }: {
  conteudo: string | null | undefined
  descricao: string
  lado?: number
}) {
  const [imagem, setImagem] = useState<string | null>(null)
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    if (!conteudo) { setImagem(null); setFalhou(false); return }
    let cancelado = false
    QRCode.toDataURL(conteudo, {
      errorCorrectionLevel: 'M',
      margin: 1,
      // Resolução fixa e generosa: a tela escala por CSS e a impressão
      // aproveita os pixels extras.
      width: 512,
      color: { dark: '#111111', light: '#ffffff' },
    })
      .then(url => { if (!cancelado) { setImagem(url); setFalhou(false) } })
      .catch(() => { if (!cancelado) setFalhou(true) })
    return () => { cancelado = true }
  }, [conteudo])

  if (falhou) return <p className="qr-erro">Não foi possível gerar o QR Code. Use o código copia e cola.</p>
  if (!imagem) return <div className="qr-vazio" style={{ width: lado, height: lado }} aria-hidden="true" />

  // eslint-disable-next-line @next/next/no-img-element -- data URL local, sem otimização a fazer
  return <img className="qr-real" src={imagem} alt={descricao} width={lado} height={lado} />
}

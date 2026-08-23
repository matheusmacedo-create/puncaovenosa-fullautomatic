import Script from 'next/script'
import { PIXEL_ID } from '@/lib/pixel-id'

/**
 * Pixel do Meta, em todas as páginas.
 *
 * Só é renderizado quando existe um ID configurado — nenhum pixel fictício é
 * instalado.
 *
 * O `PageView` automático é pulado quando a página está dentro da gaveta da
 * landing. Ali há dois documentos vivos ao mesmo tempo, a landing e o funil,
 * e os dois carregariam o pixel: cada visitante contaria duas visitas, e todo
 * o custo por resultado sairia pela metade. Os eventos do funil continuam
 * saindo normalmente de dentro do iframe — o que não se repete é a visita.
 */
export function MetaPixel() {
  if (!PIXEL_ID) return null

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${PIXEL_ID}');
if (window.self === window.top) fbq('track', 'PageView');`}
    </Script>
  )
}

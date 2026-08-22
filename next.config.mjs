/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  /*
   * Carimba, no build, se o preço de teste estava definido.
   *
   * O navegador recebe `NEXT_PUBLIC_PRECO_TESTE_CENTAVOS` embutida no bundle,
   * congelada no momento do build; o servidor lê a mesma variável do ambiente
   * a cada requisição. Quando as duas discordam — variável marcada como
   * Sensitive na Vercel, que não existe durante o build, ou removida sem novo
   * deploy — a página anuncia um preço e a Únicopag cobra outro.
   *
   * Só o servidor consegue comparar os dois lados, e para isso precisa de um
   * valor que venha do build. `env` é resolvida aqui, em build, e é isso que
   * faz este carimbo funcionar onde uma leitura direta não funcionaria.
   */
  env: {
    PRECO_TESTE_CENTAVOS_NO_BUILD: process.env.NEXT_PUBLIC_PRECO_TESTE_CENTAVOS ?? '',
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
          // A landing abre o checkout numa gaveta em iframe. Mesma origem, e
          // só ela: nenhum outro site pode embutir o funil e colher os dados.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            // Report-Only: mede o que uma CSP real quebraria antes de ligá-la.
            key: 'Content-Security-Policy-Report-Only',
            value:
              "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://connect.facebook.net; frame-src 'self' https://www.google.com https://maps.google.com; frame-ancestors 'self'; connect-src 'self' https://www.facebook.com https://connect.facebook.net",
          },
        ],
      },
    ]
  },
}

export default nextConfig

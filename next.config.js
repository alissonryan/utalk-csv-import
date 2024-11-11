/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_UTALK_API_TOKEN: process.env.NEXT_PUBLIC_UTALK_API_TOKEN,
    NEXT_PUBLIC_UTALK_ORGANIZATION_ID: process.env.NEXT_PUBLIC_UTALK_ORGANIZATION_ID,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { 
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        ],
      },
    ]
  },
  // Configuração para proxy reverso
  async rewrites() {
    return [
      {
        source: '/api/utalk/:path*',
        destination: 'https://app-utalk.umbler.com/api/:path*'
      }
    ]
  }
}

module.exports = nextConfig 
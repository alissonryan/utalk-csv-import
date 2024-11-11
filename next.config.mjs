/** @type {import('next').NextConfig} */
const nextConfig = {
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
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-XSS-Protection', value: '1; mode=block' }
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
};

export default nextConfig;

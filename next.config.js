/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true
  },
  env: {
    UTALK_API_TOKEN: process.env.UTALK_API_TOKEN,
    ORGANIZATION_ID: process.env.ORGANIZATION_ID,
  },
}

module.exports = nextConfig 
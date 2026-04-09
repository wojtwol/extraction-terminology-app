/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
  webpack: (config) => {
    // Wymagane dla sql.js (SQLite w przeglądarce)
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    }
    return config
  },
}

module.exports = nextConfig

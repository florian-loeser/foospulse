/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Allow Railway to set hostname dynamically
  experimental: {
    // Needed for standalone mode with dynamic port
  },
}

module.exports = nextConfig

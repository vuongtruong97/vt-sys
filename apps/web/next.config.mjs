/** @type {import('next').NextConfig} */
const apiUrl = process.env.API_INTERNAL_URL || 'http://localhost:3001';

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Trình duyệt chỉ gọi /api/* trên cùng tên miền; Next chuyển tiếp sang API.
  // Nhờ vậy cookie đăng nhập là cookie cùng site.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;

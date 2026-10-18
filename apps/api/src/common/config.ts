function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Thiếu biến môi trường ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: required('JWT_SECRET'),
  whiteboardSecret: required('WHITEBOARD_SECRET'),
  cookieName: 'bd_session',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  /**
   * Số lớp X-Forwarded-For được tin, để đọc đúng IP người dùng (giới hạn số lần gọi theo IP).
   * Next.js rewrite chỉ đặt X-Forwarded-For khi request chưa có, không nối thêm; trên VPS Caddy
   * ghi đè header bằng IP thật nên 1 là đúng. Chạy trên máy (không có Caddy) thì người dùng
   * tự gửi header là giả được IP: chấp nhận được khi phát triển.
   */
  trustProxy: Number(process.env.TRUST_PROXY ?? 1),
  livekit: {
    apiKey: required('LIVEKIT_API_KEY'),
    apiSecret: required('LIVEKIT_API_SECRET'),
    /** URL nội bộ để API gọi RoomService, ví dụ http://livekit:7880 */
    serverUrl: required('LIVEKIT_URL'),
    /** URL trình duyệt dùng để kết nối, ví dụ ws://localhost:7880 */
    publicUrl: required('LIVEKIT_PUBLIC_URL'),
  },
  /**
   * Lưu trữ S3/R2 cho bản ghi hình và tài liệu. Bỏ trống S3_BUCKET thì hai tính năng này tắt.
   * Chạy trên máy dùng MinIO trong docker-compose.yml.
   */
  storage: {
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || 'auto',
    /** Địa chỉ API và Egress gọi tới, ví dụ http://minio:9000 hoặc https://<account>.r2.cloudflarestorage.com */
    endpoint: process.env.S3_ENDPOINT || '',
    /** Địa chỉ trình duyệt mở link tải. Mặc định bằng S3_ENDPOINT. */
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT || '',
    accessKey: process.env.S3_ACCESS_KEY || '',
    secretKey: process.env.S3_SECRET_KEY || '',
    /** MinIO cần true; R2 và AWS để false. */
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  },
  /** Gửi email qua Resend. Bỏ trống RESEND_API_KEY thì chỉ ghi log, không gửi. */
  email: {
    resendKey: process.env.RESEND_API_KEY || '',
    from: process.env.EMAIL_FROM || 'Bảng Đen <noreply@example.vn>',
  },
  /**
   * Đăng nhập bằng Google (OAuth). Bỏ trống thì ẩn nút. URI chuyển hướng cần khai báo
   * trong Google Cloud Console: `${APP_URL}/api/auth/google/callback`.
   */
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },
  /** Địa chỉ trang web, dùng cho link trong email và URI chuyển hướng của Google. */
  appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
  /** Dung lượng tối đa một tài liệu tải lên (MB). */
  maxMaterialMb: Number(process.env.MAX_MATERIAL_MB ?? 50),
  /** Học viên được vào lớp sớm bao nhiêu phút */
  openBeforeMinutes: 10,
  /** Học viên còn vào được bao lâu sau giờ kết thúc */
  closeAfterMinutes: 30,
};

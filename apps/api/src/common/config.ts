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
  livekit: {
    apiKey: required('LIVEKIT_API_KEY'),
    apiSecret: required('LIVEKIT_API_SECRET'),
    /** URL nội bộ để API gọi RoomService, ví dụ http://livekit:7880 */
    serverUrl: required('LIVEKIT_URL'),
    /** URL trình duyệt dùng để kết nối, ví dụ ws://localhost:7880 */
    publicUrl: required('LIVEKIT_PUBLIC_URL'),
  },
  /** Học viên được vào lớp sớm bao nhiêu phút */
  openBeforeMinutes: 10,
  /** Học viên còn vào được bao lâu sau giờ kết thúc */
  closeAfterMinutes: 30,
};

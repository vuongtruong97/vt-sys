// config.ts đọc biến môi trường ngay khi import; đặt giá trị giả cho test.
process.env.JWT_SECRET = 'test-jwt';
process.env.WHITEBOARD_SECRET = 'test-board';
process.env.LIVEKIT_API_KEY = 'test';
process.env.LIVEKIT_API_SECRET = 'test-secret-dai-it-nhat-32-ky-tu-cho-du';
process.env.LIVEKIT_URL = 'http://livekit.test:7880';
process.env.LIVEKIT_PUBLIC_URL = 'ws://livekit.test:7880';
process.env.REMINDERS = 'false';
process.env.TZ = 'Asia/Ho_Chi_Minh';

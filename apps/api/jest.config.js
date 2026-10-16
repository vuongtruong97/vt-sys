/** Test đơn vị cho API: chạy bằng `npm test`, không cần Postgres hay LiveKit (dùng mock). */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  setupFiles: ['<rootDir>/test/env.ts'],
  moduleNameMapper: { '^livekit-server-sdk$': '<rootDir>/test/livekit-stub.ts' },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { rootDir: '.', strict: true, esModuleInterop: true, experimentalDecorators: true, emitDecoratorMetadata: true, target: 'ES2021' } }],
  },
};

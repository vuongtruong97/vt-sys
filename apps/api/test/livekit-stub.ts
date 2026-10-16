/**
 * livekit-server-sdk chỉ có bản ESM; Jest (CommonJS) không nạp được.
 * Test dùng bản thay thế này: kiểu dữ liệu thật từ @livekit/protocol (có bản CommonJS),
 * còn các client gọi mạng là lớp rỗng — test luôn truyền mock thay cho chúng.
 */
export * from '@livekit/protocol';

class Noop {
  constructor(..._args: unknown[]) {}
}
export class RoomServiceClient extends Noop {}
export class EgressClient extends Noop {}
export class WebhookReceiver extends Noop {}
export class AccessToken extends Noop {}
export type VideoGrant = Record<string, unknown>;

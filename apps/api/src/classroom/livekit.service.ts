import { Injectable, Logger } from '@nestjs/common';
import { AccessToken, RoomServiceClient, TrackSource, VideoGrant } from 'livekit-server-sdk';
import { config } from '../common/config';

export type RoomMeta = { board: boolean; allowStudentShare: boolean };
export type RoomRole = 'teacher' | 'student';

const STUDENT_SOURCES = [TrackSource.CAMERA, TrackSource.MICROPHONE];
const SHARE_SOURCES = [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO];

@Injectable()
export class LivekitService {
  private log = new Logger('LiveKit');
  readonly rooms = new RoomServiceClient(config.livekit.serverUrl, config.livekit.apiKey, config.livekit.apiSecret);

  studentSources(allowShare: boolean) {
    return allowShare ? [...STUDENT_SOURCES, ...SHARE_SOURCES] : STUDENT_SOURCES;
  }

  async token(opts: {
    room: string;
    identity: string;
    name: string;
    role: RoomRole;
    allowStudentShare: boolean;
  }): Promise<string> {
    const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
      identity: opts.identity,
      name: opts.name,
      ttl: '10m',
      metadata: JSON.stringify({ role: opts.role }),
    });
    const grant: VideoGrant = {
      room: opts.room,
      roomJoin: true,
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
      // Cho phép tự đặt attribute "hand" khi giơ tay.
      canUpdateOwnMetadata: true,
      roomAdmin: opts.role === 'teacher',
    };
    if (opts.role === 'student') grant.canPublishSources = this.studentSources(opts.allowStudentShare);
    at.addGrant(grant);
    return at.toJwt();
  }

  /** Tạo phòng nếu chưa có; phòng đã có thì giữ nguyên. */
  async ensureRoom(name: string, meta: RoomMeta) {
    const existing = await this.rooms.listRooms([name]);
    if (existing.length) return existing[0];
    return this.rooms.createRoom({
      name,
      emptyTimeout: 15 * 60,
      maxParticipants: 60,
      metadata: JSON.stringify(meta),
    });
  }

  async readMeta(name: string): Promise<RoomMeta> {
    const [room] = await this.rooms.listRooms([name]);
    try {
      return { board: false, allowStudentShare: false, ...(room?.metadata ? JSON.parse(room.metadata) : {}) };
    } catch {
      return { board: false, allowStudentShare: false };
    }
  }

  async patchMeta(name: string, patch: Partial<RoomMeta>) {
    const meta = { ...(await this.readMeta(name)), ...patch };
    await this.rooms.updateRoomMetadata(name, JSON.stringify(meta));
    return meta;
  }

  async students(room: string) {
    const list = await this.rooms.listParticipants(room);
    return list.filter((p) => {
      try {
        return JSON.parse(p.metadata || '{}').role !== 'teacher';
      } catch {
        return true;
      }
    });
  }

  async muteMic(room: string, identity: string) {
    const p = await this.rooms.getParticipant(room, identity);
    for (const t of p.tracks) {
      if (t.source === TrackSource.MICROPHONE && !t.muted) {
        await this.rooms.mutePublishedTrack(room, identity, t.sid, true);
      }
    }
  }

  async setStudentShare(room: string, allow: boolean) {
    for (const p of await this.students(room)) {
      try {
        await this.rooms.updateParticipant(room, p.identity, {
          permission: {
            canSubscribe: true,
            canPublish: true,
            canPublishData: true,
            canUpdateMetadata: true,
            canPublishSources: this.studentSources(allow),
          },
        });
      } catch (e) {
        this.log.warn(`Không cập nhật được quyền của ${p.identity}: ${(e as Error).message}`);
      }
    }
  }
}

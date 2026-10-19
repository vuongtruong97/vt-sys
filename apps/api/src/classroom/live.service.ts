import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { ClassSession } from '@prisma/client';
import { EgressClient, EgressInfo, S3Upload, SegmentedFileOutput, SegmentedFileProtocol } from 'livekit-server-sdk';
import { config } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';
import { LivekitService } from './livekit.service';
import { egressStatus, requireRecording } from './recording.service';

/** Tên playlist người xem mở: chỉ chứa các đoạn gần nhất (cửa sổ trượt) nên tải nhanh. */
export const LIVE_PLAYLIST = 'live.m3u8';

/**
 * Phát trực tiếp cho lớp đông (webinar). Egress ghép phòng thành HLS, đẩy lên S3;
 * người xem tải playlist và đoạn video qua API (có thể đặt CDN phía trước), không vào phòng LiveKit.
 */
@Injectable()
export class LiveStreamService {
  private log = new Logger('Live');
  private egress = new EgressClient(config.livekit.serverUrl, config.livekit.apiKey, config.livekit.apiSecret);

  constructor(private prisma: PrismaService, private storage: StorageService, private lk: LivekitService) {}

  async start(s: ClassSession, isPublic: boolean) {
    requireRecording();
    this.storage.require();
    const current = await this.prisma.liveStream.findUnique({ where: { sessionId: s.id } });
    if (current && (current.status === 'STARTING' || current.status === 'RECORDING')) {
      throw new BadRequestException('Buổi học đang phát trực tiếp rồi');
    }
    const st = config.storage;
    const prefix = `live/${s.id}/${Date.now()}`;
    const output = new SegmentedFileOutput({
      protocol: SegmentedFileProtocol.HLS_PROTOCOL,
      filenamePrefix: `${prefix}/seg`,
      playlistName: 'index.m3u8',
      livePlaylistName: LIVE_PLAYLIST,
      segmentDuration: 4,
      output: {
        case: 's3',
        value: new S3Upload({
          accessKey: st.accessKey,
          secret: st.secretKey,
          region: st.region,
          endpoint: st.endpoint,
          bucket: st.bucket,
          forcePathStyle: st.forcePathStyle,
        }),
      },
    });
    let info: EgressInfo;
    try {
      info = await this.egress.startRoomCompositeEgress(s.roomName, output, { layout: 'speaker' });
    } catch (e) {
      this.log.warn(`Không bắt đầu được phát trực tiếp ${s.roomName}: ${(e as Error).message}`);
      throw new BadRequestException('Không bắt đầu được phát trực tiếp. Kiểm tra dịch vụ egress đã chạy chưa.');
    }
    // Mỗi buổi giữ một luồng: phát lại thì thay luồng cũ.
    const data = { egressId: info.egressId, status: 'STARTING' as const, public: isPublic, prefix, error: null, startedAt: new Date(), endedAt: null };
    const live = await this.prisma.liveStream.upsert({ where: { sessionId: s.id }, create: { sessionId: s.id, ...data }, update: data });
    await this.lk.patchMeta(s.roomName, { live: true });
    return live;
  }

  async stop(s: ClassSession) {
    const live = await this.prisma.liveStream.findUnique({ where: { sessionId: s.id } });
    if (!live || (live.status !== 'STARTING' && live.status !== 'RECORDING')) throw new BadRequestException('Buổi học không đang phát trực tiếp');
    try {
      await this.egress.stopEgress(live.egressId);
    } catch (e) {
      this.log.debug(`stopEgress ${live.egressId}: ${(e as Error).message}`);
    }
    await this.prisma.liveStream.update({ where: { id: live.id }, data: { status: 'PROCESSING' } });
    await this.lk.patchMeta(s.roomName, { live: false });
  }

  /** Gọi từ webhook egress_*. Trả về true nếu egress này là luồng phát trực tiếp. */
  async onEgress(info: EgressInfo) {
    const live = await this.prisma.liveStream.findUnique({ where: { egressId: info.egressId } });
    if (!live) return false;
    const status = egressStatus(info, live.status);
    const done = status === 'READY' || status === 'FAILED';
    await this.prisma.liveStream.update({
      where: { id: live.id },
      data: { status, error: status === 'FAILED' ? info.error || 'Phát trực tiếp thất bại' : null, endedAt: done ? new Date() : undefined },
    });
    if (done) {
      const s = await this.prisma.classSession.findUnique({ where: { id: live.sessionId } });
      if (s) await this.lk.patchMeta(s.roomName, { live: false }).catch(() => {});
    }
    return true;
  }
}

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { ClassSession, RecordingStatus } from '@prisma/client';
import {
  EgressClient,
  EgressInfo,
  EgressStatus,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
} from 'livekit-server-sdk';
import { config } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';
import { LivekitService } from './livekit.service';

/** Trạng thái egress của LiveKit → trạng thái lưu trong DB (dùng chung cho ghi hình và phát trực tiếp). */
export function egressStatus(info: EgressInfo, current: RecordingStatus): RecordingStatus {
  switch (info.status) {
    case EgressStatus.EGRESS_ACTIVE:
      return 'RECORDING';
    case EgressStatus.EGRESS_ENDING:
      return 'PROCESSING';
    case EgressStatus.EGRESS_COMPLETE:
      return 'READY';
    case EgressStatus.EGRESS_FAILED:
    case EgressStatus.EGRESS_ABORTED:
      return 'FAILED';
    default:
      return current;
  }
}

/**
 * Ghi hình bằng LiveKit Egress (RoomComposite: ghép cả phòng thành một video).
 * Egress tự tải MP4 lên bucket; webhook egress_* cập nhật trạng thái bản ghi.
 */
@Injectable()
export class RecordingService {
  private log = new Logger('Recording');
  private egress = new EgressClient(config.livekit.serverUrl, config.livekit.apiKey, config.livekit.apiSecret);

  constructor(private prisma: PrismaService, private storage: StorageService, private lk: LivekitService) {}

  active(sessionId: string) {
    return this.prisma.recording.findFirst({
      where: { sessionId, status: { in: ['STARTING', 'RECORDING'] } },
      orderBy: { startedAt: 'desc' },
    });
  }

  async start(s: ClassSession) {
    this.storage.require();
    if (await this.active(s.id)) throw new BadRequestException('Buổi học đang được ghi hình rồi');
    const st = config.storage;
    const key = `recordings/${s.id}/${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`;
    const output = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: key,
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
      // "speaker": người đang nói / màn hình chia sẻ ở giữa, các camera khác ở dải bên.
      info = await this.egress.startRoomCompositeEgress(s.roomName, output, { layout: 'speaker' });
    } catch (e) {
      this.log.warn(`Không bắt đầu được ghi hình ${s.roomName}: ${(e as Error).message}`);
      throw new BadRequestException('Không bắt đầu được ghi hình. Kiểm tra dịch vụ egress đã chạy chưa.');
    }
    const rec = await this.prisma.recording.create({ data: { sessionId: s.id, egressId: info.egressId, key } });
    await this.lk.patchMeta(s.roomName, { recording: true });
    return rec;
  }

  async stop(s: ClassSession) {
    const rec = await this.active(s.id);
    if (!rec) throw new BadRequestException('Buổi học không đang ghi hình');
    try {
      await this.egress.stopEgress(rec.egressId);
    } catch (e) {
      // Egress đã dừng (ví dụ phòng đóng): webhook egress_ended sẽ cập nhật trạng thái.
      this.log.debug(`stopEgress ${rec.egressId}: ${(e as Error).message}`);
    }
    await this.prisma.recording.update({ where: { id: rec.id }, data: { status: 'PROCESSING' } });
    await this.lk.patchMeta(s.roomName, { recording: false });
  }

  /** Gọi từ webhook egress_started / egress_updated / egress_ended. */
  async onEgress(info: EgressInfo) {
    const rec = await this.prisma.recording.findUnique({ where: { egressId: info.egressId } });
    if (!rec) return;
    const file = info.fileResults?.[0];
    const status = egressStatus(info, rec.status);
    const done = status === 'READY' || status === 'FAILED';
    await this.prisma.recording.update({
      where: { id: rec.id },
      data: {
        status,
        error: status === 'FAILED' ? info.error || 'Ghi hình thất bại' : null,
        // Duration của egress tính bằng nano giây.
        durationSec: file?.duration ? Number(file.duration / 1_000_000_000n) : undefined,
        sizeBytes: file?.size ? file.size : undefined,
        endedAt: done ? new Date() : undefined,
      },
    });
    if (done) {
      const s = await this.prisma.classSession.findUnique({ where: { id: rec.sessionId } });
      // Phòng có thể đã đóng trước khi egress kết thúc.
      if (s) await this.lk.patchMeta(s.roomName, { recording: false }).catch(() => {});
    }
  }
}

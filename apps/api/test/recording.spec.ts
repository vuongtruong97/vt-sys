import { ServiceUnavailableException } from '@nestjs/common';
import { FileInfo } from '@livekit/protocol';
import { EgressInfo, EgressStatus } from 'livekit-server-sdk';
import { RecordingService } from '../src/classroom/recording.service';
import { mockLivekit, mockPrisma, session } from './helpers';

function setup(storageEnabled = true) {
  const prisma = mockPrisma();
  const lk = mockLivekit();
  const storage = {
    enabled: storageEnabled,
    require: jest.fn(() => {
      if (!storageEnabled) throw new ServiceUnavailableException('Chưa cấu hình nơi lưu trữ');
    }),
  };
  prisma.recording.findUnique.mockResolvedValue({ id: 'r1', egressId: 'EG_1', sessionId: 's1', status: 'RECORDING' });
  prisma.classSession.findUnique.mockResolvedValue(session());
  return { prisma, lk, svc: new RecordingService(prisma as any, storage as any, lk as any) };
}

const info = (status: EgressStatus, extra: Partial<EgressInfo> = {}) => new EgressInfo({ egressId: 'EG_1', status, ...extra });

describe('Ghi hình', () => {
  it('chưa cấu hình lưu trữ thì báo lỗi rõ ràng, không gọi egress', async () => {
    const { svc, prisma } = setup(false);
    await expect(svc.start(session() as any)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.recording.create).not.toHaveBeenCalled();
  });

  it('không cho ghi hai bản cùng lúc', async () => {
    const { svc, prisma } = setup();
    prisma.recording.findFirst.mockResolvedValue({ id: 'r0' });
    await expect(svc.start(session() as any)).rejects.toThrow('đang được ghi hình');
  });

  it('egress xong: đánh dấu READY, đổi thời lượng từ nano giây sang giây, tắt cờ đang ghi', async () => {
    const { svc, prisma, lk } = setup();
    await svc.onEgress(
      info(EgressStatus.EGRESS_COMPLETE, {
        fileResults: [new FileInfo({ duration: 125n * 1_000_000_000n, size: 4_200_000n })],
      }),
    );
    expect(prisma.recording.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: expect.objectContaining({ status: 'READY', durationSec: 125, sizeBytes: 4_200_000n, error: null }),
    });
    expect(lk.patchMeta).toHaveBeenCalledWith('bd-room', { recording: false });
  });

  it('egress lỗi: lưu thông báo lỗi', async () => {
    const { svc, prisma } = setup();
    await svc.onEgress(info(EgressStatus.EGRESS_FAILED, { error: 'không tải lên được S3' }));
    expect(prisma.recording.update.mock.calls[0][0].data).toMatchObject({ status: 'FAILED', error: 'không tải lên được S3' });
  });

  it('egress đang chạy: chuyển sang RECORDING, chưa đặt giờ kết thúc', async () => {
    const { svc, prisma, lk } = setup();
    await svc.onEgress(info(EgressStatus.EGRESS_ACTIVE));
    const data = prisma.recording.update.mock.calls[0][0].data;
    expect(data.status).toBe('RECORDING');
    expect(data.endedAt).toBeUndefined();
    expect(lk.patchMeta).not.toHaveBeenCalled();
  });

  it('bỏ qua egress không phải của hệ thống', async () => {
    const { svc, prisma } = setup();
    prisma.recording.findUnique.mockResolvedValue(null);
    await svc.onEgress(info(EgressStatus.EGRESS_COMPLETE));
    expect(prisma.recording.update).not.toHaveBeenCalled();
  });
});

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Global, Injectable, Module, ServiceUnavailableException } from '@nestjs/common';
import { config } from './config';

const s = config.storage;

/** Lưu file lên S3/R2/MinIO. Link tải là URL ký có hạn, không để bucket công khai. */
@Injectable()
export class StorageService {
  readonly enabled = !!(s.bucket && s.endpoint && s.accessKey && s.secretKey);

  private client(endpoint: string) {
    return new S3Client({
      region: s.region,
      endpoint,
      forcePathStyle: s.forcePathStyle,
      credentials: { accessKeyId: s.accessKey, secretAccessKey: s.secretKey },
    });
  }
  private internal = this.enabled ? this.client(s.endpoint) : null;
  /** Ký URL bằng địa chỉ trình duyệt truy cập được (chữ ký gắn với host). */
  private publicSigner = this.enabled ? this.client(s.publicEndpoint) : null;

  require() {
    if (!this.enabled) {
      throw new ServiceUnavailableException('Chưa cấu hình nơi lưu trữ (S3_BUCKET, S3_ENDPOINT…), tính năng này đang tắt');
    }
  }

  async put(key: string, body: Buffer, contentType: string) {
    this.require();
    await this.internal!.send(new PutObjectCommand({ Bucket: s.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async remove(key: string) {
    this.require();
    await this.internal!.send(new DeleteObjectCommand({ Bucket: s.bucket, Key: key }));
  }

  /** URL tải có hạn; `filename` đặt tên file khi trình duyệt lưu về. */
  async downloadUrl(key: string, filename?: string, expiresIn = 3600) {
    this.require();
    return getSignedUrl(
      this.publicSigner!,
      new GetObjectCommand({
        Bucket: s.bucket,
        Key: key,
        ResponseContentDisposition: filename ? `inline; filename*=UTF-8''${encodeURIComponent(filename)}` : undefined,
      }),
      { expiresIn },
    );
  }
}

@Global()
@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}

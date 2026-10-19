'use client';
/**
 * Nạp GeoGebra (deployggb.js) một lần cho cả app và khai báo phần Apps API vt-sys dùng.
 * Mặc định lấy từ CDN của GeoGebra; tự host thì đặt NEXT_PUBLIC_GGB_SRC và NEXT_PUBLIC_GGB_CODEBASE
 * (thư mục HTML5/5.0/web3d/ của GeoGebra Math Apps Bundle).
 * Giấy phép: dùng theo GeoGebra Non-Commercial License (dạy không thu phí). Thu phí thì phải ký với GeoGebra.
 */

export const GGB_SRC = process.env.NEXT_PUBLIC_GGB_SRC || 'https://www.geogebra.org/apps/deployggb.js';
export const GGB_CODEBASE = process.env.NEXT_PUBLIC_GGB_CODEBASE || '';

/** Các hàm của GeoGebra Apps API mà vt-sys gọi (đủ cho lưu/mở, dựng hình, đọc dữ liệu, đồng bộ). */
export interface GgbApi {
  getBase64(): string;
  setBase64(base64: string, callback?: () => void): void;
  getXML(objName?: string): string;
  setXML(xml: string): void;
  evalXML(xml: string): void;
  evalCommand(cmd: string): boolean;
  deleteObject(name: string): void;
  exists(name: string): boolean;
  isIndependent(name: string): boolean;
  getAllObjectNames(type?: string): string[];
  getValue(name: string): number;
  getValueString(name: string): string;
  getObjectType(name: string): string;
  getXcoord(name: string): number;
  getYcoord(name: string): number;
  getZcoord(name: string): number;
  setCoords(name: string, x: number, y: number, z?: number): void;
  setValue(name: string, value: number): void;
  setFixed(name: string, fixed: boolean, selectionAllowed?: boolean): void;
  setVisible(name: string, visible: boolean): void;
  getPNGBase64(exportScale: number, transparent: boolean, dpi?: number): string;
  setSize(width: number, height: number): void;
  setMode(mode: number): void;
  getMode(): number;
  /** Bố cục: 'G' chỉ vùng hình vẽ, 'AG' danh sách đối tượng + hình vẽ… */
  setPerspective(perspective: string): void;
  /** JSON: xMin, yMin, invXscale, invYscale, width, height của vùng hình vẽ đang hoạt động. */
  getViewProperties(): string;
  registerAddListener(fn: (name: string) => void): void;
  registerRemoveListener(fn: (name: string) => void): void;
  registerUpdateListener(fn: (name: string) => void): void;
  registerRenameListener(fn: (oldName: string, newName: string) => void): void;
  unregisterAddListener(fn: (name: string) => void): void;
  unregisterRemoveListener(fn: (name: string) => void): void;
  unregisterUpdateListener(fn: (name: string) => void): void;
  unregisterRenameListener(fn: (oldName: string, newName: string) => void): void;
  remove?(): void;
}

type GGBAppletCtor = new (params: Record<string, unknown>, html5NoWebSimple?: boolean) => {
  inject(containerId: string): void;
  setHTML5Codebase(path: string): void;
};

let loader: Promise<void> | undefined;

/** Nạp deployggb.js một lần; lỗi mạng thì lần sau thử lại. */
export function loadGeoGebra(src = GGB_SRC): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('GeoGebra chỉ chạy trên trình duyệt'));
  if ((window as unknown as { GGBApplet?: unknown }).GGBApplet) return Promise.resolve();
  loader ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loader = undefined;
      s.remove();
      reject(new Error('Không tải được GeoGebra'));
    };
    document.head.appendChild(s);
  });
  return loader;
}

export const GGBApplet = () => (window as unknown as { GGBApplet: GGBAppletCtor }).GGBApplet;

/**
 * 客戶端圖片壓縮工具 (Client-side Image Compressor)
 * 適用於移動端拍照原圖 (5MB~15MB) 快速縮放與壓縮，
 * 確保 Base64 傳輸至 AI 視覺 API 時體積控制在 150KB~350KB 內，提升響應速度並降低逾時風險。
 */

export interface CompressOptions {
  /** 長邊最大像素，預設 1024px */
  maxDimension?: number;
  /** JPEG 壓縮品質 (0.1 ~ 1.0)，預設 0.8 */
  quality?: number;
}

export interface CompressedImageResult {
  /** 純 Base64 字串（不含 data:image/jpeg;base64, 前綴） */
  base64: string;
  /** 完整的 Data URL（可用於 <img src="...">） */
  dataUrl: string;
  /** MIME 類型，固定為 'image/jpeg' */
  mimeType: 'image/jpeg';
  /** 壓縮後寬度 */
  width: number;
  /** 壓縮後高度 */
  height: number;
  /** 壓縮後位元組估算 */
  sizeInBytes: number;
}

/**
 * 讀取 File / Blob 並進行前端等比縮放壓縮
 */
export async function compressImage(
  fileOrBlob: Blob | File,
  options: CompressOptions = {}
): Promise<CompressedImageResult> {
  const { maxDimension = 1024, quality = 0.8 } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image into DOM'));
      img.onload = () => {
        try {
          let { width, height } = img;

          // 計算等比縮放
          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          // 繪製至 Canvas
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas 2D context'));
            return;
          }

          // 填充白底避免透明 PNG 變黑底
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);

          ctx.drawImage(img, 0, 0, width, height);

          const mimeType = 'image/jpeg';
          const dataUrl = canvas.toDataURL(mimeType, quality);
          const prefix = `data:${mimeType};base64,`;
          const base64 = dataUrl.startsWith(prefix) ? dataUrl.slice(prefix.length) : dataUrl;

          // 計算大約位元組數 (Base64 長度 * 3/4)
          const sizeInBytes = Math.round((base64.length * 3) / 4);

          resolve({
            base64,
            dataUrl,
            mimeType,
            width,
            height,
            sizeInBytes,
          });
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(fileOrBlob);
  });
}

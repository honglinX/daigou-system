import { createWorker } from 'tesseract.js';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

/** 
 * 仅条码识别 v14.0 - 极致速度版
 */
export async function scanBarcodeFromImage(image: Blob | string | Buffer): Promise<string> {
  if (!(image instanceof Blob)) return '';

  const img = await loadImage(image);
  
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13, 
    BarcodeFormat.UPC_A, 
    BarcodeFormat.UPC_E, 
    BarcodeFormat.EAN_8, 
    BarcodeFormat.CODE_128,
    BarcodeFormat.ITF,
    BarcodeFormat.QR_CODE
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new BrowserMultiFormatReader(hints);
  
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    canvas.getContext('2d', { willReadFrequently: true })!.drawImage(img, 0, 0);
    const result = await reader.decodeFromCanvas(canvas);
    return result?.getText() || '';
  } catch (err) {
    console.log("Barcode detection failed:", err);
    return '';
  }
}

/** 
 * 全图博弈识别 v13.0 - 极致稳定性版 (保留用于老旧兼容或复杂解析)
 */
export async function recognizeProductTagFromImage(image: Blob | string | Buffer): Promise<string> {
  if (!(image instanceof Blob)) return '';

  const img = await loadImage(image);
  
  // 1. 条码先行
  const barcode = await scanBarcodeFromImage(image);

  // 2. OCR 辅助全图扫描
  const ocrCanvas = document.createElement('canvas');
  const targetW = 2000; 
  const scale = targetW / img.width;
  ocrCanvas.width = targetW;
  ocrCanvas.height = img.height * scale;
  const ocrCtx = ocrCanvas.getContext('2d')!;
  ocrCtx.fillStyle = 'white';
  ocrCtx.fillRect(0, 0, ocrCanvas.width, ocrCanvas.height);
  ocrCtx.filter = 'contrast(1.6) grayscale(1)'; 
  ocrCtx.drawImage(img, 0, 0, targetW, ocrCanvas.height);

  const worker = await createWorker('eng', 1);
  await (worker as any).setParameters({ tessedit_pageseg_mode: '3' });
  const { data: { text } } = await worker.recognize(ocrCanvas.toDataURL());
  await worker.terminate();

  return `__RAW_TEXT__\n${text}\n__BARCODE__\n${barcode}`;
}

export async function recognizeAddressFromImage(image: Blob | string | Buffer): Promise<string> {
  if (!(image instanceof Blob)) return '';
  const worker = await createWorker('chi_sim', 1);
  const { data: { text } } = await worker.recognize(image);
  await worker.terminate();
  return text.replace(/\s+/g, '');
}

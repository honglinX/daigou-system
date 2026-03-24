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
 * 全图博弈识别 v13.0 - 极致稳定性版
 */
export async function recognizeProductTagFromImage(image: Blob | string | Buffer): Promise<string> {
  if (!(image instanceof Blob)) return '';

  const img = await loadImage(image);
  
  // 1. 条码先行 (ZXing 是地基)
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.UPC_A, BarcodeFormat.CODE_128]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new BrowserMultiFormatReader(hints);
  let barcode = '';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    const result = await reader.decodeFromCanvas(canvas);
    barcode = result?.getText() || '';
  } catch {}

  // 2. OCR 辅助全图扫描
  const ocrCanvas = document.createElement('canvas');
  const targetW = 2500; // 黄金分辨率
  const scale = targetW / img.width;
  ocrCanvas.width = targetW;
  ocrCanvas.height = img.height * scale;
  const ocrCtx = ocrCanvas.getContext('2d')!;
  ocrCtx.fillStyle = 'white';
  ocrCtx.fillRect(0, 0, ocrCanvas.width, ocrCanvas.height);
  ocrCtx.filter = 'contrast(1.8) grayscale(1)'; 
  ocrCtx.drawImage(img, 0, 0, targetW, ocrCanvas.height);

  // 使用 eng 模型，保证速度和全平台兼容性
  const worker = await createWorker('eng', 1);
  // PSM 3 是自动模式，PSM 11 是寻找稀疏文字，这里选 3 保证逻辑行不被打碎
  await (worker as any).setParameters({ tessedit_pageseg_mode: '3' });
  
  const { data: { text } } = await worker.recognize(ocrCanvas.toDataURL());
  await worker.terminate();

  // 返回原始文本和条码，让前端进行「候选人博弈」
  return `__RAW_TEXT__\n${text}\n__BARCODE__\n${barcode}`;
}

export async function recognizeAddressFromImage(image: Blob | string | Buffer): Promise<string> {
  if (!(image instanceof Blob)) return '';
  const worker = await createWorker('chi_sim', 1);
  const { data: { text } } = await worker.recognize(image);
  await worker.terminate();
  return text.replace(/\s+/g, '');
}

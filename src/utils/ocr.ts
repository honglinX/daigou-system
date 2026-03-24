import { createWorker } from 'tesseract.js';

export async function recognizeImageText(image: File | string | Buffer, preserveSpaces = false): Promise<string> {
  // chi_sim 已经内置了英文字母和数字的识别模型
  const worker = await createWorker('chi_sim', 1, {
    cacheMethod: 'write', // 强制走本地缓存，零成本
  });
  
  const { data: { text } } = await worker.recognize(image);
  await worker.terminate();
  
  if (preserveSpaces) {
      return text;
  }
  
  // 针对中国物流地址等大文本连续读取：清除随意穿插的空格
  return text.replace(/\s+/g, '');
}

export async function recognizeAddressFromImage(image: File | string | Buffer): Promise<string> {
   return recognizeImageText(image, false);
}

export async function recognizeProductTagFromImage(image: File | string | Buffer): Promise<string> {
   // 商品吊牌需要保留英文单词和尺码数字之间的空格，方便正则结构化提取
   return recognizeImageText(image, true);
}

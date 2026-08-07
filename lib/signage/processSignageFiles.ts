import { compressFile } from '@lib/ImageCompressor';
import { convertToBase64 } from '@lib/Base64Converter';
import { pdfToImageFiles } from '@lib/pdf/pdfToImages';
import { alertService } from '@lib/alertService';
import { i18n } from '@lib/i18n/client';

export async function processSignageFiles(files: File[]): Promise<string[]> {
  const slides: string[] = [];

  for (const file of files) {
    try {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const pageFiles = await pdfToImageFiles(file);
        for (const pageFile of pageFiles) {
          const compressed = await compressFile(pageFile);
          slides.push(await convertToBase64(compressed));
        }
        continue;
      }

      if (!file.type.startsWith('image/')) {
        alertService.error(i18n.t('manage:monitor.unsupportedFileType', { name: file.name }));
        continue;
      }

      const compressed = await compressFile(file);
      slides.push(await convertToBase64(compressed));
    } catch (error) {
      console.error('processSignageFiles', error);
      alertService.error(i18n.t('manage:monitor.errorProcessFile', { name: file.name }));
    }
  }

  return slides;
}

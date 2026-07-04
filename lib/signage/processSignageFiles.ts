import { compressFile } from '@lib/ImageCompressor';
import { convertToBase64 } from '@lib/Base64Converter';
import { pdfToImageFiles } from '@lib/pdf/pdfToImages';
import { alertService } from '@lib/alertService';

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
        alertService.error(`Dateityp nicht unterstützt: ${file.name}`);
        continue;
      }

      const compressed = await compressFile(file);
      slides.push(await convertToBase64(compressed));
    } catch (error) {
      console.error('processSignageFiles', error);
      alertService.error(`Fehler beim Verarbeiten von ${file.name}`);
    }
  }

  return slides;
}

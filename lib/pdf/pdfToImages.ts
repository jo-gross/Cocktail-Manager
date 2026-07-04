export interface PdfToImagesOptions {
  scale?: number;
}

async function getPdfJs() {
  const pdfjs = await import('pdfjs-dist');

  if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  }

  return pdfjs;
}

export async function pdfToImageFiles(file: File, options: PdfToImagesOptions = {}): Promise<File[]> {
  const { scale = 2 } = options;
  const pdfjs = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const imageFiles: File[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not create canvas context for PDF rendering.');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error(`Failed to convert PDF page ${pageNumber} to image.`));
          }
        },
        'image/jpeg',
        0.9,
      );
    });

    imageFiles.push(new File([blob], `${file.name.replace(/\.pdf$/i, '')}-page-${pageNumber}.jpg`, { type: 'image/jpeg' }));
  }

  return imageFiles;
}

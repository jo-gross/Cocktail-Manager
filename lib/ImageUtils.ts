import { i18n } from '@lib/i18n/client';

/**
 * Automatically embed an image into a target aspect ratio.
 * The full image stays visible; transparent padding is added to reach the aspect ratio.
 *
 * @param file - Image file to embed
 * @param aspect - Target aspect ratio (e.g. 1 for square, 9/16 for portrait)
 * @param backgroundColor - Optional background ('transparent' or hex like '#ffffff')
 * @returns Promise with the embedded image as a File
 */
export async function autoCropImage(file: File, aspect: number = 1, backgroundColor: string = 'transparent'): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;

      if (imgWidth === 0 || imgHeight === 0) {
        reject(new Error(i18n.t('errors:invalidImageDimensions')));
        return;
      }

      const imgAspect = imgWidth / imgHeight;
      let canvasWidth: number;
      let canvasHeight: number;

      // Berechne die Canvas-Dimensionen basierend auf dem gewünschten Aspect-Ratio
      // Das gesamte Bild soll sichtbar bleiben
      if (!aspect || aspect === 1) {
        // Quadratisch: Nimm die größere Dimension als Basis
        if (imgWidth >= imgHeight) {
          canvasWidth = imgWidth;
          canvasHeight = imgWidth;
        } else {
          canvasWidth = imgHeight;
          canvasHeight = imgHeight;
        }
      } else if (aspect > 1) {
        // Breiter als hoch (z.B. 16/9)
        if (imgAspect >= aspect) {
          // Bild ist breiter als gewünschtes Aspect-Ratio - verwende Bildbreite
          canvasWidth = imgWidth;
          canvasHeight = imgWidth / aspect;
        } else {
          // Bild ist schmaler als gewünschtes Aspect-Ratio - verwende Bildhöhe
          canvasHeight = imgHeight;
          canvasWidth = imgHeight * aspect;
        }
      } else {
        // Höher als breit (z.B. 9/16)
        if (imgAspect >= aspect) {
          // Bild ist breiter als gewünschtes Aspect-Ratio - verwende Bildbreite
          canvasWidth = imgWidth;
          canvasHeight = imgWidth / aspect;
        } else {
          // Bild ist schmaler als gewünschtes Aspect-Ratio - verwende Bildhöhe
          canvasHeight = imgHeight;
          canvasWidth = imgHeight * aspect;
        }
      }

      // Berechne die Position und Größe des Bildes im Canvas (zentriert)
      const drawWidth = imgWidth;
      const drawHeight = imgHeight;
      const imgX = (canvasWidth - drawWidth) / 2;
      const imgY = (canvasHeight - drawHeight) / 2;

      // Erstelle ein Canvas mit den berechneten Dimensionen
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d', { alpha: true });

      if (!ctx) {
        reject(new Error(i18n.t('errors:canvasContextFailed')));
        return;
      }

      // Setze den Hintergrund (wenn nicht transparent)
      if (backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      // Wenn transparent, bleibt der Canvas transparent (alpha channel)

      // Zeichne das gesamte Bild zentriert auf das Canvas
      ctx.drawImage(img, imgX, imgY, drawWidth, drawHeight);

      // Konvertiere Canvas zu Blob und dann zu File
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error(i18n.t('errors:canvasBlobFailed')));
            return;
          }
          resolve(new File([blob], 'image.png', { type: 'image/png' }));
        },
        'image/png',
        0.9, // Qualität
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(i18n.t('errors:loadImage')));
    };

    img.src = objectUrl;
  });
}

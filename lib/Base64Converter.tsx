export function convertToBase64(file: File): Promise<string> {
  const reader = new FileReader();
  return new Promise((resolve) => {
    reader.onload = (ev) => {
      resolve(ev?.target?.result as string);
    };
    reader.readAsDataURL(file);
  });
}

export function convertBase64ToFile(base64: string): File {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], 'convertImage.jpeg', { type: mime });
}

/** Fetch an image URL (e.g. v1 `imageUrl`) and return a data-URI base64 string. */
export async function fetchImageAsBase64(imageUrl: string): Promise<string | undefined> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return await new Promise<string | undefined>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

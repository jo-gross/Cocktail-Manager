import imageCompression from 'browser-image-compression';

const defaultOptions = {
  maxSizeMB: 0.5,
};
export function compressFile(imageFile: File, options = defaultOptions) {
  return imageCompression(imageFile, options);
}

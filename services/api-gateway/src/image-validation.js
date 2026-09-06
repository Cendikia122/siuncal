import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

export const publicReportMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/x-png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/octet-stream"
]);
export const publicReportExtByMime = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export class PublicReportImageValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PublicReportImageValidationError";
  }
}

const maxImagePixels = 40_000_000;
const maxImageDimension = 1600;
const defaultMaxOutputBytes = 5 * 1024 * 1024;

const validateContainerIntegrity = (buffer, mime) => {
  if (mime === "image/png") {
    if (buffer.length < 8 || buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47) {
      throw new PublicReportImageValidationError("Attachment gambar PNG rusak atau tidak valid");
    }
  }

  if (mime === "image/jpeg" || mime === "image/jpg") {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
      throw new PublicReportImageValidationError("Attachment gambar JPEG rusak atau tidak valid");
    }
  }

  if (mime === "image/webp") {
    if (buffer.length < 12 || buffer.subarray(0, 4).toString("ascii") !== "RIFF" || buffer.subarray(8, 12).toString("ascii") !== "WEBP") {
      throw new PublicReportImageValidationError("Attachment gambar WebP rusak atau tidak valid");
    }
  }
};

const reencodeImage = async (buffer, mime) => {
  const pipeline = sharp(buffer, {
    limitInputPixels: maxImagePixels,
    failOn: "none"
  })
    .rotate()
    .resize({
      width: maxImageDimension,
      height: maxImageDimension,
      fit: "inside",
      withoutEnlargement: true
    });

  if (mime === "image/png") {
    return pipeline.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
  }
  if (mime === "image/webp") {
    return pipeline.webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
  }
  return pipeline.jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
};

export const validatePublicReportEvidenceImage = async (file, { maxOutputBytes = defaultMaxOutputBytes } = {}) => {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new PublicReportImageValidationError("Attachment gambar kosong atau tidak valid");
  }

  const detected = await fileTypeFromBuffer(file.buffer);
  const detectedMime = detected?.mime;

  // Jika buffer terdeteksi sebagai format gambar yang valid
  let targetMime = "image/jpeg";
  if (detectedMime && (detectedMime === "image/jpeg" || detectedMime === "image/png" || detectedMime === "image/webp")) {
    targetMime = detectedMime;
  } else if (file.mimetype === "image/png") {
    targetMime = "image/png";
  } else if (file.mimetype === "image/webp") {
    targetMime = "image/webp";
  }

  validateContainerIntegrity(file.buffer, targetMime);

  let encoded;
  try {
    encoded = await reencodeImage(file.buffer, targetMime);
  } catch (err) {
    console.error("[image-validation] Sharp decode error:", err?.message || err);
    throw new PublicReportImageValidationError("Attachment gambar tidak dapat di-decode atau rusak");
  }

  const sanitizedBuffer = encoded.data;
  const width = Number(encoded.info.width || 0);
  const height = Number(encoded.info.height || 0);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new PublicReportImageValidationError("Dimensi attachment gambar tidak valid");
  }
  if (width * height > maxImagePixels) {
    throw new PublicReportImageValidationError("Resolusi attachment gambar terlalu besar");
  }
  if (sanitizedBuffer.length > maxOutputBytes) {
    throw new PublicReportImageValidationError("Ukuran attachment gambar hasil sanitasi terlalu besar");
  }

  const finalMime = encoded.info.format === "png" ? "image/png" : encoded.info.format === "webp" ? "image/webp" : "image/jpeg";

  return {
    buffer: sanitizedBuffer,
    contentType: finalMime,
    extension: publicReportExtByMime[finalMime] || "jpg",
    width,
    height,
    size: sanitizedBuffer.length,
    originalSize: file.buffer.length
  };
};

import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";

import { validatePublicReportEvidenceImage } from "../src/image-validation.js";

const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

const makeFile = ({ buffer = validPng, mimetype = "image/png" } = {}) => ({
  buffer,
  mimetype,
  size: buffer.length,
  originalname: "evidence.png"
});

test("public report evidence accepts and sanitizes a valid PNG image", async () => {
  const result = await validatePublicReportEvidenceImage(makeFile());

  assert.equal(result.contentType, "image/png");
  assert.equal(result.extension, "png");
  assert.equal(result.width, 1);
  assert.equal(result.height, 1);
  assert.ok(Buffer.isBuffer(result.buffer));
  assert.equal(result.size, result.buffer.length);
  assert.equal(result.originalSize, validPng.length);
});


for (const { format, mimetype } of [
  { format: "jpeg", mimetype: "image/jpeg" },
  { format: "png", mimetype: "image/png" },
  { format: "webp", mimetype: "image/webp" }
]) {
  test(`public report evidence strips ${format.toUpperCase()} GPS metadata during re-encode`, async () => {
    const input = await sharp({ create: { width: 2, height: 1, channels: 3, background: "#ff0000" } })
      .toFormat(format)
      .withExif({
        IFD0: { Artist: "Sensitive reporter device" },
        IFD3: {
          GPSLatitudeRef: "S",
          GPSLatitude: "6/1 35/1 0/1",
          GPSLongitudeRef: "E",
          GPSLongitude: "106/1 48/1 0/1"
        }
      })
      .toBuffer();

    const inputMetadata = await sharp(input).metadata();
    assert.ok(inputMetadata.exif);

    const result = await validatePublicReportEvidenceImage(makeFile({ buffer: input, mimetype }));
    const outputMetadata = await sharp(result.buffer).metadata();

    assert.equal(result.contentType, mimetype);
    assert.equal(outputMetadata.format, format);
    assert.equal(outputMetadata.exif, undefined);
  });
}

test("public report evidence clamps the longest side to 1600px", async () => {
  const input = await sharp({
    create: { width: 2000, height: 1000, channels: 3, background: "#336699" }
  }).jpeg().toBuffer();

  const result = await validatePublicReportEvidenceImage(makeFile({ buffer: input, mimetype: "image/jpeg" }));

  assert.equal(result.width, 1600);
  assert.equal(result.height, 800);
});

test("public report evidence does not upscale images already below the limit", async () => {
  const input = await sharp({
    create: { width: 800, height: 400, channels: 3, background: "#336699" }
  }).jpeg().toBuffer();

  const result = await validatePublicReportEvidenceImage(makeFile({ buffer: input, mimetype: "image/jpeg" }));

  assert.equal(result.width, 800);
  assert.equal(result.height, 400);
});

test("public report evidence rejects spoofed non-image content with image MIME", async () => {
  await assert.rejects(
    () => validatePublicReportEvidenceImage(makeFile({ buffer: Buffer.from("<html>not an image</html>") })),
    /JPEG, PNG, atau WebP valid/
  );
});

test("public report evidence rejects MIME mismatch", async () => {
  await assert.rejects(
    () => validatePublicReportEvidenceImage(makeFile({ mimetype: "image/jpeg" })),
    /Content-Type attachment tidak sesuai/
  );
});

test("public report evidence rejects truncated image data", async () => {
  await assert.rejects(
    () => validatePublicReportEvidenceImage(makeFile({ buffer: validPng.subarray(0, 16) })),
    /tidak dapat dibaca|valid/
  );
});

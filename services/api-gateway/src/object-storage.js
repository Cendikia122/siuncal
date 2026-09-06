import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListBucketsCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";

const endpoint = process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT || "";
const region = process.env.S3_REGION || "us-east-1";
const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.MINIO_ROOT_USER || "";
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.MINIO_ROOT_PASSWORD || "";
const bucket = process.env.PLAYBACK_RECORD_BUCKET || process.env.S3_BUCKET || "playback-records";
const publicReportBucket = process.env.PUBLIC_REPORT_BUCKET || "public-report-evidence";
const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT || process.env.MINIO_PUBLIC_ENDPOINT || endpoint;

const readyBuckets = new Set();

export const isObjectStorageConfigured = () => Boolean(endpoint && accessKeyId && secretAccessKey && bucket);
export const getPublicReportBucket = () => publicReportBucket;

const client = isObjectStorageConfigured()
  ? new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  })
  : null;

const ensureBucket = async (bucketName = bucket) => {
  if (!client || readyBuckets.has(bucketName)) return;
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
  } catch (error) {
    const statusCode = error?.$metadata?.httpStatusCode;
    if (statusCode !== 404) throw error;
    await client.send(new CreateBucketCommand({ Bucket: bucketName }));
  }
  readyBuckets.add(bucketName);
};

export const checkObjectStorageReady = async () => {
  if (!client) {
    return { ok: false, message: "Object storage is not configured" };
  }

  await client.send(new ListBucketsCommand({}));
  return { ok: true };
};

export const putJsonObject = async (key, payload) => {
  if (!client) {
    throw new Error("Object storage is not configured");
  }

  await ensureBucket();
  const body = JSON.stringify(payload);
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: "application/json",
    Metadata: {
      "record-type": "vehicle-playback"
    }
  }));

  const objectUrl = publicEndpoint
    ? `${publicEndpoint.replace(/\/$/, "")}/${bucket}/${key}`
    : null;

  return {
    bucket,
    key,
    object_url: objectUrl,
    byte_size: Buffer.byteLength(body)
  };
};

export const putBufferObject = async ({ bucketName = publicReportBucket, key, buffer, contentType, metadata }) => {
  if (!client) {
    throw new Error("Object storage is not configured");
  }

  await ensureBucket(bucketName);
  await client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    Metadata: metadata
  }));

  return {
    bucket: bucketName,
    key,
    byte_size: buffer.length
  };
};

export const getObjectBuffer = async ({ bucketName, key }) => {
  if (!client) {
    throw new Error("Object storage is not configured");
  }

  const response = await client.send(new GetObjectCommand({
    Bucket: bucketName,
    Key: key
  }));
  const bytes = await response.Body.transformToByteArray();

  return {
    buffer: Buffer.from(bytes),
    contentType: response.ContentType,
    contentLength: response.ContentLength
  };
};

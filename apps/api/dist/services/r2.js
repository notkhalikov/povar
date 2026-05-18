"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToR2 = uploadToR2;
const client_s3_1 = require("@aws-sdk/client-s3");
const crypto_1 = require("crypto");
const path_1 = require("path");
const s3 = new client_s3_1.S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});
async function uploadToR2(buffer, originalName, mimeType, folder = 'avatars') {
    const ext = (0, path_1.extname)(originalName) || '.jpg';
    const key = `${folder}/${(0, crypto_1.randomUUID)()}${ext}`;
    await s3.send(new client_s3_1.PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        CacheControl: 'public, max-age=31536000',
    }));
    return `${process.env.R2_PUBLIC_URL}/${key}`;
}

'use strict';

/**
 * s3Service.js
 *
 * Thin wrapper around AWS S3 (SDK v3).
 * Usage:
 *   const s3Service = require('./s3Service');
 *   const url = await s3Service.uploadCoverFromUrl(isbn, 'https://...');
 *
 * Bucket setup required:
 *   1. Create an S3 bucket in the region set in AWS_REGION.
 *   2. Disable "Block all public access" on the bucket.
 *   3. Add a bucket policy that allows s3:GetObject for everyone (below).
 *
 * Minimal public-read bucket policy:
 * {
 *   "Version":"2012-10-17",
 *   "Statement":[{
 *     "Effect":"Allow",
 *     "Principal":"*",
 *     "Action":"s3:GetObject",
 *     "Resource":"arn:aws:s3:::YOUR_BUCKET_NAME/*"
 *   }]
 * }
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const axios  = require('axios');
const config = require('../config');

let _client = null;

function getClient() {
  if (!_client) {
    _client = new S3Client({
      region: config.s3.region,
      credentials: {
        accessKeyId:     config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    });
  }
  return _client;
}

/**
 * Download an image from a URL and upload it to S3.
 * Returns the public S3 HTTPS URL, or null if anything fails.
 *
 * @param {string} isbn     - Used as the S3 object key (books/covers/{isbn}.jpg)
 * @param {string} imageUrl - Source URL to download from
 */
exports.uploadCoverFromUrl = async (isbn, imageUrl) => {
  if (!config.s3.bucket || !config.s3.accessKeyId) {
    console.warn('[s3Service] S3 not configured — skipping cover upload');
    return imageUrl; // fall back to original URL
  }

  try {
    // Download the image
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: { 'User-Agent': 'HyperLocalCloudLibrary/1.0' },
      // Treat non-2xx as an error (catches open library 404 for missing covers)
      validateStatus: (s) => s >= 200 && s < 300,
    });

    const buffer      = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'image/jpeg';
    const ext         = contentType.includes('png') ? 'png'
                      : contentType.includes('gif') ? 'gif'
                      : 'jpg';
    const key = `books/covers/${isbn}.${ext}`;

    await getClient().send(new PutObjectCommand({
      Bucket:      config.s3.bucket,
      Key:         key,
      Body:        buffer,
      ContentType: contentType,
      // No ACL set — bucket policy controls public read
    }));

    const url = `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com/${key}`;
    console.log(`[s3Service] Cover uploaded → ${url}`);
    return url;
  } catch (err) {
    console.warn(`[s3Service] Cover upload failed for ISBN ${isbn}: ${err.message}`);
    return imageUrl; // safe fallback to original URL on any error
  }
};

/**
 * Delete a cover from S3 (used when a book is deleted).
 * @param {string} s3Url - The full S3 URL previously returned by uploadCoverFromUrl
 */
exports.deleteCover = async (s3Url) => {
  if (!config.s3.bucket || !s3Url) return;
  try {
    const prefix = `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com/`;
    if (!s3Url.startsWith(prefix)) return; // not our S3 URL
    const key = s3Url.slice(prefix.length);
    await getClient().send(new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: key }));
    console.log(`[s3Service] Deleted cover from S3: ${key}`);
  } catch (err) {
    console.warn(`[s3Service] Cover delete failed: ${err.message}`);
  }
};

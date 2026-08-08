import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

const LOCAL_RECEIPTS_DIR = path.resolve(__dirname, '../../storage/receipts');

const ensureLocalDirectory = async () => {
  await fs.mkdir(LOCAL_RECEIPTS_DIR, { recursive: true });
};

export const uploadReceiptToStorage = async ({ buffer, invoiceId, filename }) => {
  const safeName = `${invoiceId}-${Date.now()}-${filename}`;

  try {
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          public_id: `vaultpay/receipts/${safeName}`,
          format: 'pdf',
          folder: 'vaultpay/receipts',
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );

      const readable = Readable.from(buffer);
      readable.pipe(uploadStream);
    });

    return {
      storage: 'cloudinary',
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    };
  } catch (error) {
    logger.warn(`Cloudinary upload failed for receipt ${safeName}: ${error.message}`);
  }

  try {
    await ensureLocalDirectory();
    const filePath = path.join(LOCAL_RECEIPTS_DIR, safeName);
    await fs.writeFile(filePath, buffer);
    return {
      storage: 'local',
      url: `/uploads/receipts/${safeName}`,
      publicId: filePath,
    };
  } catch (localError) {
    logger.error(`Receipt storage failed for ${safeName}: ${localError.message}`);
    throw localError;
  }
};

export const streamReceiptFromStorage = async (storageRef) => {
  if (!storageRef) {
    throw new Error('Receipt storage reference is missing.');
  }

  if (storageRef.storage === 'local') {
    const filePath = storageRef.publicId || path.join(LOCAL_RECEIPTS_DIR, path.basename(storageRef.url || ''));
    const fileBuffer = await fs.readFile(filePath);
    return {
      buffer: fileBuffer,
      mimeType: 'application/pdf',
      fileName: path.basename(filePath),
    };
  }

  if (storageRef.storage === 'cloudinary') {
    const response = await fetch(storageRef.url);
    if (!response.ok) {
      throw new Error('Unable to stream receipt from cloud storage.');
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      buffer,
      mimeType: 'application/pdf',
      fileName: `${path.basename(storageRef.url || 'receipt')}.pdf`,
    };
  }

  throw new Error('Unsupported storage provider.');
};

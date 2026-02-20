import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "eu-north-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export const s3Service = {
  async uploadFile(buffer: Buffer, fileName: string, fileType: string, folder: string) {
    try {
      const bucket = process.env.AWS_S3_BUCKET || "";
      const region = process.env.AWS_REGION || "";

      if (!bucket) {
        throw new Error("AWS_S3_BUCKET is not configured");
      }

      const key = `${folder}/${uuidv4()}-${fileName}`;

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: fileType,
      });

      await s3Client.send(command);

      return {
        key,
        url: `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(key)}`,
        bucket,
      };
    } catch (error) {
      console.error("Error in uploadFile:", error);
      throw error;
    }
  },

  async getUploadUrl(fileName: string, fileType: string, folder: string) {
    try {
      const bucket = process.env.AWS_S3_BUCKET || "";
      const region = process.env.AWS_REGION || "";


      const key = `${folder}/${uuidv4()}-${fileName}`;

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: fileType,
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

      return {
        uploadUrl,
        key,
        url: `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(key)}`,
      };
    } catch (error) {
      console.error("Error in getUploadUrl:", error);
      throw error;
    }
  },

  async getZipUploadUrl(fileName: string, fileType: string, folder: string) {
    try {
      // Use a private bucket for ZIP files (digital products)
      const bucket = process.env.AWS_S3_PRIVATE_BUCKET || process.env.AWS_S3_BUCKET || "";
      const region = process.env.AWS_REGION || "";

      if (!bucket) {
        throw new Error("Private S3 bucket not configured");
      }

      const key = `${folder}/${uuidv4()}-${fileName}`;

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: fileType,
        // Add metadata to identify this as a digital product file
        Metadata: {
          'digital-product': 'true',
          'uploaded-at': new Date().toISOString(),
        },
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

      return {
        uploadUrl,
        key,
        url: `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(key)}`,
        bucket, // Return bucket info for reference
      };
    } catch (error) {
      console.error("Error in getZipUploadUrl:", error);
      throw error;
    }
  },

  async getFileMetadata(key: string) {
    try {
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET || "",
        Key: key,
      });

      const response = await s3Client.send(command);
      return {
        size: response.ContentLength,
        mimetype: response.ContentType,
        lastModified: response.LastModified,
      };
    } catch (error) {
      console.error('Error in getFileMetadata:', error);
      throw error;
    }
  },

  async deleteAsset(key: string, bucket?: string) {
    try {
      const targetBucket = bucket || process.env.AWS_S3_BUCKET || "";
      const command = new DeleteObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });
      await s3Client.send(command);
    } catch (error) {
      console.error('Error in deleteAsset:', error);
      throw error;
    }
  },

  async deletePrivateAsset(key: string) {
    try {
      const bucket = process.env.AWS_S3_PRIVATE_BUCKET || process.env.AWS_S3_BUCKET || "";
      if (!bucket) {
        throw new Error("Private S3 bucket not configured");
      }
      await this.deleteAsset(key, bucket);
    } catch (error) {
      console.error('Error in deletePrivateAsset:', error);
      throw error;
    }
  },

  async getDigitalProductDownloadUrl(productId: string, userId: string, key?: string) {
    try {
      // Use private bucket for digital products
      const bucket = process.env.AWS_S3_PRIVATE_BUCKET || process.env.AWS_S3_BUCKET || "";
      
      if (!bucket) {
        throw new Error("Private S3 bucket not configured");
      }

      // Use provided key or fallback to default pattern
      const fileKey = key || `digital-products/${productId}.zip`;

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: fileKey,
      });

      // Generate a short-lived signed URL (5 minutes)
      const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

      // Log the download attempt for security

      return {
        downloadUrl,
        expiresIn: 300, // 5 minutes
        productId,
        userId,
      };
    } catch (error) {
      console.error("Error in getDigitalProductDownloadUrl:", error);
      throw error;
    }
  },

  /**
   * Generate a signed download URL for an existing S3 file
   * Used for FastAPI to download files without going through Render's load balancer
   */
  async getSignedDownloadUrl(key: string, bucket?: string, expiresIn: number = 600): Promise<string> {
    try {
      const targetBucket = bucket || process.env.AWS_S3_BUCKET || "";
      if (!targetBucket) {
        throw new Error("AWS_S3_BUCKET is not configured");
      }

      const command = new GetObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });

      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      console.error("Error in getSignedDownloadUrl:", error);
      throw error;
    }
  }
}; 
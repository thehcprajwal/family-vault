import { defineStore } from 'pinia';
import { ref } from 'vue';
import { uploadApi } from '@/services/api/upload';
import { documentsApi } from '@/services/api/documents';

const DEV_MOCK = import.meta.env.VITE_DEV_MOCK === 'true';

export type UploadStatus =
  | 'idle'
  | 'preparing'
  | 'uploading'
  | 'processing'
  | 'done'
  | 'error';

export interface UploadState {
  status: UploadStatus;
  file: File | null;
  progress: number;
  documentId: string | null;
  versionId: string | null;
  errorMessage: string | null;
}

function getMimeType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return 'application/octet-stream';
}

function getExtension(filename: string): string {
  return filename.split('.').pop() ?? '';
}

function uploadToS3(
  presignedUrl: string,
  file: File,
  mimeType: string,
  onProgress: (percent: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', mimeType);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`S3 upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('S3 upload network error'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));

    signal.addEventListener('abort', () => xhr.abort());

    xhr.send(file);
  });
}

export const useUploadStore = defineStore('upload', () => {
  const state = ref<UploadState>({
    status: 'idle',
    file: null,
    progress: 0,
    documentId: null,
    versionId: null,
    errorMessage: null,
  });

  let abortController: AbortController | null = null;

  function reset(): void {
    abortController?.abort();
    abortController = null;
    state.value = {
      status: 'idle',
      file: null,
      progress: 0,
      documentId: null,
      versionId: null,
      errorMessage: null,
    };
  }

  function cancel(): void {
    abortController?.abort();
    reset();
  }

  async function startUpload(file: File): Promise<void> {
    reset();
    abortController = new AbortController();

    state.value.file = file;
    state.value.status = 'preparing';

    const mimeType = getMimeType(file);
    const fileExtension = getExtension(file.name);

    try {
      if (DEV_MOCK) {
        // Simulate full upload flow without AWS
        await new Promise((r) => setTimeout(r, 600));

        state.value.versionId = 'mock-version-id';
        state.value.status = 'uploading';
        state.value.progress = 0;

        for (let i = 0; i <= 100; i += 5) {
          if (abortController.signal.aborted) return;
          await new Promise((r) => setTimeout(r, 80));
          state.value.progress = i;
        }

        state.value.status = 'processing';
        await new Promise((r) => setTimeout(r, 2000));

        state.value.documentId = 'mock-document-id';
        state.value.status = 'done';
        return;
      }

      // Step 1: Get presigned URL
      const { uploadUrl, versionId, s3Key } = await uploadApi.getUploadUrl({
        mimeType,
        fileExtension,
        fileSizeBytes: file.size,
      });

      state.value.versionId = versionId;
      state.value.status = 'uploading';
      state.value.progress = 0;

      // Step 2: Upload directly to S3 with real progress
      await uploadToS3(uploadUrl, file, mimeType, (percent) => {
        state.value.progress = percent;
      }, abortController.signal);

      // Step 3: Create Document + Version record
      state.value.status = 'processing';

      const { documentId } = await uploadApi.createDocument({
        versionId,
        s3Key,
        mimeType,
        fileSizeBytes: file.size,
        originalFilename: file.name,
      });

      state.value.documentId = documentId;

      // Step 4: Poll until AWAITING_CONFIRMATION or FAILED (max 3 minutes)
      const MAX_POLLS = 36;
      for (let i = 0; i < MAX_POLLS; i++) {
        if (abortController.signal.aborted) return;
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 5000);
          abortController!.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve();
          });
        });
        if (abortController.signal.aborted) return;
        try {
          const { versionStatus } = await documentsApi.getStatus(documentId);
          if (versionStatus === 'AWAITING_CONFIRMATION') break;
          if (versionStatus === 'FAILED') {
            state.value.status = 'error';
            state.value.errorMessage = 'Processing failed. Please try again.';
            return;
          }
        } catch {
          // transient error — keep polling
        }
        if (i === MAX_POLLS - 1) {
          state.value.status = 'error';
          state.value.errorMessage = 'Processing timed out. Try reviewing the document manually.';
          return;
        }
      }

      state.value.status = 'done';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      state.value.status = 'error';
      state.value.errorMessage = err instanceof Error ? err.message : 'Upload failed';
    }
  }

  return { state, startUpload, cancel, reset };
});

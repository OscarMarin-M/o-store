export interface UploadHandle {
  done: Promise<void>;
  abort(): void;
}

/**
 * Sube un archivo a una URL firmada de Supabase Storage informando el progreso (0 a 1).
 * Se usa XMLHttpRequest porque fetch no informa del progreso de subida.
 */
export function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (fraction: number) => void,
): UploadHandle {
  const xhr = new XMLHttpRequest();
  const done = new Promise<void>((resolve, reject) => {
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Storage respondió ${xhr.status}`));
    xhr.onerror = () => reject(new Error('Sin conexión'));
    xhr.onabort = () => reject(new DOMException('Cancelada', 'AbortError'));
  });
  xhr.open('PUT', url);
  xhr.setRequestHeader('Content-Type', file.type);
  xhr.send(file);
  return { done, abort: () => xhr.abort() };
}

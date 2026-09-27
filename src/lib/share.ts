// Udostępnianie / pobieranie plików i tekstu na telefonie.

export function downloadFile(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Wysyła plik przez systemowe „Udostępnij” (Messenger, WhatsApp, mail…), a gdy się nie da — pobiera go. */
export async function shareFile(filename: string, content: string, type: string, title: string): Promise<void> {
  const file = new File([content], filename, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return; // użytkownik anulował
    }
  }
  downloadFile(filename, content, type);
}

/** Udostępnia tekst; zwraca opis tego, co się stało (do komunikatu). */
export async function shareText(text: string, title: string): Promise<string> {
  if (navigator.share) {
    try {
      await navigator.share({ text, title });
      return '';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return '';
    }
  }
  await navigator.clipboard.writeText(text);
  return 'Skopiowano do schowka.';
}

export function readFileText(file: File): Promise<string> {
  if (file.size > 20 * 1024 * 1024) return Promise.reject(new Error('Plik jest za duży.'));
  return file.text();
}

export function dateStamp(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

import { useEffect, useRef, useState } from 'preact/hooks';
import { cardGuide, coverTransform, hashSimilarity, type Rect } from '../lib/geometry';
import { identify, type Candidate } from '../lib/identify';
import { crop, fileToCanvas, imageHash, loadImage, sourceSize } from '../lib/image';
import { getWorkers, readCard } from '../lib/ocr';
import { cardImageUrl, type CardApi } from '../lib/tcgdex';
import { parseCollectorNumber } from '../lib/text';
import { AddCardSheet } from './AddCardSheet';
import type { CardRef } from '../lib/collection';

interface Props {
  api: CardApi;
  lang: string;
  active: boolean;
  ownedCount: (cardId: string) => number;
  onAdd: (ref: CardRef, count: number) => Promise<void>;
}

type Phase = 'camera' | 'reading' | 'searching' | 'results';

export function Scanner({ api, lang, active, ownedCount, onAdd }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [guideStyle, setGuideStyle] = useState<Record<string, string> | null>(null);
  const [phase, setPhase] = useState<Phase>('camera');
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState<number | null>(null);
  const [picked, setPicked] = useState<Candidate | null>(null);
  const hashRef = useRef<Uint8Array | null>(null);
  const searchId = useRef(0);

  const cameraOn = active && phase === 'camera';

  // Kamera działa tylko, gdy jest potrzebna — oszczędza baterię i zwalnia aparat.
  useEffect(() => {
    if (!cameraOn) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Ta przeglądarka nie daje dostępu do kamery (wymagany HTTPS). Użyj przycisku „Zdjęcie”.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } },
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        setCameraError(null);
      } catch (e) {
        const n = (e as DOMException)?.name;
        setCameraError(
          n === 'NotAllowedError'
            ? 'Brak zgody na kamerę. Zezwól w ustawieniach przeglądarki albo użyj przycisku „Zdjęcie”.'
            : 'Nie udało się uruchomić kamery. Użyj przycisku „Zdjęcie”.',
        );
      }
    })();
    // Lista setów i OCR ładują się w tle, żeby pierwsze skanowanie było szybsze.
    api.sets().catch(() => {});
    getWorkers((p) => setOcrLoading(p < 1 ? p : null)).catch(() => setOcrLoading(null));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraOn, api]);

  // Pozycja ramki na ekranie odpowiada ramce w pikselach wideo.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !cameraOn) return;
    const update = () => {
      if (!v.videoWidth) return;
      const t = coverTransform(v.clientWidth, v.clientHeight, v.videoWidth, v.videoHeight);
      const g = videoGuide(v);
      setGuideStyle({
        left: `${g.x * t.scale + t.offsetX}px`, top: `${g.y * t.scale + t.offsetY}px`,
        width: `${g.w * t.scale}px`, height: `${g.h * t.scale}px`,
      });
    };
    const ro = new ResizeObserver(update);
    ro.observe(v);
    v.addEventListener('loadedmetadata', update);
    return () => { ro.disconnect(); v.removeEventListener('loadedmetadata', update); };
  }, [cameraOn]);

  async function recognize(src: HTMLCanvasElement, card: Rect) {
    setError(null);
    setCandidates([]);
    setSnapshot(crop(src, card, Math.min(1, 360 / card.w)).toDataURL('image/jpeg', 0.8));
    hashRef.current = safeHash(() => imageHash(src, card));
    setPhase('reading');
    try {
      const ocr = await readCard(src, card);
      setName(ocr.name ?? '');
      setNumber(ocr.number ? `${ocr.number.local}/${ocr.number.total}` : '');
      await search(ocr.name ?? '', ocr.number ? `${ocr.number.local}/${ocr.number.total}` : '');
    } catch (e) {
      setError(`Nie udało się odczytać karty: ${(e as Error).message}. Wpisz nazwę lub numer ręcznie.`);
      setPhase('results');
    }
  }

  async function search(nameQuery = name, numberQuery = number) {
    const id = ++searchId.current;
    setError(null);
    setPhase('searching');
    const parsedNumber = parseCollectorNumber(numberQuery);
    try {
      const found = await identify(api, { name: nameQuery, number: parsedNumber });
      if (id !== searchId.current) return; // nowsze wyszukiwanie wygrywa
      setCandidates(found);
      // Szczegóły (warianty) najlepszej karty pobieramy od razu — okno dodawania otworzy się bez czekania.
      if (found[0]) api.card(found[0].card.id).catch(() => {});
      // Gdy numer nie wskazał karty, dosortowujemy wyniki po wyglądzie — w tle, bez blokowania listy.
      const hash = hashRef.current;
      if (hash && found.length > 1 && !found.some((c) => c.numberMatch)) {
        rerankByImage(found, hash).then((sorted) => { if (id === searchId.current) setCandidates(sorted); });
      }
      if (found.length === 0) {
        setError(
          !nameQuery.trim() && !parsedNumber
            ? 'Nie odczytano nazwy ani numeru. Wpisz je poniżej (numer jest w dolnym rogu karty, np. 025/198).'
            : 'Nie znaleziono pasującej karty. Popraw nazwę lub numer i spróbuj ponownie.',
        );
      }
    } catch (e) {
      if (id === searchId.current) setError((e as Error).message);
    } finally {
      if (id === searchId.current) setPhase('results');
    }
  }

  function scanFromCamera() {
    const v = videoRef.current;
    if (!v?.videoWidth) return;
    const { w, h } = sourceSize(v);
    const frame = crop(v, { x: 0, y: 0, w, h });
    recognize(frame, videoGuide(v));
  }

  async function scanFromFile(file: File | undefined) {
    if (!file) return;
    try {
      const img = await fileToCanvas(file);
      // Zakładamy, że karta wypełnia większość zdjęcia.
      recognize(img, cardGuide(img.width, img.height, img.width, img.height, 0.96));
    } catch (e) {
      setError((e as Error).message);
      setPhase('results');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function reset() {
    searchId.current++;
    setPhase('camera');
    setSnapshot(null);
    setName('');
    setNumber('');
    setCandidates([]);
    setError(null);
    hashRef.current = null;
  }

  function manual() {
    reset();
    setPhase('results');
  }

  const busy = phase === 'reading' || phase === 'searching';

  return (
    <section class="scanner">
      {phase === 'camera' ? (
        <div class="viewfinder">
          <video ref={videoRef} playsInline muted />
          {guideStyle && !cameraError && <div class="guide" style={guideStyle}><span>Umieść kartę w ramce</span></div>}
          {cameraError && <p class="camera-error">{cameraError}</p>}
          {ocrLoading !== null && <p class="ocr-loading">Przygotowuję rozpoznawanie… {Math.round(ocrLoading * 100)}%</p>}
        </div>
      ) : (
        <div class="scan-result">
          {snapshot && <img class="snapshot" src={snapshot} alt="Zeskanowana karta" />}
          <form class="hint-form" onSubmit={(e) => { e.preventDefault(); search(); }}>
            <label>Nazwa<input value={name} onInput={(e) => setName(e.currentTarget.value)} placeholder="np. Pikachu" autocomplete="off" /></label>
            <label>Numer<input value={number} onInput={(e) => setNumber(e.currentTarget.value)} placeholder="np. 025/198" inputMode="text" autocomplete="off" /></label>
            <button type="submit" disabled={busy || (!name.trim() && !number.trim())}>Szukaj</button>
          </form>
        </div>
      )}

      <div class="scan-actions">
        {phase === 'camera' ? (
          <>
            <button class="secondary" onClick={() => fileRef.current?.click()}>Zdjęcie</button>
            <button class="primary big" onClick={scanFromCamera} disabled={!!cameraError}>Skanuj</button>
            <button class="secondary" onClick={manual}>Wpisz</button>
          </>
        ) : (
          <button class="primary" onClick={reset}>← Skanuj kolejną</button>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => scanFromFile(e.currentTarget.files?.[0])} />
      </div>

      {busy && <p class="status">{phase === 'reading' ? 'Czytam kartę…' : 'Szukam w bazie kart…'}</p>}
      {error && <p class="error">{error}</p>}

      {phase === 'results' && candidates.length > 0 && (
        <>
          <p class="hint">Stuknij właściwą kartę:</p>
          <ul class="candidates">
            {candidates.map((c) => (
              <li key={c.card.id}>
                <button class={c.numberMatch ? 'candidate match' : 'candidate'} onClick={() => setPicked(c)}>
                  {c.card.image ? <img src={cardImageUrl(c.card.image)} alt="" loading="lazy" /> : <div class="noimg">brak obrazka</div>}
                  <strong>{c.card.name}</strong>
                  <small>{c.setName} #{c.card.localId}</small>
                  {ownedCount(c.card.id) > 0 && <span class="owned">masz ×{ownedCount(c.card.id)}</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {picked && (
        <AddCardSheet
          api={api}
          candidate={picked}
          lang={lang}
          owned={ownedCount(picked.card.id)}
          onClose={() => setPicked(null)}
          onAdd={async (ref, count) => {
            await onAdd(ref, count);
            setPicked(null);
            reset();
          }}
        />
      )}
    </section>
  );
}

function videoGuide(v: HTMLVideoElement): Rect {
  const t = coverTransform(v.clientWidth, v.clientHeight, v.videoWidth, v.videoHeight);
  return cardGuide(v.videoWidth, v.videoHeight, v.clientWidth / t.scale, v.clientHeight / t.scale);
}

function safeHash(fn: () => Uint8Array): Uint8Array | null {
  try {
    return fn();
  } catch (e) {
    console.warn('Hash obrazu niedostępny', e);
    return null;
  }
}

/** Porządkuje kandydatów także po wyglądzie — pomaga, gdy numer nie został odczytany. */
async function rerankByImage(candidates: Candidate[], hash: Uint8Array): Promise<Candidate[]> {
  const top = candidates.slice(0, 16);
  const sims = await Promise.all(
    top.map(async (c) => {
      const url = cardImageUrl(c.card.image);
      if (!url) return 0;
      try {
        return hashSimilarity(hash, imageHash(await loadImage(url, 3000)));
      } catch {
        return 0; // brak CORS / sieci — zostaje sama ocena z OCR
      }
    }),
  );
  const rescored = top.map((c, i) => ({ c, s: c.score + 0.3 * sims[i] }));
  rescored.sort((a, b) => b.s - a.s);
  return [...rescored.map((r) => r.c), ...candidates.slice(16)];
}

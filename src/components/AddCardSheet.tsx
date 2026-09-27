import { useEffect, useState } from 'preact/hooks';
import { VARIANT_LABELS, type CardRef, type Variant } from '../lib/collection';
import type { Candidate } from '../lib/identify';
import { cardImageUrl, type CardApi } from '../lib/tcgdex';

interface Props {
  api: CardApi;
  candidate: Candidate;
  lang: string;
  owned: number;
  onClose: () => void;
  onAdd: (ref: CardRef, count: number) => Promise<void>;
}

const ALL_VARIANTS = Object.keys(VARIANT_LABELS) as Variant[];

export function AddCardSheet({ api, candidate, lang, owned, onClose, onAdd }: Props) {
  const { card, setId, setName } = candidate;
  const [variants, setVariants] = useState<Variant[]>(ALL_VARIANTS);
  const [variant, setVariant] = useState<Variant>('normal');
  const [count, setCount] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Szczegóły karty mówią, w jakich wariantach była drukowana; bez nich pokazujemy wszystkie.
  useEffect(() => {
    let alive = true;
    api.card(card.id).then(
      (d) => {
        if (!alive || !d.variants) return;
        const avail = ALL_VARIANTS.filter((v) => d.variants?.[v]);
        if (avail.length) {
          setVariants(avail);
          setVariant(avail[0]);
        }
      },
      (e) => console.warn('Brak szczegółów karty', e),
    );
    return () => { alive = false; };
  }, [card.id]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await onAdd(
        { cardId: card.id, name: card.name, localId: card.localId, setId, setName, image: card.image, variant, lang },
        count,
      );
    } catch (e) {
      setError(`Nie zapisano: ${(e as Error).message}`);
      setSaving(false);
    }
  }

  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-label={`Dodaj ${card.name}`}>
        <div class="sheet-card">
          {card.image && <img src={cardImageUrl(card.image, 'high')} alt={card.name} />}
          <div>
            <h2>{card.name}</h2>
            <p>{setName} · #{card.localId}</p>
            {owned > 0 && <p class="owned">Masz już: {owned} szt.</p>}
          </div>
        </div>

        <fieldset class="variants">
          <legend>Wariant</legend>
          {variants.map((v) => (
            <label key={v} class={v === variant ? 'chip on' : 'chip'}>
              <input type="radio" name="variant" checked={v === variant} onChange={() => setVariant(v)} />
              {VARIANT_LABELS[v]}
            </label>
          ))}
        </fieldset>

        <div class="stepper">
          <span>Ilość</span>
          <button onClick={() => setCount((c) => Math.max(1, c - 1))} aria-label="Mniej">−</button>
          <output>{count}</output>
          <button onClick={() => setCount((c) => Math.min(99, c + 1))} aria-label="Więcej">+</button>
        </div>

        {error && <p class="error">{error}</p>}
        <div class="sheet-actions">
          <button class="secondary" onClick={onClose}>Anuluj</button>
          <button class="primary" onClick={submit} disabled={saving}>{saving ? 'Zapisuję…' : 'Dodaj do kolekcji'}</button>
        </div>
      </div>
    </div>
  );
}

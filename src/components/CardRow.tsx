import type { ComponentChildren } from 'preact';
import { VARIANT_LABELS, type CollectionEntry } from '../lib/collection';
import { cardImageUrl } from '../lib/tcgdex';

export function CardRow({ entry, children }: { entry: CollectionEntry; children?: ComponentChildren }) {
  return (
    <li class="card-row">
      {entry.image ? <img src={cardImageUrl(entry.image)} alt="" loading="lazy" /> : <div class="noimg" />}
      <div class="card-info">
        <strong>{entry.name}</strong>
        <small>
          {entry.setName} #{entry.localId}
          {entry.variant !== 'normal' && <> · {VARIANT_LABELS[entry.variant]}</>}
          {entry.lang !== 'en' && <> · {entry.lang.toUpperCase()}</>}
        </small>
      </div>
      {children}
    </li>
  );
}

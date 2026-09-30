import { describe, expect, it } from 'vitest';
import { extractName, nameSimilarity, parseCollectorNumber, parseWholeCard, sameLocalId } from '../src/lib/text';

describe('parseCollectorNumber', () => {
  it.each([
    ['Illus. 5ban Graphics  SVI EN 025/198 ●', { local: '025', total: '198' }],
    ['136/189', { local: '136', total: '189' }],
    ['12 / 102', { local: '12', total: '102' }],
    ['TG12/TG30', { local: 'TG12', total: 'TG30' }],
    ['SV045/SV122', { local: 'SV045', total: 'SV122' }],
    ['2O1/l89', { local: '201', total: '189' }], // typowe pomyłki OCR
    ['EN025/198', { local: '025', total: '198' }], // sklejony kod języka to nie prefiks
  ])('%s', (text, expected) => {
    expect(parseCollectorNumber(text)).toEqual(expected);
  });

  it.each(['', 'Weakness ×2 Resistance -30', '1/2', 'Pikachu 60 HP', '5/0'])('brak numeru w "%s"', (text) => {
    expect(parseCollectorNumber(text)).toBeNull();
  });
});

describe('extractName', () => {
  it('pomija etykietę stadium i HP', () => {
    expect(extractName([{ text: 'BASIC', height: 12 }, { text: 'Pikachu HP 60', height: 30 }])).toBe('Pikachu');
  });
  it('zachowuje przyrostki ex/V/VMAX', () => {
    expect(extractName([{ text: 'STAGE 2 Charizard ex HP330', height: 30 }])).toBe('Charizard ex');
    expect(extractName([{ text: 'Pikachu VMAX', height: 30 }])).toBe('Pikachu VMAX');
  });
  it('wybiera linię z największą czcionką', () => {
    expect(extractName([{ text: 'Evolves from Charmeleon', height: 10 }, { text: 'Charizard', height: 28 }])).toBe('Charizard');
  });
  it('zwraca null dla śmieci', () => {
    expect(extractName([])).toBeNull();
    expect(extractName([{ text: '~ 12 %', height: 20 }])).toBeNull();
  });
});

describe('nameSimilarity', () => {
  it('ignoruje wielkość liter i akcenty', () => {
    expect(nameSimilarity('Flabébé', 'FLABEBE')).toBe(1);
  });
  it('toleruje błędy OCR', () => {
    expect(nameSimilarity('Pikachv', 'Pikachu')).toBeGreaterThan(0.8);
    expect(nameSimilarity('Pikachu', 'Charizard')).toBeLessThan(0.3);
  });
  it('prefiks bez przyrostka ex', () => {
    expect(nameSimilarity('Charizard', 'Charizard ex')).toBe(0.85);
  });
  it('puste nazwy', () => {
    expect(nameSimilarity('', 'Pikachu')).toBe(0);
  });
});

describe('sameLocalId', () => {
  it('ignoruje zera wiodące i wielkość liter', () => {
    expect(sameLocalId('025', '25')).toBe(true);
    expect(sameLocalId('tg05', 'TG5')).toBe(true);
    expect(sameLocalId('25', '250')).toBe(false);
    expect(sameLocalId('0', '000')).toBe(true);
  });
});

describe('parseWholeCard', () => {
  it('numer z najniższej linii, nazwa z góry obszaru z tekstem', () => {
    const lines = [
      { text: 'BASIC', top: 300, height: 12 },
      { text: 'Pikachu HP 60', top: 315, height: 40 },
      { text: 'Thunder Jolt 40', top: 700, height: 45 }, // duży napis, ale nisko — to atak, nie nazwa
      { text: 'Flip a coin 10/20 damage', top: 750, height: 14 },
      { text: 'Illus. X SVI EN 025/198', top: 1250, height: 14 },
    ];
    expect(parseWholeCard(lines)).toEqual({ name: 'Pikachu', number: { local: '025', total: '198' } });
  });
  it('puste wejście', () => {
    expect(parseWholeCard([])).toEqual({ name: null, number: null });
    expect(parseWholeCard([{ text: '  ', top: 0, height: 10 }])).toEqual({ name: null, number: null });
  });
});

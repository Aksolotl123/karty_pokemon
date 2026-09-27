import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// API TCGdex jest podmienione danymi testowymi — test nie zależy od internetu.
const fixtures = new URL('./fixtures/', import.meta.url).pathname;
const cardPng = readFileSync(`${fixtures}card.png`);

const sets = [
  { id: 'sv01', name: 'Scarlet & Violet', cardCount: { official: 198, total: 258 } },
  { id: 'swsh6', name: 'Chilling Reign', cardCount: { official: 198, total: 233 } },
  { id: 'base1', name: 'Base Set', cardCount: { official: 102, total: 102 } },
];
const img = (id: string) => `https://assets.tcgdex.net/en/test/${id}`;
const setCards: Record<string, unknown[]> = {
  sv01: [{ id: 'sv01-025', localId: '025', name: 'Pikachu', image: img('sv01-025') }],
  swsh6: [{ id: 'swsh6-25', localId: '25', name: 'Galarian Zapdos', image: img('swsh6-25') }],
};
const byName = [
  { id: 'base1-58', localId: '58', name: 'Pikachu', image: img('base1-58') },
  { id: 'sv01-025', localId: '025', name: 'Pikachu', image: img('sv01-025') },
];

async function mockApi(page: Page) {
  await page.route('https://api.tcgdex.net/**', (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown) => route.fulfill({ json: body, headers: { 'access-control-allow-origin': '*' } });
    const p = url.pathname;
    if (p === '/v2/en/sets') return json(sets);
    const set = p.match(/^\/v2\/en\/sets\/(.+)$/);
    if (set) return json({ ...sets.find((s) => s.id === set[1]), cards: setCards[set[1]] ?? [] });
    if (p === '/v2/en/cards') return json(byName.filter((c) => c.name.toLowerCase().includes((url.searchParams.get('name') ?? '').toLowerCase())));
    const card = p.match(/^\/v2\/en\/cards\/(.+)$/);
    if (card) return json({ ...byName.find((c) => c.id === card[1]), set: sets[0], variants: { normal: true, reverse: true, holo: false, firstEdition: false } });
    return route.fulfill({ status: 404 });
  });
  await page.route('https://assets.tcgdex.net/**', (route) =>
    route.fulfill({ body: cardPng, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } }),
  );
}

async function expectPikachuRecognized(page: Page) {
  await expect(page.getByText('Stuknij właściwą kartę')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByLabel('Nazwa')).toHaveValue('Pikachu');
  await expect(page.getByLabel('Numer')).toHaveValue('025/198');
  // Pierwszy kandydat: numer i set się zgadzają.
  await expect(page.locator('.candidate').first()).toContainText('Scarlet & Violet #025');
  await expect(page.locator('.candidate').first()).toHaveClass(/match/);
}

test('skan z kamery → dodanie do kolekcji → dublety → wymiana', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await expect(page.locator('.guide')).toBeVisible();
  await page.getByRole('button', { name: 'Skanuj', exact: true }).click();
  await expectPikachuRecognized(page);

  await page.locator('.candidate').first().click();
  // Warianty z API: zwykła + reverse.
  await expect(page.locator('.chip')).toHaveText(['Zwykła', 'Reverse holo']);
  await page.getByRole('button', { name: 'Więcej' }).click();
  await page.getByRole('button', { name: 'Dodaj do kolekcji' }).click();
  await expect(page.getByRole('status')).toContainText('Dodano: Pikachu (masz 2 szt.)');
  await expect(page.locator('.guide')).toBeVisible(); // wraca do kamery

  await page.getByRole('button', { name: /Kolekcja/ }).click();
  await expect(page.locator('.stats')).toContainText('1różnych kart');
  await expect(page.locator('.stats')).toContainText('2sztuk razem');
  await expect(page.locator('.card-row')).toContainText('Scarlet & Violet #025');

  // Dane przetrwają przeładowanie (IndexedDB).
  await page.reload();
  await page.getByRole('button', { name: /Kolekcja/ }).click();
  await expect(page.locator('.card-row output')).toHaveText('2');

  await page.getByRole('button', { name: /Wymiana/ }).click();
  await expect(page.getByText('Moje dublety (1)')).toBeVisible();

  // Plik od znajomego: ma dubla Base Set Pikachu, nie ma sv01-025.
  const friend = {
    format: 'karty-pokemon/v1', owner: 'Ola', exportedAt: '2026-09-01T00:00:00Z',
    entries: [{ key: 'base1-58|normal|en', cardId: 'base1-58', name: 'Pikachu', localId: '58', setId: 'base1', setName: 'Base Set', variant: 'normal', lang: 'en', quantity: 3, addedAt: '', updatedAt: '' }],
  };
  await page.locator('.trade input[type=file]').setInputFiles({ name: 'ola.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(friend)) });
  await expect(page.getByText('Ola może Ci dać (1)')).toBeVisible();
  await expect(page.getByText('Ty możesz dać Ola (1)')).toBeVisible();
  await expect(page.locator('.proposal')).toContainText('Base Set #58');
});

test('skan ze zdjęcia', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.locator('.scan-actions input[type=file]').setInputFiles(`${fixtures}photo.jpg`);
  await expectPikachuRecognized(page);
});

test('ręczne wyszukiwanie i błąd sieci', async ({ page }) => {
  await page.route('https://api.tcgdex.net/**', (route) => route.abort('internetdisconnected'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Wpisz' }).click();
  await page.getByLabel('Nazwa').fill('Pikachu');
  await page.getByRole('button', { name: 'Szukaj' }).click();
  await expect(page.locator('.error')).toContainText('Brak połączenia z bazą kart');
});

import { describe, expect, test } from 'vitest';
import {
	getWatchlist,
	removeWatchlistEntry,
	saveWatchlistEntry,
	updateWatchlistPrice,
	WATCHLIST_STORAGE_KEY,
} from './watchlist';

function createStorage(): Storage {
	const values = new Map<string, string>();
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, String(value)),
		removeItem: (key) => values.delete(key),
		clear: () => values.clear(),
		key: (index) => [...values.keys()][index] ?? null,
		get length() {
			return values.size;
		},
	};
}

describe('watchlist storage', () => {
	test('adds a ticker and updates duplicates instead of adding them twice', () => {
		const storage = createStorage();
		saveWatchlistEntry({ symbol: 'AAPL', name: 'Apple Inc.' }, storage);
		saveWatchlistEntry({ symbol: 'aapl', name: 'Apple Inc.', price: 200 }, storage);

		expect(getWatchlist(storage)).toEqual([
			{ symbol: 'AAPL', name: 'Apple Inc.', price: 200 },
		]);
	});

	test('updates a saved ticker price and removes the ticker', () => {
		const storage = createStorage();
		saveWatchlistEntry({ symbol: 'AAPL', name: 'Apple Inc.' }, storage);
		updateWatchlistPrice('AAPL', 200, 'USD', '2026-10-21T00:00:00.000Z', storage);
		expect(getWatchlist(storage)[0]).toMatchObject({ price: 200, currency: 'USD' });

		removeWatchlistEntry('aapl', storage);
		expect(getWatchlist(storage)).toEqual([]);
	});

	test('reports malformed stored data instead of silently losing it', () => {
		const storage = createStorage();
		storage.setItem(WATCHLIST_STORAGE_KEY, '{not json');

		expect(() => getWatchlist(storage)).toThrow('Saved watchlist data is invalid');
	});
});

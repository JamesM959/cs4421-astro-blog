import { describe, expect, test } from 'vitest';
import {
	addPortfolioEntry,
	getPortfolio,
	PORTFOLIO_STORAGE_KEY,
	removePortfolioEntry,
} from './portfolio';

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

describe('portfolio storage', () => {
	test('assigns the first holding 100% and applies manually configured allocations', () => {
		const storage = createStorage();
		addPortfolioEntry({ symbol: 'AAPL', name: 'Apple Inc.' }, undefined, storage);
		expect(getPortfolio(storage)).toEqual([
			{ symbol: 'AAPL', name: 'Apple Inc.', allocation: 100 },
		]);

		addPortfolioEntry({ symbol: 'MSFT', name: 'Microsoft' }, 25, storage, { AAPL: 75 });
		expect(getPortfolio(storage)).toEqual([
			{ symbol: 'AAPL', name: 'Apple Inc.', allocation: 75 },
			{ symbol: 'MSFT', name: 'Microsoft', allocation: 25 },
		]);
	});

	test('allows manual allocation across all holdings when adding a stock', () => {
		const storage = createStorage();
		addPortfolioEntry({ symbol: 'AAPL', name: 'Apple Inc.' }, undefined, storage);
		addPortfolioEntry({ symbol: 'MSFT', name: 'Microsoft' }, 40, storage, { AAPL: 60 });
		addPortfolioEntry({ symbol: 'NVDA', name: 'NVIDIA' }, 30, storage, { AAPL: 40, MSFT: 30 });

		expect(getPortfolio(storage).map(({ symbol, allocation }) => [symbol, allocation])).toEqual([
			['AAPL', 40],
			['MSFT', 30],
			['NVDA', 30],
		]);
	});

	test('requires valid manual allocations that total 100%', () => {
		const storage = createStorage();
		addPortfolioEntry({ symbol: 'AAPL', name: 'Apple Inc.' }, undefined, storage);

		expect(() => addPortfolioEntry({ symbol: 'MSFT', name: 'Microsoft' }, 25, storage)).toThrow(
			'Set an allocation',
		);
		expect(() =>
			addPortfolioEntry({ symbol: 'MSFT', name: 'Microsoft' }, 25, storage, { AAPL: 50 }),
		).toThrow('must total 100%');
		expect(() =>
			addPortfolioEntry({ symbol: 'MSFT', name: 'Microsoft' }, 25, storage, { AAPL: 0 }),
		).toThrow('0.5% increments');
	});

	test('accepts half-percent existing allocations and rejects unsupported decimal values', () => {
		const storage = createStorage();
		addPortfolioEntry({ symbol: 'AAPL', name: 'Apple Inc.' }, undefined, storage);
		addPortfolioEntry({ symbol: 'MSFT', name: 'Microsoft' }, 30, storage, { AAPL: 70 });
		addPortfolioEntry({ symbol: 'NVDA', name: 'NVIDIA' }, 10, storage, {
			AAPL: 61.5,
			MSFT: 28.5,
		});

		expect(() =>
			addPortfolioEntry({ symbol: 'TSLA', name: 'Tesla' }, 10, storage, {
				AAPL: 40.25,
				MSFT: 20.25,
				NVDA: 29.5,
			}),
		).toThrow('0.5% increments');
		expect(() =>
			addPortfolioEntry({ symbol: 'TSLA', name: 'Tesla' }, 10.5, storage, {
				AAPL: 60,
				MSFT: 20,
				NVDA: 9.5,
			}),
		).toThrow('whole percentage');
	});

	test('records the price and date when a holding is added', () => {
		const storage = createStorage();
		addPortfolioEntry(
			{
				symbol: 'AAPL',
				name: 'Apple Inc.',
				price: 225.5,
				currency: 'USD',
				priceDate: '2026-10-24T00:00:00.000Z',
			},
			undefined,
			storage,
		);

		expect(getPortfolio(storage)[0]).toMatchObject({
			price: 225.5,
			currency: 'USD',
			priceDate: '2026-10-24T00:00:00.000Z',
		});
	});

	test('redistributes remaining allocations when a holding is removed', () => {
		const storage = createStorage();
		addPortfolioEntry({ symbol: 'AAPL', name: 'Apple Inc.' }, undefined, storage);
		addPortfolioEntry({ symbol: 'MSFT', name: 'Microsoft' }, 25, storage, { AAPL: 75 });
		addPortfolioEntry({ symbol: 'NVDA', name: 'NVIDIA' }, 20, storage, { AAPL: 60, MSFT: 20 });

		removePortfolioEntry('MSFT', storage);

		const entries = getPortfolio(storage);
		expect(entries.map(({ symbol }) => symbol)).toEqual(['AAPL', 'NVDA']);
		expect(entries.map(({ allocation }) => allocation)).toEqual([75, 25]);
		expect(entries.reduce((sum, entry) => sum + entry.allocation, 0)).toBe(100);
	});

	test('removes the portfolio storage when its last holding is deleted', () => {
		const storage = createStorage();
		addPortfolioEntry({ symbol: 'AAPL', name: 'Apple Inc.' }, undefined, storage);

		removePortfolioEntry('AAPL', storage);

		expect(storage.getItem(PORTFOLIO_STORAGE_KEY)).toBeNull();
		expect(getPortfolio(storage)).toEqual([]);
	});

	test('rejects invalid allocations and duplicate holdings', () => {
		const storage = createStorage();
		addPortfolioEntry({ symbol: 'AAPL', name: 'Apple Inc.' }, undefined, storage);

		expect(() => addPortfolioEntry({ symbol: 'MSFT', name: 'Microsoft' }, 100, storage)).toThrow(
			'Choose a whole percentage',
		);
		expect(() => addPortfolioEntry({ symbol: 'aapl', name: 'Apple Inc.' }, 25, storage)).toThrow(
			'already in your portfolio',
		);
	});
});

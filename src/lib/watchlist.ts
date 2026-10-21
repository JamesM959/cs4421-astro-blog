export const WATCHLIST_STORAGE_KEY = 'gaarp-watchlist';

export interface WatchlistEntry {
	symbol: string;
	name: string;
	exchange?: string;
	price?: number;
	currency?: string;
	priceDate?: string;
}

type WatchlistStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getStorage(storage?: WatchlistStorage): WatchlistStorage {
	if (storage) return storage;
	if (typeof window === 'undefined') {
		throw new Error('The watchlist is only available in a browser.');
	}
	return window.localStorage;
}

function isWatchlistEntry(value: unknown): value is WatchlistEntry {
	if (typeof value !== 'object' || value === null || !('symbol' in value) || !('name' in value)) {
		return false;
	}
	const entry = value as Record<string, unknown>;
	return (
		typeof entry.symbol === 'string' &&
		/^[A-Za-z0-9.^=_-]{1,32}$/.test(entry.symbol) &&
		typeof entry.name === 'string' &&
		entry.name.trim().length > 0 &&
		(entry.exchange === undefined || typeof entry.exchange === 'string') &&
		(entry.price === undefined || (typeof entry.price === 'number' && Number.isFinite(entry.price))) &&
		(entry.currency === undefined || (typeof entry.currency === 'string' && /^[A-Z]{3}$/.test(entry.currency))) &&
		(entry.priceDate === undefined ||
			(typeof entry.priceDate === 'string' && Number.isFinite(Date.parse(entry.priceDate))))
	);
}

export function getWatchlist(storage?: WatchlistStorage): WatchlistEntry[] {
	const saved = getStorage(storage).getItem(WATCHLIST_STORAGE_KEY);
	if (saved === null) return [];

	let parsed: unknown;
	try {
		parsed = JSON.parse(saved);
	} catch {
		throw new Error('Saved watchlist data is invalid. Clear this browser’s site storage and try again.');
	}
	if (!Array.isArray(parsed) || !parsed.every(isWatchlistEntry)) {
		throw new Error('Saved watchlist data is invalid. Clear this browser’s site storage and try again.');
	}

	return parsed;
}

export function saveWatchlistEntry(entry: WatchlistEntry, storage?: WatchlistStorage): void {
	if (!isWatchlistEntry(entry)) throw new Error('Cannot save an invalid watchlist entry.');

	const target = getStorage(storage);
	const entries = getWatchlist(target);
	const normalizedEntry = { ...entry, symbol: entry.symbol.toUpperCase() };
	const existingIndex = entries.findIndex(
		(saved) => saved.symbol.toUpperCase() === normalizedEntry.symbol,
	);
	if (existingIndex === -1) {
		entries.push(normalizedEntry);
	} else {
		entries[existingIndex] = { ...entries[existingIndex], ...normalizedEntry };
	}
	target.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(entries));
}

export function removeWatchlistEntry(symbol: string, storage?: WatchlistStorage): void {
	const target = getStorage(storage);
	const entries = getWatchlist(target).filter(
		(entry) => entry.symbol.toUpperCase() !== symbol.toUpperCase(),
	);
	target.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(entries));
}

export function updateWatchlistPrice(
	symbol: string,
	price: number,
	currency: string,
	priceDate: string,
	storage?: WatchlistStorage,
): void {
	if (!Number.isFinite(price) || !/^[A-Z]{3}$/.test(currency) || !Number.isFinite(Date.parse(priceDate))) {
		throw new Error('Cannot save invalid price information.');
	}

	const target = getStorage(storage);
	const entries = getWatchlist(target);
	const existingIndex = entries.findIndex(
		(entry) => entry.symbol.toUpperCase() === symbol.toUpperCase(),
	);
	if (existingIndex === -1) return;

	entries[existingIndex] = { ...entries[existingIndex], price, currency, priceDate };
	target.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(entries));
}

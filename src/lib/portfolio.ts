export const PORTFOLIO_STORAGE_KEY = 'gaarp-portfolio';

export interface PortfolioEntry {
	symbol: string;
	name: string;
	exchange?: string;
	allocation: number;
	price?: number;
	currency?: string;
	priceDate?: string;
}

type PortfolioStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getStorage(storage?: PortfolioStorage): PortfolioStorage {
	if (storage) return storage;
	if (typeof window === 'undefined') {
		throw new Error('The portfolio is only available in a browser.');
	}
	return window.localStorage;
}

function isPortfolioEntry(value: unknown): value is PortfolioEntry {
	if (
		typeof value !== 'object' ||
		value === null ||
		!('symbol' in value) ||
		!('name' in value) ||
		!('allocation' in value)
	) {
		return false;
	}
	const entry = value as Record<string, unknown>;
	return (
		typeof entry.symbol === 'string' &&
		/^[A-Za-z0-9.^=_-]{1,32}$/.test(entry.symbol) &&
		typeof entry.name === 'string' &&
		entry.name.trim().length > 0 &&
		typeof entry.allocation === 'number' &&
		Number.isFinite(entry.allocation) &&
		entry.allocation > 0 &&
		entry.allocation <= 100 &&
		(entry.exchange === undefined || typeof entry.exchange === 'string') &&
		(entry.price === undefined || (typeof entry.price === 'number' && Number.isFinite(entry.price))) &&
		(entry.currency === undefined || (typeof entry.currency === 'string' && /^[A-Z]{3}$/.test(entry.currency))) &&
		(entry.priceDate === undefined ||
			(typeof entry.priceDate === 'string' && Number.isFinite(Date.parse(entry.priceDate))))
	);
}

export function getPortfolio(storage?: PortfolioStorage): PortfolioEntry[] {
	const saved = getStorage(storage).getItem(PORTFOLIO_STORAGE_KEY);
	if (saved === null) return [];

	let parsed: unknown;
	try {
		parsed = JSON.parse(saved);
	} catch {
		throw new Error('Saved portfolio data is invalid. Clear this browser’s site storage and try again.');
	}
	if (
		!Array.isArray(parsed) ||
		!parsed.every(isPortfolioEntry) ||
		(parsed.length > 0 && Math.abs(parsed.reduce((total, entry) => total + entry.allocation, 0) - 100) > 0.01) ||
		new Set(parsed.map((entry) => entry.symbol.toUpperCase())).size !== parsed.length
	) {
		throw new Error('Saved portfolio data is invalid. Clear this browser’s site storage and try again.');
	}

	return parsed;
}

export function addPortfolioEntry(
	entry: Omit<PortfolioEntry, 'allocation'>,
	allocation?: number,
	storage?: PortfolioStorage,
): void {
	if (
		typeof entry.symbol !== 'string' ||
		!/^[A-Za-z0-9.^=_-]{1,32}$/.test(entry.symbol) ||
		typeof entry.name !== 'string' ||
		entry.name.trim().length === 0
	) {
		throw new Error('Cannot save an invalid portfolio holding.');
	}
	const target = getStorage(storage);
	const entries = getPortfolio(target);
	const symbol = entry.symbol.toUpperCase();
	if (entries.some((saved) => saved.symbol.toUpperCase() === symbol)) {
		throw new Error(`${symbol} is already in your portfolio.`);
	}

	if (entries.length === 0) {
		target.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify([{ ...entry, symbol, allocation: 100 }]));
		return;
	}
	if (allocation === undefined || !Number.isFinite(allocation) || allocation <= 0 || allocation >= 100) {
		throw new Error('Choose a percentage greater than 0% and less than 100%.');
	}

	const remainingAllocation = 100 - allocation;
	const existingTotal = entries.reduce((total, saved) => total + saved.allocation, 0);
	let allocated = 0;
	const rebalanced = entries.map((saved, index) => {
		const currentAllocation =
			index === entries.length - 1
				? remainingAllocation - allocated
				: (saved.allocation / existingTotal) * remainingAllocation;
		allocated += currentAllocation;
		return { ...saved, allocation: currentAllocation };
	});
	rebalanced.push({ ...entry, symbol, allocation });
	target.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(rebalanced));
}

export function removePortfolioEntry(symbol: string, storage?: PortfolioStorage): void {
	const target = getStorage(storage);
	const entries = getPortfolio(target).filter(
		(entry) => entry.symbol.toUpperCase() !== symbol.toUpperCase(),
	);
	if (entries.length === 0) {
		target.removeItem(PORTFOLIO_STORAGE_KEY);
		return;
	}

	const currentTotal = entries.reduce((total, entry) => total + entry.allocation, 0);
	let allocated = 0;
	const normalized = entries.map((entry, index) => {
		const allocation =
			index === entries.length - 1 ? 100 - allocated : (entry.allocation / currentTotal) * 100;
		allocated += allocation;
		return { ...entry, allocation };
	});
	target.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(normalized));
}

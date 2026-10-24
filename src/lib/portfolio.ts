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
	existingAllocations?: Record<string, number>,
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
	if (
		allocation === undefined ||
		!Number.isFinite(allocation) ||
		allocation <= 0 ||
		allocation >= 100 ||
		!Number.isInteger(allocation)
	) {
		throw new Error('Choose a whole percentage from 1% to 99%.');
	}
	if (!existingAllocations) {
		throw new Error('Set an allocation for every existing holding.');
	}
	const normalizedAllocations = new Map<string, number>();
	for (const [savedSymbol, savedAllocation] of Object.entries(existingAllocations)) {
		const normalizedSymbol = savedSymbol.toUpperCase();
		if (
			normalizedAllocations.has(normalizedSymbol) ||
			!Number.isFinite(savedAllocation) ||
			savedAllocation <= 0 ||
			savedAllocation > 100 ||
			!Number.isInteger(savedAllocation * 2)
		) {
			throw new Error('Enter a percentage in 0.5% increments for every existing holding.');
		}
		normalizedAllocations.set(normalizedSymbol, savedAllocation);
	}
	if (
		normalizedAllocations.size !== entries.length ||
		entries.some((saved) => !normalizedAllocations.has(saved.symbol.toUpperCase()))
	) {
		throw new Error('Set an allocation for every existing holding.');
	}
	const total = allocation + [...normalizedAllocations.values()].reduce((sum, value) => sum + value, 0);
	if (Math.abs(total - 100) > 0.01) {
		throw new Error('The allocations must total 100%.');
	}
	const updatedEntries = entries.map((saved) => {
		const savedAllocation = normalizedAllocations.get(saved.symbol.toUpperCase());
		if (savedAllocation === undefined) {
			throw new Error('Set an allocation for every existing holding.');
		}
		return { ...saved, allocation: savedAllocation };
	});
	updatedEntries.push({ ...entry, symbol, allocation });
	target.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(updatedEntries));
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

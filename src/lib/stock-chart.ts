export interface StockPricePoint {
	date: string;
	close: number;
}

export interface StockHistory {
	symbol: string;
	name: string;
	currency: string;
	interval: '1d' | '1mo';
	prices: StockPricePoint[];
}

export type StockHistoryRange = '5d' | '1mo' | '1y' | '5y' | 'max';

export const STOCK_RANGE_LABELS: Record<StockHistoryRange, string> = {
	'5d': 'Past week',
	'1mo': 'Past month',
	'1y': 'Past year',
	'5y': 'Past 5 years',
	max: 'Past performance',
};

export async function fetchStockHistory(
	symbol: string,
	range: StockHistoryRange,
	signal?: AbortSignal,
): Promise<StockHistory> {
	const response = await fetch(
		`/api/finance/chart/${encodeURIComponent(symbol)}?range=${range}`,
		{ signal },
	);
	const payload: unknown = await response.json();
	if (!response.ok) {
		const message =
			typeof payload === 'object' &&
			payload !== null &&
			'error' in payload &&
			typeof payload.error === 'string'
				? payload.error
				: 'Price history is temporarily unavailable.';
		throw new Error(message);
	}
	if (
		typeof payload !== 'object' ||
		payload === null ||
		!('prices' in payload) ||
		!Array.isArray(payload.prices) ||
		!('symbol' in payload) ||
		typeof payload.symbol !== 'string' ||
		!('name' in payload) ||
		typeof payload.name !== 'string' ||
		!('currency' in payload) ||
		typeof payload.currency !== 'string' ||
		!('interval' in payload) ||
		(payload.interval !== '1d' && payload.interval !== '1mo')
	) {
		throw new Error('Unexpected response from price history.');
	}
	if (
		payload.prices.length === 0 ||
		!payload.prices.every(
			(point) =>
				typeof point === 'object' &&
				point !== null &&
				'date' in point &&
				typeof point.date === 'string' &&
				Number.isFinite(Date.parse(point.date)) &&
				'close' in point &&
				typeof point.close === 'number' &&
				Number.isFinite(point.close),
		)
	) {
		throw new Error('No valid price history is available for this company.');
	}

	return payload as StockHistory;
}

export function renderStockSparkline(stockChart: SVGSVGElement, history: StockHistory): void {
	const width = 120;
	const height = 44;
	const padding = 2;
	const values = history.prices.map((point) => point.close);
	const minValue = Math.min(...values);
	const maxValue = Math.max(...values);
	const valueRange = maxValue - minValue || 1;
	const points = values.map((value, index) => ({
		x: padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2),
		y: padding + (1 - (value - minValue) / valueRange) * (height - padding * 2),
	}));
	const pathData = points
		.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
		.join(' ');
	const change = values[values.length - 1] - values[0];
	const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
	line.setAttribute('d', pathData);
	line.setAttribute('fill', 'none');
	line.classList.add(change >= 0 ? 'positive' : 'negative');
	line.setAttribute('stroke-width', '2');
	line.setAttribute('stroke-linecap', 'round');
	line.setAttribute('stroke-linejoin', 'round');
	stockChart.replaceChildren(line);
	stockChart.setAttribute(
		'aria-label',
		`${history.name} (${history.symbol}) share price trend over the past month`,
	);
}

export function renderStockChart(
	stockChart: SVGSVGElement,
	periodChange: HTMLElement,
	history: StockHistory,
	range: StockHistoryRange,
): void {
	if (history.prices.length === 0) return;
	const width = 760;
	const height = 340;
	const padding = { top: 20, right: 20, bottom: 42, left: 84 };
	const plotWidth = width - padding.left - padding.right;
	const plotHeight = height - padding.top - padding.bottom;
	const timestamps = history.prices.map((point) => new Date(point.date).getTime());
	const values = history.prices.map((point) => point.close);
	const firstTime = timestamps[0];
	const timeRange = timestamps[timestamps.length - 1] - firstTime || 1;
	const minValue = Math.min(...values);
	const maxValue = Math.max(...values);
	const valuePadding = (maxValue - minValue || maxValue * 0.1 || 1) * 0.1;
	const lowerBound = Math.max(0, minValue - valuePadding);
	const upperBound = maxValue + valuePadding;
	const valueRange = upperBound - lowerBound || 1;
	const makeSvg = (tag: string, attributes: Record<string, string>) => {
		const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
		for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
		return element;
	};
	const currency = /^[A-Z]{3}$/.test(history.currency) ? history.currency : 'USD';
	let formatPrice: (value: number) => string;
	try {
		const formatter = new Intl.NumberFormat(undefined, {
			style: 'currency',
			currency,
			maximumFractionDigits: 2,
		});
		formatPrice = (value) => formatter.format(value);
	} catch {
		const formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
		formatPrice = (value) => formatter.format(value);
	}
	const points = history.prices.map((point, index) => {
		const x = padding.left + ((timestamps[index] - firstTime) / timeRange) * plotWidth;
		const y = padding.top + (1 - (point.close - lowerBound) / valueRange) * plotHeight;
		return { x, y };
	});
	const linePath = points
		.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
		.join(' ');
	const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${height - padding.bottom} L ${points[0].x.toFixed(2)} ${height - padding.bottom} Z`;
	const change = ((values[values.length - 1] / values[0]) - 1) * 100;
	const trend = change >= 0 ? 'positive' : 'negative';
	const grid = makeSvg('g', { class: 'stock-chart-grid', 'aria-hidden': 'true' });
	const yLabels = makeSvg('g', { class: 'stock-chart-labels', 'aria-hidden': 'true' });
	for (let index = 0; index < 5; index += 1) {
		const fraction = index / 4;
		const y = padding.top + fraction * plotHeight;
		const value = upperBound - fraction * valueRange;
		grid.append(
			makeSvg('line', {
				x1: String(padding.left),
				y1: String(y),
				x2: String(width - padding.right),
				y2: String(y),
			}),
		);
		const label = makeSvg('text', {
			x: String(padding.left - 12),
			y: String(y + 4),
			'text-anchor': 'end',
		});
		label.textContent = formatPrice(value);
		yLabels.append(label);
	}
	const xLabels = makeSvg('g', { class: 'stock-chart-labels', 'aria-hidden': 'true' });
	const dateOptions: Intl.DateTimeFormatOptions =
		range === '5d'
			? { month: 'short', day: 'numeric' }
			: range === '1mo'
				? { month: 'short', day: 'numeric' }
				: range === 'max'
					? { year: 'numeric' }
					: { month: 'short', year: 'numeric' };
	const dateFormat = new Intl.DateTimeFormat(undefined, dateOptions);
	for (let index = 0; index < 5; index += 1) {
		const pointIndex = Math.round((history.prices.length - 1) * (index / 4));
		const label = makeSvg('text', {
			x: String(padding.left + (index / 4) * plotWidth),
			y: String(height - 10),
			'text-anchor': index === 0 ? 'start' : index === 4 ? 'end' : 'middle',
		});
		label.textContent = dateFormat.format(new Date(history.prices[pointIndex].date));
		xLabels.append(label);
	}

	const area = makeSvg('path', { class: `stock-chart-area ${trend}`, d: areaPath });
	const line = makeSvg('path', { class: `stock-chart-line ${trend}`, d: linePath });
	stockChart.replaceChildren(grid, yLabels, area, line, xLabels);
	stockChart.setAttribute(
		'aria-label',
		`${history.name} (${history.symbol}) share price history, ${STOCK_RANGE_LABELS[range].toLowerCase()}`,
	);
	stockChart.classList.add('is-visible');
	stockChart.setAttribute('aria-hidden', 'false');
	periodChange.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
	periodChange.className = `period-change ${trend}`;
}

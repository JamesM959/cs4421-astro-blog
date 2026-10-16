import type { APIRoute } from 'astro';

interface YahooChartResponse {
	chart?: {
		error?: { description?: string } | null;
		result?: Array<{
			meta?: {
				currency?: string;
				longName?: string;
				shortName?: string;
				symbol?: string;
			};
			timestamp?: number[];
			indicators?: {
				quote?: Array<{
					close?: Array<number | null>;
				}>;
			};
		} | null>;
	};
}

export const GET: APIRoute = async ({ params, url }) => {
	const symbol = params.symbol?.trim();
	if (!symbol || symbol.length > 32 || !/^[A-Za-z0-9.^=_-]+$/.test(symbol)) {
		return Response.json({ error: 'Enter a valid ticker symbol.' }, { status: 400 });
	}
	const range = url.searchParams.get('range') ?? '1y';
	const supportedRanges = new Set(['5d', '1mo', '1y', '5y', 'max']);
	if (!supportedRanges.has(range)) {
		return Response.json({ error: 'Choose a supported price history period.' }, { status: 400 });
	}
	const interval = range === 'max' ? '1mo' : '1d';

	const chartUrl = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
	chartUrl.searchParams.set('range', range);
	chartUrl.searchParams.set('interval', interval);

	try {
		const response = await fetch(chartUrl, {
			headers: { 'user-agent': 'Mozilla/5.0' },
			signal: AbortSignal.timeout(8000),
		});
		if (!response.ok) {
			return Response.json({ error: 'Price history is temporarily unavailable.' }, { status: 502 });
		}

		const data = (await response.json()) as YahooChartResponse;
		const result = data.chart?.result?.[0];
		if (!result) {
			return Response.json({ error: 'No price history is available for this company.' }, { status: 404 });
		}

		const timestamps = result.timestamp ?? [];
		const closes = result.indicators?.quote?.[0]?.close ?? [];
		const prices = timestamps.flatMap((timestamp, index) => {
			const close = closes[index];
			if (!Number.isFinite(timestamp) || close == null || !Number.isFinite(close)) return [];
			return [{ date: new Date(timestamp * 1000).toISOString(), close }];
		});
		if (prices.length === 0) {
			return Response.json({ error: 'No price history is available for this company.' }, { status: 404 });
		}

		return Response.json({
			symbol: result.meta?.symbol ?? symbol,
			name: result.meta?.longName ?? result.meta?.shortName ?? symbol,
			currency: result.meta?.currency ?? 'USD',
			interval,
			prices,
		}, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
	} catch {
		return Response.json({ error: 'Price history could not be reached.' }, { status: 502 });
	}
};
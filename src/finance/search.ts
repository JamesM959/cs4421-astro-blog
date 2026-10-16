import type { APIRoute } from 'astro';

interface YahooSearchResponse {
	quotes?: Array<{
		exchDisp?: string;
		longname?: string;
		quoteType?: string;
		shortname?: string;
		symbol?: string;
	}>;
}

export const GET: APIRoute = async ({ url }) => {
	const query = url.searchParams.get('q')?.trim();
	if (!query || query.length > 80) {
		return Response.json({ error: 'Enter a ticker or company name.' }, { status: 400 });
	}

	const searchUrl = new URL('https://query1.finance.yahoo.com/v1/finance/search');
	searchUrl.searchParams.set('q', query);
	searchUrl.searchParams.set('quotesCount', '10');
	searchUrl.searchParams.set('newsCount', '0');

	try {
		const response = await fetch(searchUrl, {
			headers: { 'user-agent': 'Mozilla/5.0' },
			signal: AbortSignal.timeout(8000),
		});
		if (!response.ok) {
			return Response.json({ error: 'Yahoo Finance search is temporarily unavailable.' }, { status: 502 });
		}

		const data = (await response.json()) as YahooSearchResponse;
		const results = (data.quotes ?? [])
			.filter((quote) => quote.quoteType === 'EQUITY' && quote.symbol)
			.slice(0, 8)
			.map((quote) => ({
				symbol: quote.symbol,
				name: quote.longname ?? quote.shortname ?? quote.symbol,
				exchange: quote.exchDisp ?? '',
			}));

		return Response.json(results, {
			headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
		});
	} catch {
		return Response.json({ error: 'Yahoo Finance search could not be reached.' }, { status: 502 });
	}
};
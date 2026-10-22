import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const start = performance.now();
  const url = new URL(context.request.url);

  try {
    const response = await next();

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "INFO",
        method: context.request.method,
        path: url.pathname,
        status: response.status,
        durationMs: Math.round(performance.now() - start),
        message: "request completed",
      })
    );

    return response;
  } catch (error) {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "ERROR",
        method: context.request.method,
        path: url.pathname,
        durationMs: Math.round(performance.now() - start),
        message: error instanceof Error ? error.message : "unknown error",
      })
    );

    throw error;
  }
});
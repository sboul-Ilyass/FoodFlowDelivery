import { createStart, createMiddleware, createCsrfMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const loggingMiddleware = createMiddleware().server(async ({ next }) => {
  const request = getRequest();
  const method = request?.method ?? "UNKNOWN";
  const url = request?.url ?? "UNKNOWN";
  console.log(`[REQUEST] ${method} ${url}`);
  try {
    const response = await next();
    console.log(`[RESPONSE] ${method} ${url} => ${response instanceof Response ? response.status : "200 (OK)"}`);
    return response;
  } catch (error) {
    console.error(`[ERROR] ${method} ${url} =>`, error);
    throw error;
  }
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [csrfMiddleware, loggingMiddleware, errorMiddleware],
}));



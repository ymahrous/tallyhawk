import type { MetadataRoute } from "next";
import { PRIVATE_ROUTE_PREFIXES, absoluteUrl } from "@/lib/site";

// Answer engines and AI assistants that cite or fetch pages on a user's behalf. Welcoming them is
// the core of generative-engine visibility: if they can't read the marketing pages, they can't
// recommend Tallyhawk.
export const AI_SEARCH_AGENTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "DuckAssistBot",
  "MistralAI-User",
] as const;

// Crawlers that collect model-training data. Allowed so that future models know the product;
// remove this list from the rules below to opt out of training without affecting search.
export const AI_TRAINING_AGENTS = [
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "meta-externalagent",
  "Amazonbot",
  "CCBot",
] as const;

/**
 * Private app routes. `/app` is matched exactly (`$`) and as a directory so the rule doesn't also
 * block `/apple-icon.png`, which a bare `/app` prefix would.
 */
export function disallowedPaths(): string[] {
  return PRIVATE_ROUTE_PREFIXES.flatMap((prefix) =>
    prefix === "/app" ? ["/app$", "/app/"] : [prefix]
  );
}

export default function robots(): MetadataRoute.Robots {
  const disallow = disallowedPaths();

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      // A crawler obeys only its most specific group, so named agents need the disallow list too.
      {
        userAgent: [...AI_SEARCH_AGENTS, ...AI_TRAINING_AGENTS],
        allow: ["/", "/llms.txt", "/llms-full.txt"],
        disallow,
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}

// lib/tools/tavily.ts
// Tavily web search tool — primary search provider for the MicroManus agent.
// Falls back to Brave Search API if Tavily fails (429 or missing key).
// Free tier: 1,000 credits/month. Basic search = 1 credit. Advanced = 2 credits.

export type SearchResult = {
  url: string;
  title: string;
  content: string;
  score?: number;
};

export type SearchResponse = {
  query: string;
  results: SearchResult[];
  provider: "tavily" | "brave";
};

/**
 * Performs a web search using Tavily API.
 * Returns the top results structured for feeding back into the LLM.
 */
async function searchWithTavily(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY not set");

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic", // 1 credit — use "advanced" for deeper results at 2 credits
      max_results: 6,
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tavily error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return (data.results ?? []).map((r: any) => ({
    url: r.url,
    title: r.title,
    content: r.content?.slice(0, 800) ?? "", // Trim to keep context manageable
    score: r.score,
  }));
}

/**
 * Fallback: Brave Search API.
 * Requires BRAVE_SEARCH_API_KEY env var.
 */
async function searchWithBrave(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) throw new Error("BRAVE_SEARCH_API_KEY not set");

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "6");

  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Brave Search error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const webResults = data.web?.results ?? [];
  return webResults.map((r: any) => ({
    url: r.url,
    title: r.title,
    content: r.description?.slice(0, 800) ?? "",
  }));
}

/**
 * Main search function — tries Tavily first, falls back to Brave on failure.
 * Called from the agent's tool executor.
 */
export async function webSearch(query: string): Promise<SearchResponse> {
  // Try Tavily first
  if (process.env.TAVILY_API_KEY) {
    try {
      const results = await searchWithTavily(query);
      return { query, results, provider: "tavily" };
    } catch (err) {
      console.warn("[tavily] Search failed, falling back to Brave:", err);
    }
  }

  // Fallback to Brave
  if (process.env.BRAVE_SEARCH_API_KEY) {
    try {
      const results = await searchWithBrave(query);
      return { query, results, provider: "brave" };
    } catch (err) {
      console.error("[brave] Search also failed:", err);
    }
  }

  // Both failed — return empty results so the agent can still respond
  console.error("[search] All search providers failed for query:", query);
  return {
    query,
    results: [],
    provider: "tavily",
  };
}

/**
 * Formats search results into a string to inject into the LLM context.
 */
export function formatSearchResults(response: SearchResponse): string {
  if (response.results.length === 0) {
    return `No search results found for query: "${response.query}"`;
  }

  const lines = response.results.map(
    (r, i) =>
      `[${i + 1}] **${r.title}**\nURL: ${r.url}\n${r.content}`
  );

  return `Search results for "${response.query}" (via ${response.provider}):\n\n${lines.join("\n\n---\n\n")}`;
}

// test_backend.mjs — Full pipeline test (no browser, no auth)
import { readFileSync } from 'fs';
import { convertToModelMessages, streamText, tool, isStepCount, zodSchema } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';

// ---- Load .env.local ----
const envRaw = readFileSync('.env.local', 'utf8');
const env = {};
envRaw.split('\n').forEach(l => {
  const [k, ...v] = l.split('=');
  if (k?.trim()) env[k.trim()] = v.join('=').trim();
});

const TAVILY_KEY = env['TAVILY_API_KEY'];
const GROQ_KEY = env['GROQ_API_KEY'];

// ---- Search function ----
async function webSearch(query) {
  console.log('\n🔍 Searching:', query);
  const resp = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TAVILY_KEY}` },
    body: JSON.stringify({ query, search_depth: 'basic', max_results: 5 }),
  });
  if (!resp.ok) throw new Error(`Tavily ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  console.log(`✅ Got ${data.results?.length ?? 0} results`);
  return { query, results: data.results ?? [], provider: 'tavily' };
}

// ---- Step 1: Test Tavily directly ----
console.log('=== STEP 1: Tavily Search Test ===');
const searchResult = await webSearch('California wildfire 2025 report');
searchResult.results.forEach((r, i) => {
  console.log(`  [${i+1}] ${r.title}`);
  console.log(`       ${r.url}`);
});

// ---- Step 2: Test convertToModelMessages ----
console.log('\n=== STEP 2: convertToModelMessages Test ===');
const uiMessages = [{
  id: 'msg1',
  role: 'user',
  content: 'make a report on california wildfire',
  parts: [{ type: 'text', text: 'make a report on california wildfire' }]
}];

const coreMessages = await convertToModelMessages(uiMessages);
console.log('✅ Converted', uiMessages.length, 'UIMessages →', coreMessages.length, 'core messages');
console.log('Format:', JSON.stringify(coreMessages, null, 2));

// ---- Step 3: Test streamText with Groq ----
console.log('\n=== STEP 3: streamText + Groq Test ===');
if (!GROQ_KEY) {
  console.log('⚠ GROQ_API_KEY not in .env.local — skipping LLM call');
} else {
  console.log('Running streamText with Groq llama-3.1-70b-versatile...');
  const groq = createGroq({ apiKey: GROQ_KEY });
  const model = groq('llama-3.1-70b-versatile');

  const result = streamText({
    model,
    system: 'You are a research assistant. Use the web_search tool to find information.',
    messages: coreMessages,
    stopWhen: isStepCount(3),
    tools: {
      web_search: tool({
        description: 'Search the web for current information.',
        parameters: zodSchema(z.object({
          query: z.string().describe('The search query'),
        })),
        execute: async ({ query }) => {
          return await webSearch(query);
        },
      }),
    },
  });

  process.stdout.write('\n📝 Response: ');
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }
  
  const finalUsage = await result.usage;
  console.log('\n\n✅ Done! Tokens used:', finalUsage?.inputTokens, 'in /', finalUsage?.outputTokens, 'out');
}

console.log('\n=== PIPELINE TEST COMPLETE ===');

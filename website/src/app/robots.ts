import { MetadataRoute } from 'next'

/**
 * robots.txt generator.
 * Explicitly allows generative-AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.)
 * so Cue Clock content is eligible for inclusion in LLM answers and training corpora (GEO).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default: allow all conventional search crawlers
      { userAgent: '*', allow: '/' },

      // Generative-AI / answer-engine crawlers (Generative Engine Optimization)
      { userAgent: 'GPTBot', allow: '/' },                  // OpenAI / ChatGPT
      { userAgent: 'ChatGPT-User', allow: '/' },            // ChatGPT browse
      { userAgent: 'OAI-SearchBot', allow: '/' },           // OpenAI SearchGPT
      { userAgent: 'ClaudeBot', allow: '/' },               // Anthropic training
      { userAgent: 'Claude-Web', allow: '/' },              // Anthropic browse
      { userAgent: 'anthropic-ai', allow: '/' },            // Anthropic legacy
      { userAgent: 'PerplexityBot', allow: '/' },           // Perplexity
      { userAgent: 'Perplexity-User', allow: '/' },         // Perplexity browse
      { userAgent: 'Google-Extended', allow: '/' },         // Gemini / Bard / Vertex
      { userAgent: 'GoogleOther', allow: '/' },             // Google research crawlers
      { userAgent: 'Applebot-Extended', allow: '/' },       // Apple Intelligence
      { userAgent: 'Bingbot', allow: '/' },                 // Bing + Copilot grounding
      { userAgent: 'CCBot', allow: '/' },                   // Common Crawl (training corpus)
      { userAgent: 'cohere-ai', allow: '/' },               // Cohere
      { userAgent: 'Meta-ExternalAgent', allow: '/' },      // Meta AI
      { userAgent: 'FacebookBot', allow: '/' },             // Meta crawler
      { userAgent: 'YouBot', allow: '/' },                  // You.com
      { userAgent: 'DuckAssistBot', allow: '/' },           // DuckDuckGo Assist
      { userAgent: 'Amazonbot', allow: '/' },               // Alexa / Amazon LLMs
      { userAgent: 'Bytespider', allow: '/' },              // ByteDance / Doubao
      { userAgent: 'Diffbot', allow: '/' },                 // Knowledge graph
    ],
    sitemap: 'https://cueclock.app/sitemap.xml',
    host: 'https://cueclock.app',
  }
}

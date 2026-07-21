// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MicroManus — Deep Research AI Agent",
  description:
    "MicroManus is a deep research AI agent that searches the web, synthesizes information, and generates structured reports using your own LLM API keys.",
  keywords: ["AI agent", "deep research", "web search", "Anthropic", "OpenAI", "report generation"],
  openGraph: {
    title: "MicroManus — Deep Research AI Agent",
    description: "AI-powered deep research with real web search and structured report generation.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

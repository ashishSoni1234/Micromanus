// lib/pdf/renderer.tsx
// Builds a @react-pdf/renderer Document from markdown content.
// Handles headings (H1-H3), paragraphs, bullet lists, ordered lists,
// bold/italic, code blocks, blockquotes, and horizontal rules.

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

interface PDFProps {
  markdown: string;
  title: string;
}

// Styles
const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 11,
    lineHeight: 1.6,
    color: "#1e293b",
    padding: 60,
    backgroundColor: "#ffffff",
  },
  // Cover header
  header: {
    marginBottom: 36,
    paddingBottom: 20,
    borderBottom: "2pt solid #6366f1",
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: "#1e1b4b",
    marginBottom: 6,
  },
  headerMeta: {
    fontSize: 10,
    color: "#64748b",
  },
  // Headings
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#1e1b4b", marginTop: 20, marginBottom: 8 },
  h2: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#312e81", marginTop: 16, marginBottom: 6 },
  h3: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#4338ca", marginTop: 12, marginBottom: 4 },
  // Body
  paragraph: { marginBottom: 8, color: "#334155", lineHeight: 1.65 },
  // Lists
  bulletItem: { flexDirection: "row", marginBottom: 4, paddingLeft: 8 },
  bulletDot: { width: 12, color: "#6366f1", fontFamily: "Helvetica-Bold" },
  bulletText: { flex: 1, color: "#334155" },
  // Code
  code: {
    fontFamily: "Courier",
    fontSize: 9.5,
    backgroundColor: "#f1f5f9",
    padding: 10,
    marginVertical: 8,
    borderRadius: 4,
    color: "#1e293b",
  },
  inlineCode: {
    fontFamily: "Courier",
    fontSize: 10,
    backgroundColor: "#f1f5f9",
    color: "#4f46e5",
  },
  // Blockquote
  blockquote: {
    borderLeft: "3pt solid #6366f1",
    paddingLeft: 12,
    marginVertical: 8,
    color: "#475569",
    fontFamily: "Helvetica-Oblique",
  },
  // Divider
  divider: { borderBottom: "1pt solid #e2e8f0", marginVertical: 12 },
  // Footer
  footer: { position: "absolute", bottom: 30, left: 60, right: 60, textAlign: "center", fontSize: 9, color: "#94a3b8" },
  pageNumber: { position: "absolute", bottom: 30, right: 60, fontSize: 9, color: "#94a3b8" },
});

// Simple markdown tokenizer — produces a list of typed blocks
type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullet"; items: string[] }
  | { type: "ordered"; items: string[] }
  | { type: "code"; text: string }
  | { type: "blockquote"; text: string }
  | { type: "divider" };

function parseMarkdown(md: string): Block[] {
  const lines = md.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2).trim() });
      i++;
    } else if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      i++;
    } else if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4).trim() });
      i++;
    } else if (line.startsWith("---") || line.startsWith("***") || line.startsWith("___")) {
      blocks.push({ type: "divider" });
      i++;
    } else if (line.startsWith("> ")) {
      let text = line.slice(2);
      while (i + 1 < lines.length && lines[i + 1].startsWith("> ")) {
        i++;
        text += "\n" + lines[i].slice(2);
      }
      blocks.push({ type: "blockquote", text });
      i++;
    } else if (line.startsWith("```")) {
      let code = "";
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        code += lines[i] + "\n";
        i++;
      }
      blocks.push({ type: "code", text: code.trim() });
      i++;
    } else if (/^[-*+] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+] /.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+] /, ""));
        i++;
      }
      blocks.push({ type: "bullet", items });
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      blocks.push({ type: "ordered", items });
    } else if (line.trim() === "") {
      i++;
    } else {
      // Accumulate paragraph lines
      let text = line;
      while (i + 1 < lines.length && lines[i + 1].trim() !== "" && !/^[#>\-*+`\d]/.test(lines[i + 1])) {
        i++;
        text += " " + lines[i];
      }
      // Strip markdown bold/italic for PDF (basic)
      const clean = text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/`([^`]+)`/g, "$1");
      blocks.push({ type: "paragraph", text: clean });
      i++;
    }
  }

  return blocks;
}

function BlockElement({ block }: { block: Block }) {
  switch (block.type) {
    case "h1": return <Text style={styles.h1}>{block.text}</Text>;
    case "h2": return <Text style={styles.h2}>{block.text}</Text>;
    case "h3": return <Text style={styles.h3}>{block.text}</Text>;
    case "paragraph": return <Text style={styles.paragraph}>{block.text}</Text>;
    case "code": return <Text style={styles.code}>{block.text}</Text>;
    case "blockquote": return <Text style={styles.blockquote}>{block.text}</Text>;
    case "divider": return <View style={styles.divider} />;
    case "bullet":
      return (
        <View>
          {block.items.map((item, i) => (
            <View key={i} style={styles.bulletItem}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{item.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1")}</Text>
            </View>
          ))}
        </View>
      );
    case "ordered":
      return (
        <View>
          {block.items.map((item, i) => (
            <View key={i} style={styles.bulletItem}>
              <Text style={styles.bulletDot}>{i + 1}.</Text>
              <Text style={styles.bulletText}>{item.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1")}</Text>
            </View>
          ))}
        </View>
      );
    default: return null;
  }
}

export function buildPdfDocument({ markdown, title }: PDFProps) {
  const blocks = parseMarkdown(markdown);
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <Document
      title={title}
      author="MicroManus"
      creator="MicroManus — Deep Research AI Agent"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerMeta}>Generated by MicroManus · {date}</Text>
        </View>

        {/* Content */}
        {blocks.map((block, i) => (
          <BlockElement key={i} block={block} />
        ))}

        {/* Footer */}
        <Text style={styles.footer} fixed>
          MicroManus — Deep Research AI Agent
        </Text>
        <Text
          style={styles.pageNumber}
          fixed
          render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `${pageNumber} / ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}

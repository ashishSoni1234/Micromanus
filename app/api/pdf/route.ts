// app/api/pdf/route.ts
// Generates a downloadable PDF from markdown content using @react-pdf/renderer
// Called with POST { markdown: string, title: string }

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { buildPdfDocument } from "@/lib/pdf/renderer";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { markdown, title } = await req.json();

  if (!markdown || typeof markdown !== "string") {
    return NextResponse.json({ error: "Missing markdown content" }, { status: 400 });
  }

  try {
    const doc = buildPdfDocument({ markdown, title: title ?? "Research Report" });
    const buffer = await renderToBuffer(doc);

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="micromanus-report-${Date.now()}.pdf"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (err) {
    console.error("[api/pdf] PDF generation error:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}

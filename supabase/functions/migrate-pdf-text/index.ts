import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProcessDocument {
  id: string;
  file_path: string;
  file_name: string;
  display_name: string | null;
}

interface MigrationResult {
  document_id: string;
  document_name: string;
  status: 'success' | 'skipped' | 'error';
  pages_extracted?: number;
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const documentId = url.searchParams.get("document_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (documentId) {
      const { data: doc, error: docError } = await supabase
        .from("process_documents")
        .select("id, file_path, file_name, display_name")
        .eq("id", documentId)
        .maybeSingle();

      if (docError || !doc) {
        return new Response(
          JSON.stringify({ error: "Document not found", details: docError }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await processDocument(supabase, doc as ProcessDocument);

      return new Response(
        JSON.stringify(result),
        { status: result.status === 'error' ? 500 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existingPages } = await supabase
      .from("pdf_text_pages")
      .select("process_document_id");

    const processedDocIds = new Set(
      (existingPages || []).map((p: { process_document_id: string }) => p.process_document_id)
    );

    const { data: allDocs, error: docsError } = await supabase
      .from("process_documents")
      .select("id, file_path, file_name, display_name")
      .order("created_at", { ascending: true });

    if (docsError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch documents", details: docsError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allDocuments = (allDocs || []) as ProcessDocument[];
    const unprocessedDocs = allDocuments.filter(doc => !processedDocIds.has(doc.id));

    return new Response(
      JSON.stringify({
        message: "Migration status",
        totalDocuments: allDocuments.length,
        alreadyProcessed: allDocuments.length - unprocessedDocs.length,
        remaining: unprocessedDocs.length,
        unprocessedIds: unprocessedDocs.map(d => ({
          id: d.id,
          name: d.display_name || d.file_name
        })),
        instructions: "Call with ?document_id=<id> to process one document at a time"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processDocument(supabase: any, doc: ProcessDocument): Promise<MigrationResult> {
  const docName = doc.display_name || doc.file_name;

  try {
    const { data: existingPages } = await supabase
      .from("pdf_text_pages")
      .select("id")
      .eq("process_document_id", doc.id)
      .limit(1);

    if (existingPages && existingPages.length > 0) {
      return {
        document_id: doc.id,
        document_name: docName,
        status: 'skipped'
      };
    }

    const { data: fileData, error: storageError } = await supabase.storage
      .from("process-documents")
      .download(doc.file_path);

    if (storageError || !fileData) {
      return {
        document_id: doc.id,
        document_name: docName,
        status: 'error',
        error: `Storage error: ${storageError?.message || 'File not found'}`
      };
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const pages = extractTextFromPDF(bytes);

    if (pages.length === 0) {
      return {
        document_id: doc.id,
        document_name: docName,
        status: 'error',
        error: 'No text could be extracted from PDF'
      };
    }

    const insertData = pages.map((text, index) => ({
      process_document_id: doc.id,
      page_number: index + 1,
      text_content: text
    }));

    const { error: insertError } = await supabase
      .from("pdf_text_pages")
      .insert(insertData);

    if (insertError) {
      return {
        document_id: doc.id,
        document_name: docName,
        status: 'error',
        error: `Insert error: ${insertError.message}`
      };
    }

    return {
      document_id: doc.id,
      document_name: docName,
      status: 'success',
      pages_extracted: pages.length
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      document_id: doc.id,
      document_name: docName,
      status: 'error',
      error: errorMessage
    };
  }
}

function extractTextFromPDF(bytes: Uint8Array): string[] {
  const pages: string[] = [];
  const pdfString = new TextDecoder('latin1').decode(bytes);

  const streamMatches = pdfString.matchAll(/stream\s*([\s\S]*?)\s*endstream/g);
  let allText = '';

  for (const match of streamMatches) {
    const streamContent = match[1];
    const textMatches = streamContent.matchAll(/\(([^)]*)\)\s*Tj|\[([^\]]*)\]\s*TJ/g);

    for (const textMatch of textMatches) {
      if (textMatch[1]) {
        allText += decodeEscapedString(textMatch[1]) + ' ';
      } else if (textMatch[2]) {
        const arrayContent = textMatch[2];
        const stringMatches = arrayContent.matchAll(/\(([^)]*)\)/g);
        for (const strMatch of stringMatches) {
          allText += decodeEscapedString(strMatch[1]);
        }
        allText += ' ';
      }
    }
  }

  const btMatches = pdfString.matchAll(/BT\s*([\s\S]*?)\s*ET/g);
  for (const match of btMatches) {
    const btContent = match[1];
    const textMatches = btContent.matchAll(/\(([^)]*)\)\s*Tj|\[([^\]]*)\]\s*TJ/g);

    for (const textMatch of textMatches) {
      if (textMatch[1]) {
        allText += decodeEscapedString(textMatch[1]) + ' ';
      } else if (textMatch[2]) {
        const arrayContent = textMatch[2];
        const stringMatches = arrayContent.matchAll(/\(([^)]*)\)/g);
        for (const strMatch of stringMatches) {
          allText += decodeEscapedString(strMatch[1]);
        }
        allText += ' ';
      }
    }
  }

  allText = allText.replace(/\s+/g, ' ').trim();

  if (allText.length === 0) {
    return [];
  }

  const pageCountMatch = pdfString.match(/\/Count\s+(\d+)/);
  const pageCount = pageCountMatch ? parseInt(pageCountMatch[1], 10) : 1;

  if (pageCount <= 1) {
    pages.push(allText);
  } else {
    const charsPerPage = Math.ceil(allText.length / pageCount);
    for (let i = 0; i < pageCount; i++) {
      const start = i * charsPerPage;
      const end = Math.min((i + 1) * charsPerPage, allText.length);
      const pageText = allText.substring(start, end).trim();
      if (pageText) {
        pages.push(pageText);
      }
    }
  }

  return pages;
}

function decodeEscapedString(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

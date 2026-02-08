import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as pdfParse from "npm:pdf-parse@1.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestPayload {
  process_document_id: string;
}

interface PageText {
  pageNumber: number;
  text: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { process_document_id }: RequestPayload = await req.json();

    if (!process_document_id) {
      return new Response(
        JSON.stringify({ error: "process_document_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: docData, error: docError } = await supabase
      .from("process_documents")
      .select("id, file_path, name")
      .eq("id", process_document_id)
      .maybeSingle();

    if (docError || !docData) {
      return new Response(
        JSON.stringify({ error: "Document not found", details: docError }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: existingPages } = await supabase
      .from("pdf_text_pages")
      .select("id")
      .eq("process_document_id", process_document_id)
      .limit(1);

    if (existingPages && existingPages.length > 0) {
      return new Response(
        JSON.stringify({
          message: "Text already extracted for this document",
          document_id: process_document_id
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: fileData, error: storageError } = await supabase.storage
      .from("process-pdfs")
      .download(docData.file_path);

    if (storageError || !fileData) {
      return new Response(
        JSON.stringify({ error: "Failed to download PDF", details: storageError }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const pages: PageText[] = [];

    const pdfData = await pdfParse.default(buffer, {
      pagerender: function(pageData: any) {
        return pageData.getTextContent().then(function(textContent: any) {
          let text = "";
          for (const item of textContent.items) {
            if (item.str) {
              text += item.str + " ";
            }
          }
          return text.trim();
        });
      }
    });

    const pageTexts = pdfData.text.split(/\f/);

    for (let i = 0; i < pageTexts.length; i++) {
      const pageText = pageTexts[i]?.trim() || "";
      pages.push({
        pageNumber: i + 1,
        text: pageText
      });
    }

    if (pages.length === 0 && pdfData.numpages > 0) {
      const fullText = pdfData.text || "";
      const avgCharsPerPage = Math.ceil(fullText.length / pdfData.numpages);

      for (let i = 0; i < pdfData.numpages; i++) {
        const start = i * avgCharsPerPage;
        const end = Math.min((i + 1) * avgCharsPerPage, fullText.length);
        pages.push({
          pageNumber: i + 1,
          text: fullText.substring(start, end).trim()
        });
      }
    }

    const insertData = pages.map(page => ({
      process_document_id,
      page_number: page.pageNumber,
      text_content: page.text
    }));

    const { error: insertError } = await supabase
      .from("pdf_text_pages")
      .insert(insertData);

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Failed to save extracted text", details: insertError }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        document_id: process_document_id,
        document_name: docData.name,
        pages_extracted: pages.length,
        total_characters: pages.reduce((sum, p) => sum + p.text.length, 0)
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

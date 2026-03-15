import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WordBox {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LineData {
  y: number;
  height: number;
  words: Array<{ text: string; x: number; width: number }>;
}

interface StructuredPage {
  lines: LineData[];
}

function buildWordBoxesFromStructured(structured: StructuredPage, canvasWidth: number, canvasHeight: number): WordBox[] {
  const wordBoxes: WordBox[] = [];
  for (const line of structured.lines) {
    const yPx = (line.y / 100) * canvasHeight;
    const hPx = (line.height / 100) * canvasHeight;
    for (const word of line.words) {
      const xPx = (word.x / 100) * canvasWidth;
      const wPx = (word.width / 100) * canvasWidth;
      if (word.text.trim()) {
        wordBoxes.push({ text: word.text, x: xPx, y: yPx, w: wPx, h: hPx });
      }
    }
  }
  return wordBoxes;
}

function buildWordBoxesFallback(text: string, canvasWidth: number, canvasHeight: number): WordBox[] {
  const wordBoxes: WordBox[] = [];
  const lines = text.split("\n").filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  const marginTop = canvasHeight * 0.04;
  const marginBottom = canvasHeight * 0.04;
  const marginLeft = canvasWidth * 0.06;
  const usableHeight = canvasHeight - marginTop - marginBottom;
  const lineHeight = usableHeight / lines.length;
  const lineSpacing = lines.length > 1 ? (usableHeight - lineHeight * lines.length) / (lines.length - 1) : 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineText = lines[lineIdx].trim();
    if (!lineText) continue;

    const yPx = marginTop + lineIdx * (lineHeight + lineSpacing);
    const words = lineText.split(/\s+/).filter(w => w.length > 0);
    const totalChars = words.reduce((sum, w) => sum + w.length, 0);
    const charWidth = totalChars > 0 ? (canvasWidth - marginLeft * 2) / totalChars : canvasWidth * 0.008;

    let xCursor = marginLeft;
    for (const word of words) {
      const wPx = word.length * charWidth;
      wordBoxes.push({ text: word, x: xCursor, y: yPx, w: wPx, h: lineHeight });
      xCursor += wPx + charWidth * 0.5;
    }
  }
  return wordBoxes;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { imageBase64, pageNumber, canvasWidth, canvasHeight } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "imageBase64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imageUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`;

    const cw = canvasWidth ?? 1700;
    const ch = canvasHeight ?? 2200;

    const systemPrompt = `Voce e um motor OCR preciso. Extraia o texto da imagem e retorne um JSON com coordenadas de cada palavra para permitir selecao de texto precisa sobre o PDF.

Retorne APENAS um objeto JSON valido neste formato exato (sem markdown, sem texto extra):
{
  "text": "texto completo da pagina",
  "lines": [
    {
      "y": <porcentagem do topo da pagina onde a linha comeca, 0-100>,
      "height": <porcentagem da altura da linha em relacao a pagina, ex: 1.5>,
      "words": [
        { "text": "palavra", "x": <porcentagem da esquerda onde a palavra comeca, 0-100>, "width": <porcentagem da largura da palavra, ex: 5.2> }
      ]
    }
  ]
}

Regras:
- y e height sao porcentagens da altura total da pagina (0 a 100)
- x e width sao porcentagens da largura total da pagina (0 a 100)
- Inclua TODAS as palavras visiveis na imagem
- Preserve a ordem de leitura natural (de cima para baixo, esquerda para direita)
- Texto em portugues e comum
- Se a pagina estiver em branco, retorne: {"text": "", "lines": []}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: imageUrl, detail: "high" },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${response.status}`, details: errorBody }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content?.trim() ?? "";

    let text = "";
    let wordBoxes: WordBox[] = [];

    try {
      const parsed = JSON.parse(rawContent) as { text?: string; lines?: LineData[] };
      text = parsed.text ?? "";
      if (parsed.lines && Array.isArray(parsed.lines) && parsed.lines.length > 0) {
        wordBoxes = buildWordBoxesFromStructured({ lines: parsed.lines }, cw, ch);
      } else if (text) {
        wordBoxes = buildWordBoxesFallback(text, cw, ch);
      }
    } catch {
      text = rawContent;
      if (text) {
        wordBoxes = buildWordBoxesFallback(text, cw, ch);
      }
    }

    return new Response(
      JSON.stringify({
        pageNumber,
        text,
        confidence: 95,
        wordBoxes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

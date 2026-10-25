import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { PUBLIC_SUPABASE_KEY, PUBLIC_SUPABASE_URL } from "@/lib/public-backend";
import { z } from "zod";

const RequestSchema = z.object({
  prompt: z.string().trim().min(8).max(12000),
  slideCount: z.number().int().min(4).max(20).optional(),
  audience: z.string().trim().max(300).optional(),
  style: z.enum(["modern", "minimal", "bold", "corporate"]).optional(),
});

type Slide = { title: string; subtitle?: string; bullets: string[]; layout?: "title" | "content" | "closing"; speakerNotes?: string };
type Deck = { title: string; subtitle: string; theme: { background: string; foreground: string; accent: string; muted: string }; slides: Slide[] };

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const hex = (value: string, fallback: string) => /^#?[0-9a-f]{6}$/i.test(value) ? value.replace("#", "").toUpperCase() : fallback;

function xmlText(text: string, x: number, y: number, w: number, h: number, size: number, color: string, bold = false, font = "Aptos") {
  const lines = text.split("\n").slice(0, 20);
  return `<p:sp><p:nvSpPr><p:cNvPr id="${Math.floor(Math.random()*100000)+2}" name="Text ${x}-${y}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" rIns="0" tIns="0" bIns="0" anchor="t"/><a:lstStyle/>${lines.map((line) => `<a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US" sz="${size}" b="${bold ? 1 : 0}" dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${font}"/></a:rPr><a:t xml:space="preserve">${esc(line)}</a:t></a:r><a:endParaRPr lang="en-US" sz="${size}"/></a:p>`).join("")}</p:txBody></p:sp>`;
}

function shapeRect(id: number, name: string, x: number, y: number, w: number, h: number, fill: string, radius = "rect") {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="${radius}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>`;
}

function slideXml(slide: Slide, index: number, deck: Deck) {
  const bg = hex(deck.theme.background, "10182B");
  const fg = hex(deck.theme.foreground, "F5F7FB");
  const accent = hex(deck.theme.accent, "7C75FF");
  const muted = hex(deck.theme.muted, "AAB4C8");
  const titleSlide = index === 0 || slide.layout === "title";
  const closing = index === deck.slides.length - 1 || slide.layout === "closing";
  const shapes = [
    shapeRect(2, "Accent bar", 0, 0, 118872, 6858000, accent),
    shapeRect(3, "Top glow", 118872, 0, 12000000, 110000, accent),
    xmlText(String(index + 1).padStart(2, "0"), 11300000, 220000, 900000, 300000, 1000, muted, true),
    xmlText(titleSlide ? deck.title : slide.title, titleSlide ? 760000 : 720000, titleSlide ? 1450000 : 650000, titleSlide ? 10800000 : 10800000, titleSlide ? 1500000 : 900000, titleSlide ? 3400 : 2600, fg, true),
  ];
  if (titleSlide) {
    shapes.push(xmlText(slide.subtitle || deck.subtitle || "A presentation created with TeraXGPT", 780000, 3100000, 10000000, 750000, 1800, muted));
    shapes.push(shapeRect(4, "Accent card", 780000, 4300000, 4500000, 45000, accent));
    if (slide.bullets?.length) shapes.push(xmlText(slide.bullets.slice(0, 3).join("\n"), 780000, 4700000, 9500000, 1000000, 1400, fg));
  } else {
    if (slide.subtitle) shapes.push(xmlText(slide.subtitle, 760000, 1550000, 10800000, 400000, 1200, muted));
    const bullets = (slide.bullets ?? []).slice(0, 7);
    const startY = slide.subtitle ? 2200000 : 1900000;
    const gap = Math.min(760000, Math.floor(3900000 / Math.max(1, bullets.length)));
    bullets.forEach((bullet, i) => {
      const y = startY + i * gap;
      shapes.push(shapeRect(10 + i, `Bullet marker ${i+1}`, 850000, y + 110000, 110000, 110000, accent, "ellipse"));
      shapes.push(xmlText(bullet, 1120000, y, 10000000, gap - 60000, 1500, fg, false));
    });
    if (closing) shapes.push(shapeRect(40, "Closing rule", 780000, 5700000, 5200000, 50000, accent));
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes.join("")}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function crc32(data: Uint8Array) {
  let crc = -1;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}
function u16(n: number) { return new Uint8Array([n & 255, (n >>> 8) & 255]); }
function u32(n: number) { return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]); }
function concat(parts: Uint8Array[]) { const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0)); let offset = 0; for (const p of parts) { out.set(p, offset); offset += p.length; } return out; }
function zipStore(entries: Array<{ name: string; content: string }>) {
  const enc = new TextEncoder(); const locals: Uint8Array[] = []; const centrals: Uint8Array[] = []; let offset = 0;
  for (const entry of entries) {
    const name = enc.encode(entry.name); const data = enc.encode(entry.content); const crc = crc32(data);
    const local = concat([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);
    locals.push(local);
    centrals.push(concat([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]));
    offset += local.length;
  }
  const central = concat(centrals);
  return concat([...locals, central, u32(0x06054b50),u16(0),u16(0),u16(entries.length),u16(entries.length),u32(central.length),u32(offset),u16(0)]);
}
function buildPptx(deck: Deck) {
  const entries: Array<{name:string;content:string}> = [];
  entries.push({name:"[Content_Types].xml",content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${deck.slides.map((_,i)=>`<Override PartName="/ppt/slides/slide${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")}</Types>`});
  entries.push({name:"_rels/.rels",content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`});
  entries.push({name:"ppt/presentation.xml",content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${deck.slides.map((_,i)=>`<p:sldId id="${256+i}" r:id="rId${i+2}"/>`).join("")}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="wide"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle/></p:presentation>`});
  entries.push({name:"ppt/_rels/presentation.xml.rels",content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${deck.slides.map((_,i)=>`<Relationship Id="rId${i+2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i+1}.xml"/>`).join("")}</Relationships>`});
  entries.push({name:"ppt/slideMasters/slideMaster1.xml",content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap accent1="4F46E5" accent2="06B6D4" accent3="22C55E" accent4="F59E0B" accent5="EC4899" accent6="64748B" bg1="FFFFFF" bg2="F1F5F9" tx1="111827" tx2="64748B" hlink="2563EB" folHlink="7C3AED"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`});
  entries.push({name:"ppt/slideMasters/_rels/slideMaster1.xml.rels",content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`});
  entries.push({name:"ppt/slideLayouts/slideLayout1.xml",content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`});
  entries.push({name:"ppt/slideLayouts/_rels/slideLayout1.xml.rels",content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`});
  const accent = hex(deck.theme.accent, "7C75FF"); const bg = hex(deck.theme.background, "10182B"); const fg = hex(deck.theme.foreground, "F5F7FB"); const muted = hex(deck.theme.muted, "AAB4C8");
  entries.push({name:"ppt/theme/theme1.xml",content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="TeraXGPT"><a:themeElements><a:clrScheme name="TeraXGPT"><a:dk1><a:srgbClr val="${bg}"/></a:dk1><a:lt1><a:srgbClr val="${fg}"/></a:lt1><a:dk2><a:srgbClr val="${muted}"/></a:dk2><a:lt2><a:srgbClr val="FFFFFF"/></a:lt2><a:accent1><a:srgbClr val="${accent}"/></a:accent1><a:accent2><a:srgbClr val="06B6D4"/></a:accent2><a:accent3><a:srgbClr val="22C55E"/></a:accent3><a:accent4><a:srgbClr val="F59E0B"/></a:accent4><a:accent5><a:srgbClr val="EC4899"/></a:accent5><a:accent6><a:srgbClr val="64748B"/></a:accent6><a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme><a:fontScheme name="Aptos"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme><a:fmtScheme name="TeraXGPT"><a:fillStyleLst><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:solidFill><a:schemeClr val="accent2"/></a:solidFill><a:solidFill><a:schemeClr val="accent3"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="accent2"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="accent3"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="lt1"/></a:solidFill><a:solidFill><a:schemeClr val="lt2"/></a:solidFill><a:solidFill><a:schemeClr val="lt1"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`});
  for (let i=0;i<deck.slides.length;i++) {
    entries.push({name:`ppt/slides/slide${i+1}.xml`,content:slideXml(deck.slides[i]!,i,deck)});
    entries.push({name:`ppt/slides/_rels/slide${i+1}.xml.rels`,content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`});
  }
  const bytes = zipStore(entries);
  let binary = ""; for (let i=0;i<bytes.length;i+=0x8000) binary += String.fromCharCode(...bytes.subarray(i, i+0x8000));
  return btoa(binary);
}

async function generateDeck(prompt: string, slideCount: number, audience: string, style: string, signal: AbortSignal): Promise<Deck> {
  // Use Google's API directly so eligible requests can use its free tier.
  const apiKey = process.env["GEMINI_API_KEY"] ?? process.env["GOOGLE_API_KEY"] ?? "";
  if (!apiKey) throw new Error("Gemini is not configured. Add GEMINI_API_KEY from Google AI Studio to the server environment.");

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are an expert presentation designer. Return only valid JSON, with no markdown fences or commentary." },
        {
          role: "user",
          content: `Create a high-quality PowerPoint presentation based on this request. Return ONLY valid JSON with this shape: {"title":string,"subtitle":string,"theme":{"background":"#RRGGBB","foreground":"#RRGGBB","accent":"#RRGGBB","muted":"#RRGGBB"},"slides":[{"title":string,"subtitle":string,"bullets":string[],"layout":"title"|"content"|"closing","speakerNotes":string}]}. Make exactly ${slideCount} slides including a title slide and a concise closing slide. Audience: ${audience || "general professional audience"}. Visual style: ${style}. Keep bullets concise, concrete, and useful; normally 3–5 bullets per content slide. Create a coherent narrative, strong titles, meaningful examples, and a clear takeaway. Do not invent precise statistics or citations; qualify assumptions and add sources to slide bullets when the topic needs current facts. User request: ${prompt}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.45,
      max_tokens: 9000,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    if (response.status === 429) throw new Error("Gemini free-tier rate limit reached. Try again later or check your Google AI Studio quota.");
    if (response.status === 401 || response.status === 403) throw new Error("Google Gemini rejected the API key. Check GEMINI_API_KEY in your server environment.");
    throw new Error(`Google Gemini returned HTTP ${response.status}: ${details.slice(0, 300)}`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  const raw = typeof content === "string" ? content : Array.isArray(content) ? content.map((part) => part.text ?? "").join("") : "";
  let parsed: unknown;
  try { parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); }
  catch { throw new Error("Gemini returned an invalid slide outline. Please try the request again."); }

  const shape = z.object({
    title: z.string().min(1).max(160),
    subtitle: z.string().max(300).default(""),
    theme: z.object({ background: z.string(), foreground: z.string(), accent: z.string(), muted: z.string() }),
    slides: z.array(z.object({ title: z.string().min(1).max(160), subtitle: z.string().max(300).optional(), bullets: z.array(z.string().max(400)).max(8).default([]), layout: z.enum(["title","content","closing"]).optional(), speakerNotes: z.string().max(2000).optional() })).min(4).max(20),
  });
  const deck = shape.parse(parsed);
  if (deck.slides.length > slideCount) deck.slides = deck.slides.slice(0, slideCount);
  if (deck.slides.length < slideCount) {
    while (deck.slides.length < slideCount) deck.slides.splice(deck.slides.length - 1, 0, { title: "Key takeaways", bullets: ["Summarize the most important insights", "Translate findings into practical next steps"], layout: "content" });
  }
  deck.slides[0]!.layout = "title";
  deck.slides[deck.slides.length - 1]!.layout = "closing";
  return deck as Deck;
}

export const Route = createFileRoute("/api/presentations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || PUBLIC_SUPABASE_URL;
        const anonKey = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || PUBLIC_SUPABASE_KEY || process.env["SUPABASE_ANON_KEY"];
        if (!token || !supabaseUrl || !anonKey) return Response.json({ error: "Sign in to create a PowerPoint." }, { status: 401 });
        const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } });
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data.user) return Response.json({ error: "Your session expired. Sign in again." }, { status: 401 });
        let body: unknown;
        try { body = await request.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
        const parsed = RequestSchema.safeParse(body);
        if (!parsed.success) return Response.json({ error: "Enter a presentation request under 12,000 characters." }, { status: 400 });
        try {
          const deck = await generateDeck(parsed.data.prompt, parsed.data.slideCount ?? 10, parsed.data.audience ?? "", parsed.data.style ?? "modern", request.signal);
          const pptxBase64 = buildPptx(deck);
          return Response.json({ deck, pptxBase64, fileName: `${deck.title.replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-").slice(0, 70) || "teraxgpt-presentation"}.pptx`, provider: "Gemini 3.8 Flash · Google free tier" });
        } catch (cause) {
          return Response.json({ error: cause instanceof Error ? cause.message : "PowerPoint generation failed." }, { status: 502 });
        }
      },
    },
  },
});

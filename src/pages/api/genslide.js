import { generateText } from "ai";
import { createMistral } from "@ai-sdk/mistral";

export const prerender = false;

const DEFAULT_SLIDE_LIMIT = 10;
const SLIDE_W = 1280;
const SLIDE_H = 720;

function getModel() {
  const apiKey =
    typeof process !== "undefined"
      ? process.env.MISTRAL_API_KEY
      : import.meta.env.MISTRAL_API_KEY;
  return createMistral({ apiKey })("mistral-large-latest");
}

// ─── Step 1: Refine prompt ────────────────────────────────────────────────────

export async function refinePrompt(prompt) {
  const { text } = await generateText({
    model: getModel(),
    prompt: `Kamu adalah presentation designer profesional. Ubah prompt berikut menjadi brief presentasi yang jelas dan detail.

Sertakan:
- Tujuan presentasi dan pesan utama
- Target audiens
- Tone visual yang direkomendasikan (formal/modern/playful/bold/minimalist/dll)

Balas HANYA dengan refined brief-nya saja, tanpa penjelasan tambahan.

Prompt: ${prompt}`,
  });
  return text.trim();
}

// ─── Step 2: Generate visual theme ───────────────────────────────────────────
// Theme dihasilkan SEKALI dan dipakai SEMUA slide agar konsisten.

export async function generateTheme(refinedPrompt) {
  const { text } = await generateText({
    model: getModel(),
    prompt: `Kamu adalah visual designer. Tentukan satu design system yang konsisten untuk seluruh presentasi berikut.

Brief: ${refinedPrompt}

Hasilkan design system dengan aturan:
- Pilih satu gaya visual utama: flat | glassmorphism | brutalist | editorial | gradient-bold | minimal-dark | minimal-light
- Tentukan palet warna: bg utama, bg sekunder, aksen primer, aksen sekunder, teks primer, teks sekunder
- Pilih dua Google Fonts: satu untuk heading, satu untuk body
- Tentukan border-radius: sharp (0-4px) | medium (8-16px) | rounded (20px+)
- Tentukan apakah pakai Material Icons: true/false
- Berikan CSS variables sebagai string yang bisa di-inject ke :root {}

Balas HANYA dengan JSON berikut, tanpa penjelasan, tanpa markdown fence:
{
  "style": "flat",
  "fontHeading": "Syne",
  "fontBody": "DM Sans",
  "useMaterialIcons": true,
  "googleFontsUrl": "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap",
  "materialIconsUrl": "https://fonts.googleapis.com/icon?family=Material+Icons",
  "cssVars": "--bg: #0f172a; --bg2: #1e293b; --accent: #6366f1; --accent2: #a5b4fc; --text: #f8fafc; --text2: #94a3b8; --radius: 12px; --font-heading: 'Syne', sans-serif; --font-body: 'DM Sans', sans-serif;"
}`,
  });
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ─── Step 3: Generate slide outline ──────────────────────────────────────────

export async function generateSlideOutline(refinedPrompt, slideLimit = DEFAULT_SLIDE_LIMIT) {
  const { text } = await generateText({
    model: getModel(),
    prompt: `Kamu adalah presentation strategist. Buat outline slide untuk presentasi berikut.

Aturan:
- Tepat ${slideLimit} slide
- Slide pertama SELALU cover/title slide
- Slide terakhir SELALU closing/thank-you slide
- Setiap slide punya SATU fokus pesan yang jelas
- Variasikan layout agar tidak monoton
- "layout" pilih dari: cover | content | split | list | quote | stat | closing

Balas HANYA dengan JSON array, tanpa penjelasan, tanpa markdown fence:
[{"slideId":1,"title":"...","layout":"cover","contentBrief":"...","keywords":"..."}]

Brief: ${refinedPrompt}`,
  });
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean).slice(0, slideLimit);
}

// ─── Step 4: Generate per-slide HTML ─────────────────────────────────────────

export async function generateSlide(slide, refinedPrompt, theme, relatedFiles = []) {
  const { slideId, title, layout, contentBrief, keywords } = slide;

  const fileHtml = relatedFiles.length
    ? relatedFiles.map((f) => `<img src="${f.url}" alt="${f.description}" style="max-width:100%;max-height:100%;object-fit:contain;">`).join("\n")
    : "";

  const layoutGuide = {
    cover:   `COVER: Judul presentasi besar (font-size 72-96px) terpusat vertikal+horizontal. Subtitle kecil di bawah judul. Elemen dekoratif background (shape, gradient, pattern). TIDAK ada paragraf panjang.`,
    content: `CONTENT: Area atas 20% = headline (font-size 42-52px). Area bawah 75% = satu paragraf (max 3 kalimat, font-size 22-26px) + elemen visual dekoratif di sisi kanan (ikon besar, shape, atau ilustrasi CSS).`,
    split:   `SPLIT: Kiri 50% = headline + paragraf pendek (2 kalimat). Kanan 50% = gambar atau elemen visual besar dengan background berbeda. Garis pemisah vertikal tipis di tengah.`,
    list:    `LIST: Headline di atas (font-size 42px). Di bawahnya 3-5 list items dalam grid atau flex. Tiap item: ikon Material Icons (jika useMaterialIcons=true, atau angka besar) + teks singkat max 8 kata. Spacing merata.`,
    quote:   `QUOTE: Satu kutipan besar (font-size 36-48px, font-style italic) TERPUSAT. Tanda kutip dekoratif besar sebagai ornamen. Nama sumber kecil di bawah kutipan. Background minimal.`,
    stat:    `STAT: Tampilkan 2-3 angka/statistik besar (font-size 80-120px, bold). Tiap angka punya label kecil di bawahnya. Layout grid horizontal. Sangat impactful dan minimalis.`,
    closing: `CLOSING: Pesan penutup singkat di tengah. CTA atau info kontak di bawahnya. Branding/nama kecil. Elemen dekoratif yang echo dengan cover.`,
  }[layout] || "Layout bebas yang sesuai konteks.";

  const { text } = await generateText({
    model: getModel(),
    prompt: `Kamu adalah expert HTML/CSS slide developer. Buat satu slide presentasi 16:9.

━━━ CONTEXT ━━━
Slide #${slideId} dari presentasi: "${refinedPrompt}"
Judul slide: "${title}"
Brief konten: ${contentBrief}
Keywords: ${keywords}
${fileHtml ? `Media tersedia (gunakan jika relevan):\n${fileHtml}` : ""}

━━━ DESIGN SYSTEM (WAJIB DIIKUTI SELURUH SLIDE) ━━━
CSS Variables yang sudah ada di :root (JANGAN override):
${theme.cssVars}
Font heading: ${theme.fontHeading}
Font body: ${theme.fontBody}
Style visual: ${theme.style}
Material Icons tersedia: ${theme.useMaterialIcons}

━━━ LAYOUT GUIDE ━━━
${layoutGuide}

━━━ SPESIFIKASI TEKNIS WAJIB ━━━
1. OUTPUT: HANYA <div class="slide" data-id="${slideId}" data-layout="${layout}">...</div>
2. UKURAN FIXED: width:${SLIDE_W}px; height:${SLIDE_H}px; overflow:hidden; position:relative; — TIDAK boleh berubah apapun yang terjadi
3. SEMUA CHILD menggunakan position absolute ATAU flex/grid dengan ukuran eksplisit — TIDAK ada elemen yang bisa memanjang keluar batas
4. TEKS: Selalu set max-width eksplisit, overflow:hidden, gunakan -webkit-line-clamp jika perlu
5. TIDAK ada <style> tag, <script> tag, atau @import — semua style INLINE
6. GUNAKAN var(--bg), var(--accent), var(--text), dll dari design system
7. FONT: gunakan font-family dari design system via var(--font-heading) dan var(--font-body)
8. MATERIAL ICONS (jika useMaterialIcons=true): gunakan <span class="material-icons">icon_name</span>
9. DILARANG: JavaScript, external resource baru, nested div melebihi 5 level

Balas HANYA dengan <div class="slide" ...>...</div> — tidak ada teks lain di luar tag.`,
  });

  // Strip anything outside the div.slide
  const raw = text.trim();
  const match = raw.match(/<div\s[^>]*class="slide"[\s\S]*<\/div>\s*$/);
  return match ? match[0].trim() : raw;
}

// ─── File mapping ─────────────────────────────────────────────────────────────

export function mapFiles(files, outline) {
  const mapping = {};
  for (const file of files) {
    const desc = file.description.toLowerCase();
    const isCover = desc.includes("cover") || desc.includes("awal") || desc.includes("depan");
    const matched = !isCover && outline.find((s) =>
      desc.includes(s.title.toLowerCase()) ||
      s.keywords?.toLowerCase().includes(desc.split(" ")[0])
    );
    const key = matched ? matched.slideId : 1;
    if (!mapping[key]) mapping[key] = [];
    mapping[key].push(file);
  }
  return mapping;
}

// ─── Assemble: PURE slide HTML, no export logic ──────────────────────────────

export function assembleSlidesHTML(title, outline, slideContents, theme) {
  const slides = outline
    .map((s) => slideContents[s.slideId] || `<div class="slide" data-id="${s.slideId}" data-layout="content" style="width:${SLIDE_W}px;height:${SLIDE_H}px;background:var(--bg);display:flex;align-items:center;justify-content:center;"><p style="color:var(--text);font-family:var(--font-body)">Slide ${s.slideId}</p></div>`)
    .join("\n\n");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="${theme.googleFontsUrl}" rel="stylesheet">
  ${theme.useMaterialIcons ? `<link href="${theme.materialIconsUrl}" rel="stylesheet">` : ""}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      ${theme.cssVars}
    }

    html, body {
      width: 100%; height: 100%;
      background: #0a0a0f;
      font-family: var(--font-body);
    }

    /* ── Slide enforcer ── */
    .slide {
      width: ${SLIDE_W}px !important;
      height: ${SLIDE_H}px !important;
      overflow: hidden !important;
      position: relative;
      flex-shrink: 0;
    }

    /* ── Container ── */
    .slides-container {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0;
    }

    .slide-wrapper {
      position: relative;
      transform-origin: top left;
      line-height: 0;
    }

    .slide-label {
      position: absolute;
      top: -20px; left: 0;
      font-size: 10px; color: rgba(255,255,255,0.2);
      font-family: monospace; line-height: 1;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="slides-container" id="slidesContainer">
${outline.map((s, i) => `    <div class="slide-wrapper" id="sw-${s.slideId}" data-index="${i}">
      <span class="slide-label">${i + 1} / ${outline.length}</span>
      ${slideContents[s.slideId] || ""}
    </div>`).join("\n")}
  </div>

  <script>
    // Expose slide data for parent window PDF export
    window.SLIDE_META = {
      title: ${JSON.stringify(title)},
      count: ${outline.length},
      w: ${SLIDE_W},
      h: ${SLIDE_H},
    };

    // Scale for preview
    function scaleSlides() {
      const vw = window.innerWidth;
      const scale = vw / ${SLIDE_W};
      const scaledH = ${SLIDE_H} * scale;
      document.querySelectorAll('.slide-wrapper').forEach(w => {
        w.style.transform = \`scale(\${scale})\`;
        w.style.width = '${SLIDE_W}px';
        w.style.height = '${SLIDE_H}px';
        w.style.marginBottom = (scaledH - ${SLIDE_H}) + 'px';
      });
      document.body.style.minHeight = (outline_count * scaledH) + 'px';
    }
    const outline_count = ${outline.length};
    scaleSlides();
    window.addEventListener('resize', scaleSlides);
  <\/script>
</body>
</html>`;
}

// ─── Core Pipeline ────────────────────────────────────────────────────────────

export async function generateSlides({ prompt, files = [], slideLimit = DEFAULT_SLIDE_LIMIT }) {
  const refined = await refinePrompt(prompt);

  // Theme + outline in parallel
  const [theme, outline] = await Promise.all([
    generateTheme(refined),
    generateSlideOutline(refined, slideLimit),
  ]);

  const fileMapping = mapFiles(files, outline);

  // Slides in parallel
  const slideContents = {};
  await Promise.all(
    outline.map(async (slide) => {
      const relatedFiles = fileMapping[slide.slideId] || [];
      slideContents[slide.slideId] = await generateSlide(slide, refined, theme, relatedFiles);
    })
  );

  const title = outline[0]?.title || "Presentasi AI";
  const html = assembleSlidesHTML(title, outline, slideContents, theme);
  return { html, outline, theme, refinedPrompt: refined };
}

// ─── Astro API Handler ────────────────────────────────────────────────────────

export async function POST({ request }) {
  try {
    const { prompt, files = [], slideLimit = DEFAULT_SLIDE_LIMIT } = await request.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const limit = Math.min(Math.max(2, Number(slideLimit)), 20);
    const { html, outline, theme } = await generateSlides({ prompt, files, slideLimit: limit });

    return new Response(JSON.stringify({ html, slideCount: outline.length, theme }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}


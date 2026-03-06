import { generateText } from "ai";
import { createMistral } from "@ai-sdk/mistral";

export const prerender = false;

const DEFAULT_PAGE_LIMIT = 8;

function getModel() {
  const apiKey =
    typeof process !== "undefined"
      ? process.env.MISTRAL_API_KEY
      : import.meta.env.MISTRAL_API_KEY;
  return createMistral({ apiKey })("mistral-large-latest");
}

// ─── Core Functions (importable) ────────────────────────────────────────────

export async function refinePrompt(prompt) {
  const { text } = await generateText({
    model: getModel(),
    prompt: `Kamu adalah editor dokumen profesional. Tugasmu adalah menyempurnakan prompt pengguna menjadi instruksi yang jelas, terstruktur, dan detail untuk menghasilkan dokumen berkualitas tinggi.

Tambahkan:
- Tujuan dokumen yang jelas
- Target pembaca
- Gaya penulisan yang sesuai
- Struktur konten yang logis

Balas HANYA dengan refined prompt-nya saja, tanpa penjelasan tambahan.

Prompt asli: ${prompt}`,
  });
  return text.trim();
}

export async function generateTOC(refinedPrompt, pageLimit = DEFAULT_PAGE_LIMIT) {
  const { text } = await generateText({
    model: getModel(),
    prompt: `Kamu adalah perancang struktur dokumen. Buat daftar isi untuk dokumen berikut.

Aturan:
- Maksimal ${pageLimit} halaman/bab
- Setiap bab harus relevan dan tidak redundan
- Urutan harus logis dari umum ke spesifik
- Sertakan keywords singkat untuk setiap bab (dipakai untuk cari gambar/referensi)

Balas HANYA dengan JSON array berikut, tanpa penjelasan, tanpa markdown fence:
[{"title":"...","pageId":1,"keywords":"..."}]

Dokumen: ${refinedPrompt}`,
  });
  const clean = text.replace(/```json|```/g, "").trim();
  const toc = JSON.parse(clean);
  return toc.slice(0, pageLimit);
}

export async function generatePage(title, keywords, refinedPrompt, relatedFiles = []) {
  const fileContext = relatedFiles.length
    ? `\nSisipkan elemen media berikut di posisi yang relevan dalam konten:\n${relatedFiles
        .map((f) => `<img src="${f.url}" alt="${f.description}" style="max-width:100%;">`)
        .join("\n")}`
    : "";

  const { text } = await generateText({
    model: getModel(),
    prompt: `Kamu adalah penulis konten profesional. Buat konten HTML lengkap untuk satu halaman dokumen.

Judul halaman: "${title}"
Keywords: ${keywords || title}
Konteks dokumen: ${refinedPrompt}
${fileContext}

Aturan penulisan:
- Gunakan bahasa yang sesuai dengan konteks dokumen
- Konten harus informatif, padat, dan mudah dipahami
- Gunakan heading (h2/h3), paragraf, dan list jika diperlukan
- Jangan tambahkan CSS inline kecuali untuk gambar

Balas HANYA dengan satu tag <div class="page">...</div>, tanpa penjelasan di luar tag tersebut.`,
  });
  return text.trim();
}

export function mapFiles(files, toc) {
  const mapping = {};
  for (const file of files) {
    const desc = file.description.toLowerCase();
    const isStart =
      desc.includes("awal") || desc.includes("cover") || desc.includes("depan");
    const matched = !isStart && toc.find((item) =>
      desc.includes(item.title.toLowerCase()) ||
      item.title.toLowerCase().includes(desc.split(" ")[0])
    );
    const key = matched ? matched.pageId : "start";
    if (!mapping[key]) mapping[key] = [];
    mapping[key].push(file);
  }
  return mapping;
}

export function assembleHTML(title, toc, pageContents, fileMapping) {
  const startFiles = (fileMapping["start"] || [])
    .map((f) => `<img src="${f.url}" alt="${f.description}" style="max-width:200px; display:block; margin-bottom:16px;">`)
    .join("\n");

  const pages = toc
    .map((item) => {
      const extraFiles = (fileMapping[item.pageId] || [])
        .map((f) => `<img src="${f.url}" alt="${f.description}" style="max-width:100%; margin:12px 0;">`)
        .join("\n");
      return pageContents[item.pageId] + (extraFiles ? `\n${extraFiles}` : "");
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 820px; margin: auto; padding: 40px 20px; color: #222; }
    h1 { font-size: 2rem; border-bottom: 2px solid #333; padding-bottom: 8px; }
    h2 { font-size: 1.4rem; margin-top: 24px; }
    h3 { font-size: 1.1rem; color: #444; }
    .page { margin: 40px 0; padding: 28px; border-bottom: 2px solid #e0e0e0; }
    .page:last-child { border-bottom: none; }
    img { max-width: 100%; border-radius: 6px; }
    ul, ol { padding-left: 20px; line-height: 1.8; }
    p { line-height: 1.75; }
  </style>
</head>
<body>
  ${startFiles}
  ${pages}
</body>
</html>`;
}

// ─── Core Pipeline (importable for CLI) ─────────────────────────────────────

export async function generateDocument({ prompt, files = [], pageLimit = DEFAULT_PAGE_LIMIT }) {
  const refined = await refinePrompt(prompt);
  const toc = await generateTOC(refined, pageLimit);
  const fileMapping = mapFiles(files, toc);

  const pageContents = {};
  await Promise.all(
    toc.map(async (item) => {
      const relatedFiles = fileMapping[item.pageId] || [];
      pageContents[item.pageId] = await generatePage(
        item.title,
        item.keywords,
        refined,
        relatedFiles
      );
    })
  );

  const docTitle = toc[0]?.title || "Dokumen AI";
  const html = assembleHTML(docTitle, toc, pageContents, fileMapping);
  return { html, toc, refinedPrompt: refined };
}

// ─── Astro API Handler ───────────────────────────────────────────────────────

export async function POST({ request }) {
  try {
    const { prompt, files = [], pageLimit = DEFAULT_PAGE_LIMIT } = await request.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const limit = Math.min(Math.max(1, Number(pageLimit)), 20);
    const { html } = await generateDocument({ prompt, files, pageLimit: limit });

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="doc.html"`,
      },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}


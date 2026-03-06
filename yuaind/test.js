// test-gendocs.js — CLI test for generateDocument
// Usage: node test-gendocs.js

import { generateDocument } from "./gendocs.js";
import { writeFileSync } from "fs";

const OUTPUT_FILE = "test-output.html";

const testPayload = {
  prompt: "Buat dokumen panduan AI untuk pemula",
  files: [
    {
      url: "https://placehold.co/300x80?text=Logo+Perusahaan",
      description: "logo perusahaan, taruh di awal dokumen",
    },
  ],
  pageLimit: 3,
};

console.log("🚀 Starting doc generation test...");
console.log(`📄 Prompt : "${testPayload.prompt}"`);
console.log(`🔢 Page limit : ${testPayload.pageLimit}`);
console.log(`📎 Files  : ${testPayload.files.length} file(s)\n`);

try {
  const { html, toc, refinedPrompt } = await generateDocument(testPayload);
  console.log("✅ Refined Prompt:\n", refinedPrompt);
  console.log("\n📑 TOC Generated:");
  toc.forEach((item) => console.log(`  [${item.pageId}] ${item.title} — keywords: ${item.keywords}`));
  console.log(`\n  Total pages: ${toc.length}`);

  writeFileSync(OUTPUT_FILE, html, "utf-8");
  console.log(`\n💾 Output saved to: ${OUTPUT_FILE}`);
} catch (err) {
  console.error("❌ Test failed:", err.message);
  process.exit(1);
}


import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

export const POST = async ({ request }) => {
  try {
    const { prompt } = await request.json();

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      system: `
        Kamu adalah generator teks HTML yang paham estetika
        sesuai konteks. Buat output hanya berupa kode HTML
        yang terdiri dari elemen div.text dan style#textStyle.
        Pahami jenis teks seperti formal, judul, aksi,
        atau minimalis sesuai prompt. Gunakan import font
        dari Google Fonts bila perlu, tambahkan style unik
        atau animasi. Output adalah HTML murni:
        hanya div.text dan style, tanpa penjelasan.
        Kamu boleh buat lebih dari 3 div.text dengan
        class berbeda (misalnya text-title, text-subtitle,
        text-left, text-right). Posisi bebas, default teks
        di tengah X Y.`,
      prompt: prompt,
    });

    // LOGIC: Sanitasi dari ```html atau ```
    // Regex ini bakal hapus block code markdown di awal/akhir jika ada
    const sanitizedHtml = text.replace(/```html|```/g, '').trim();

    // Return response berupa string HTML murni
    return new Response(sanitizedHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * generate-pdf.mjs
 *
 * Generates a 40-page A4 quiz PDF from the "INAUGURATION SHI" presentation
 * stored in Supabase.  The script is READ-ONLY — it never writes, updates or
 * deletes any database record or slide.
 *
 * Output: inauguration-shi-quiz.pdf  (in the same folder you run this from)
 *
 * Usage:
 *   node generate-pdf.mjs
 *
 * Each of the 20 slides produces 2 PDF pages:
 *   Page A — question + image + 4 options (NO answer marked)
 *   Page B — question + image + 4 options (correct option highlighted checkmark)
 *
 * Pages are interleaved: Q1, A1, Q2, A2, ... Q20, A20
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from .env.local
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  try {
    const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const line of envContent.split('\n')) {
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const k = line.slice(0, eqIdx).trim();
      const v = line.slice(eqIdx + 1).trim();
      if (k === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = v;
      if ((k === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' || k === 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') && !supabaseKey) supabaseKey = v;
    }
  } catch (e) {}
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Could not find Supabase credentials. Make sure .env.local exists.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const OPTION_COLORS = ['#8bc8d7', '#4fb57f', '#ffc20f', '#cb4b4b'];
const CORRECT_COLOR = '#1a8a4a';
const CORRECT_BORDER = '#0d5c30';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildSlideHTML(slide, slideNumber, totalSlides, isAnswerPage) {
  const options = (slide.options || []).slice(0, 4);

  const pageLabel = isAnswerPage
    ? '<span style="background:#1a8a4a;color:#fff;padding:4px 14px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:0.08em;">ANSWER KEY</span>'
    : '<span style="background:#1c1a18;color:#fff;padding:4px 14px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:0.08em;">QUESTION</span>';

  const optionsHTML = options.map((opt, i) => {
    const isCorrect = opt.is_correct;
    const showCorrect = isAnswerPage && isCorrect;
    const bg = showCorrect ? CORRECT_COLOR : (OPTION_COLORS[i] || '#ccc');
    const border = showCorrect ? ('3px solid ' + CORRECT_BORDER) : '2px solid #1c1a18';
    const checkmark = showCorrect
      ? '<span style="margin-left:auto;background:#fff;color:#1a8a4a;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;flex-shrink:0;">V</span>'
      : '';
    const textColor = (showCorrect || i === 3) ? '#fff' : '#12100f';

    return '<div style="display:flex;align-items:center;gap:12px;background:' + bg + ';border:' + border + ';border-radius:10px;padding:11px 16px;box-shadow:' + (showCorrect ? '0 0 0 3px rgba(26,138,74,0.25)' : '3px 3px 0 #1c1a18') + ';margin-bottom:10px;min-height:48px;">'
      + '<span style="width:32px;height:32px;border-radius:50%;background:' + (showCorrect ? '#fff' : '#1c1a18') + ';color:' + (showCorrect ? CORRECT_COLOR : '#fff') + ';display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;flex-shrink:0;">' + OPTION_LABELS[i] + '</span>'
      + '<span style="font-size:14px;font-weight:700;color:' + textColor + ';flex:1;line-height:1.35;">' + escapeHtml(opt.text) + '</span>'
      + checkmark
      + '</div>';
  }).join('');

  let mediaHTML = '';
  if (slide.media_url) {
    const isVideo = slide.media_type === 'video' || /\.(mp4|webm)/i.test(slide.media_url);
    if (isVideo) {
      mediaHTML = '<div style="text-align:center;margin:10px 0 14px;"><div style="display:inline-block;background:#f0e8d6;border:2px solid #1c1a18;border-radius:8px;padding:10px 18px;font-size:13px;color:#6d6056;font-weight:700;">Video media attached</div></div>';
    } else {
      mediaHTML = '<div style="text-align:center;margin:10px 0 14px;"><img src="' + escapeHtml(slide.media_url) + '" style="max-height:150px;max-width:100%;border-radius:10px;border:3px solid #1c1a18;box-shadow:4px 4px 0 #1c1a18;object-fit:contain;" onerror="this.style.display=\'none\'"/></div>';
    }
  }

  return '<div style="width:100%;height:100%;font-family:\'Segoe UI\',Arial,sans-serif;background:#e8ddcc;padding:28px 40px;box-sizing:border-box;display:flex;flex-direction:column;">'
    // Header
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">'
    + '<div style="display:flex;align-items:center;gap:10px;">'
    + '<div style="width:22px;height:22px;background:linear-gradient(145deg,#4fb57f,#7bc59d);border:2px solid #1c1a18;border-radius:4px;"></div>'
    + '<span style="font-size:20px;font-weight:900;color:#12100f;letter-spacing:0.02em;">WESTOMETER</span>'
    + '</div>'
    + '<div style="display:flex;align-items:center;gap:10px;">'
    + pageLabel
    + '<span style="background:#fff9f0;border:2px solid #1c1a18;border-radius:6px;padding:4px 12px;font-size:13px;font-weight:800;color:#12100f;">Q ' + slideNumber + ' / ' + totalSlides + '</span>'
    + '</div></div>'
    // Divider
    + '<div style="height:3px;background:#1c1a18;border-radius:2px;margin-bottom:16px;"></div>'
    // Question card
    + '<div style="background:#fff9f0;border:3px solid #1c1a18;border-radius:12px;padding:16px 22px;box-shadow:5px 5px 0 #1c1a18;margin-bottom:' + (slide.media_url ? '8px' : '16px') + ';text-align:center;">'
    + '<h2 style="margin:0;font-size:18px;font-weight:800;color:#12100f;line-height:1.4;">' + escapeHtml(slide.question) + '</h2>'
    + '</div>'
    // Media
    + mediaHTML
    // Options
    + '<div style="flex:1;">' + optionsHTML + '</div>'
    + '</div>';
}

function buildFullHTML(slides) {
  const total = slides.length;
  const pages = [];
  for (let i = 0; i < total; i++) {
    const slide = slides[i];
    pages.push('<div class="page">' + buildSlideHTML(slide, i + 1, total, false) + '</div>');
    pages.push('<div class="page">' + buildSlideHTML(slide, i + 1, total, true) + '</div>');
  }

  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8"/>\n<title>INAUGURATION SHI Quiz PDF</title>\n'
    + '<style>\n* { margin:0; padding:0; box-sizing:border-box; }\nbody { background:#888; }\n'
    + '.page { width:297mm; height:210mm; background:#e8ddcc; page-break-after:always; overflow:hidden; }\n'
    + '.page:last-child { page-break-after:avoid; }\n'
    + '@page { size:A4 landscape; margin:0; }\n'
    + '@media print { body { background:#e8ddcc; } .page { page-break-after:always; box-shadow:none; } }\n'
    + '</style>\n</head>\n<body>\n'
    + pages.join('\n')
    + '\n</body>\n</html>';
}

async function fetchPresentation() {
  console.log('Searching for "INAUGURATION SHI" presentation...');

  const { data: presentations, error } = await supabase
    .from('presentations')
    .select('id, title, description')
    .ilike('title', '%INAUGURATION SHI%');

  if (error) {
    console.error('Error fetching presentations:', error);
    process.exit(1);
  }

  if (!presentations || presentations.length === 0) {
    console.error('No presentation found matching "INAUGURATION SHI".');
    console.log('\nAvailable presentations:');
    const { data: all } = await supabase.from('presentations').select('id, title').order('created_at', { ascending: false });
    (all || []).forEach(p => console.log('  -', p.title, '(' + p.id + ')'));
    process.exit(1);
  }

  const pres = presentations[0];
  console.log('Found: "' + pres.title + '" (' + pres.id + ')');

  const { data: slides, error: slidesErr } = await supabase
    .from('slides')
    .select('*, slide_options(*)')
    .eq('presentation_id', pres.id)
    .order('order_index', { ascending: true });

  if (slidesErr) {
    console.error('Error fetching slides:', slidesErr);
    process.exit(1);
  }

  const formattedSlides = (slides || []).map(s => ({
    ...s,
    options: (s.slide_options || []).sort((a, b) => a.order_index - b.order_index),
  }));

  console.log('Found ' + formattedSlides.length + ' slides.');
  return { pres, slides: formattedSlides };
}

async function main() {
  const { pres, slides } = await fetchPresentation();

  if (slides.length === 0) {
    console.error('No slides found in this presentation.');
    process.exit(1);
  }

  const totalPages = slides.length * 2;
  console.log('Generating ' + totalPages + ' pages (' + slides.length + ' question + ' + slides.length + ' answer key pages)...');

  const html = buildFullHTML(slides);

  // Save HTML for debugging / manual print fallback
  const htmlPath = path.join(__dirname, 'inauguration-shi-quiz.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('HTML saved: ' + htmlPath);

  // Use puppeteer-core + system Chrome to render PDF
  console.log('Launching headless browser (system Chrome)...');
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer-core')).default;
  } catch (e) {
    console.error('puppeteer-core not found. Run: npm install --no-save puppeteer-core');
    process.exit(1);
  }

  // Detect system Chrome path (Windows / macOS / Linux)
  const possibleChromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];

  let chromePath = null;
  for (const p of possibleChromePaths) {
    try { if (fs.existsSync(p)) { chromePath = p; break; } } catch (e) {}
  }

  if (!chromePath) {
    console.error('Could not find Chrome. Please install Google Chrome or set CHROME_PATH env var.');
    process.exit(1);
  }
  console.log('Using Chrome at: ' + chromePath);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const browserPage = await browser.newPage();
  await browserPage.setContent(html, { waitUntil: 'networkidle0', timeout: 90000 });

  const pdfPath = path.join(__dirname, 'inauguration-shi-quiz.pdf');
  await browserPage.pdf({
    path: pdfPath,
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  await browser.close();

  const sizeMb = (fs.statSync(pdfPath).size / 1024 / 1024).toFixed(2);
  console.log('\nPDF generated successfully!');
  console.log('File:  ' + pdfPath);
  console.log('Size:  ' + sizeMb + ' MB');
  console.log('Pages: ' + totalPages + ' (' + slides.length + ' participant pages + ' + slides.length + ' answer key pages)\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

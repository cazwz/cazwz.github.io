#!/usr/bin/env node
/*
 * Lê a pasta "conteudo/" e gera "manifest.json", que o site usa para montar
 * as páginas. Roda sozinho no GitHub a cada push — você não precisa mexer aqui.
 *
 * Se o pacote "sharp" estiver instalado (npm install), também gera versões
 * leves das imagens em "_miniaturas/" para o site carregar rápido.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'conteudo');
const THUMBS = path.join(ROOT, '_miniaturas');
const OUT = path.join(ROOT, 'manifest.json');

const IMG = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
const VID = ['.mp4', '.webm', '.mov', '.m4v'];
const MAX_MB = 95; // GitHub recusa arquivos acima de 100 MB

const DEFAULT_TITLES = { '3d': '3D', foto: 'Foto', fotos: 'Foto', photo: 'Foto', drone: 'Drone', video: 'Vídeo', videos: 'Vídeo' };
const COLORS = ['#3cc8d0', '#d8d23a', '#4cc25a', '#c850c0', '#d8453c', '#5a6ad8'];

let sharp = null;
try { sharp = require('sharp'); } catch (_) { /* opcional */ }

const warnings = [];
const warn = (m) => { warnings.push(m); };

/* ---------- utilidades ---------- */

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const slugify = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
const natural = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
const isHidden = (name) => name.startsWith('.') || name.startsWith('_');
const toUrl = (abs) => path.relative(ROOT, abs).split(path.sep).map(encodeURIComponent).join('/');

function listDir(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return []; }
}

/** Lê arquivos "chave: valor". Tudo depois de uma linha "---" vira descrição. */
function readInfo(file) {
  const out = { _multi: {} };
  if (!fs.existsSync(file)) return out;
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*-{3,}\s*$/.test(line)) { i++; break; }
    if (/^\s*#/.test(line)) continue; // linhas com # são comentários
    const m = line.match(/^\s*([^:]+?)\s*:\s*(.*)$/);
    if (!m) {
      // linha sem "chave:" antes do --- : trata o resto como descrição
      if (line.trim()) break;
      continue;
    }
    // "https://..." não é chave
    if (/^https?$/i.test(m[1])) break;
    const key = norm(m[1]);
    const val = m[2].trim();
    if (!val) continue;
    (out._multi[key] = out._multi[key] || []).push(val);
    out[key] = val;
  }
  const rest = lines.slice(i).join('\n').trim();
  if (rest) out.descricao = out.descricao ? out.descricao + '\n\n' + rest : rest;
  return out;
}

function firstInfo(dir, names) {
  for (const n of names) {
    const p = path.join(dir, n);
    if (fs.existsSync(p)) return readInfo(p);
  }
  return { _multi: {} };
}

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Texto simples → HTML: parágrafos, quebras de linha, links e **negrito**. */
function textToHtml(text) {
  if (!text) return '';
  return text.split(/\n\s*\n/).map((p) => {
    let h = escapeHtml(p.trim());
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>`);
    return `<p>${h.replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

/** Entende links do YouTube, Vimeo ou qualquer outro player (iframe). */
function parseLink(raw) {
  const parts = raw.trim().split(/\s+/);
  const url = parts[0];
  const vertical = parts.slice(1).some((p) => /^(vertical|9:16|9x16)$/i.test(p));
  let m;
  if ((m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i))) {
    return { tipo: 'youtube', id: m[1], vertical: vertical || /\/shorts\//i.test(url) };
  }
  if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([\da-f]+))?/i))) {
    const h = (url.match(/[?&]h=([\da-f]+)/i) || [])[1] || m[2];
    return { tipo: 'vimeo', id: m[1], hash: h || null, vertical };
  }
  if (/^https?:\/\//i.test(url)) return { tipo: 'iframe', src: url, vertical };
  return null;
}

/** Nome da pasta "2025 - Cyberpunk Alley" → { ano: 2025, titulo: 'Cyberpunk Alley' } */
function parseFolderName(name) {
  let ano = null; let titulo = name.trim();
  let m = titulo.match(/^(\d{4})\s*[-–_.]\s*(.+)$/);
  if (m) { ano = m[1]; titulo = m[2]; }
  else if ((m = titulo.match(/^(.+?)\s*[-–_(]\s*(\d{4})\)?$/))) { titulo = m[1]; ano = m[2]; }
  m = titulo.match(/^\d{1,3}\s*[-_.]\s*(.+)$/); // "01 - Nome" → ordem manual
  let ordem = null;
  if (m && !ano) { ordem = parseInt(titulo, 10); titulo = m[1]; }
  return { ano, titulo: titulo.trim(), ordem };
}

function fileKey(abs) {
  const st = fs.statSync(abs);
  return crypto.createHash('sha1').update(path.relative(ROOT, abs) + ':' + st.size).digest('hex').slice(0, 14);
}

/* ---------- imagens ---------- */

const thumbJobs = [];

function imageEntry(abs) {
  const entry = { tipo: 'imagem', src: toUrl(abs), alt: path.parse(abs).name.replace(/[-_]+/g, ' ') };
  if (sharp && !/\.gif$/i.test(abs)) {
    const key = fileKey(abs);
    const small = path.join(THUMBS, key + '-800.webp');
    const large = path.join(THUMBS, key + '-2000.webp');
    entry.thumb = toUrl(small);
    entry.large = toUrl(large);
    thumbJobs.push({ abs, small, large, entry });
  }
  return entry;
}

async function runThumbs() {
  if (!sharp || !thumbJobs.length) return;
  fs.mkdirSync(THUMBS, { recursive: true });
  let made = 0;
  const queue = thumbJobs.slice();
  const worker = async () => {
    while (queue.length) {
      const job = queue.shift();
      try {
        const img = sharp(job.abs, { failOn: 'none' }).rotate();
        const meta = await img.metadata();
        const o = meta.orientation || 1;
        const w = o >= 5 ? meta.height : meta.width;
        const h = o >= 5 ? meta.width : meta.height;
        if (w && h) { job.entry.w = w; job.entry.h = h; }
        if (!fs.existsSync(job.small)) {
          await sharp(job.abs, { failOn: 'none' }).rotate().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 78 }).toFile(job.small);
          made++;
        }
        if (!fs.existsSync(job.large)) {
          await sharp(job.abs, { failOn: 'none' }).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toFile(job.large);
        }
      } catch (e) {
        warn(`Não consegui ler a imagem ${path.relative(ROOT, job.abs)} (${e.message})`);
        delete job.entry.thumb; delete job.entry.large;
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  // apaga miniaturas de arquivos que não existem mais
  const keep = new Set(thumbJobs.flatMap((j) => [path.basename(j.small), path.basename(j.large)]));
  for (const f of listDir(THUMBS)) if (f.isFile() && !keep.has(f.name)) fs.unlinkSync(path.join(THUMBS, f.name));
  if (made) console.log(`  ${made} miniatura(s) nova(s) gerada(s)`);
}

/* ---------- leitura das pastas ---------- */

function checkSize(abs) {
  const mb = fs.statSync(abs).size / 1048576;
  if (mb > MAX_MB) warn(`${path.relative(ROOT, abs)} tem ${mb.toFixed(0)} MB — o GitHub não aceita arquivos acima de 100 MB. Comprima o vídeo ou use um link do YouTube/Vimeo.`);
  else if (mb > 50) warn(`${path.relative(ROOT, abs)} tem ${mb.toFixed(0)} MB — funciona, mas vai demorar para carregar. Considere comprimir.`);
}

function findByBase(dir, base, exts) {
  for (const f of listDir(dir)) {
    if (!f.isFile()) continue;
    const p = path.parse(f.name);
    if (norm(p.name) === base && exts.includes(p.ext.toLowerCase())) return path.join(dir, f.name);
  }
  return null;
}

function readProject(catSlug, dir, name, usedSlugs) {
  const parsed = parseFolderName(name);
  const info = firstInfo(dir, ['info.txt', 'info.md', 'sobre.txt', 'leia.txt']);

  const titulo = info.titulo || info.title || parsed.titulo;
  let slug = slugify(titulo);
  while (usedSlugs.has(slug)) slug += '-2';
  usedSlugs.add(slug);

  const coverName = info.capa ? norm(path.parse(info.capa).name) : 'capa';
  const coverFile = findByBase(dir, coverName, IMG) || findByBase(dir, 'cover', IMG) || findByBase(dir, 'thumb', IMG);

  const midia = [];
  // 1) links de vídeo do info.txt
  for (const key of ['video', 'videos', 'link de video', 'youtube', 'vimeo', 'embed']) {
    for (const raw of info._multi[key] || []) {
      for (const piece of raw.split(/\s*[,;]\s+(?=https?:)/)) {
        const l = parseLink(piece);
        if (l) midia.push(l); else warn(`Link de vídeo não reconhecido em ${catSlug}/${name}: ${piece}`);
      }
    }
  }
  // 2) arquivos da pasta, em ordem natural (01, 02, ... 10)
  const files = listDir(dir).filter((f) => f.isFile() && !isHidden(f.name)).map((f) => f.name).sort(natural.compare);
  const posters = {};
  for (const f of files) {
    const p = path.parse(f);
    if (IMG.includes(p.ext.toLowerCase())) posters[norm(p.name)] = path.join(dir, f);
  }
  for (const f of files) {
    const abs = path.join(dir, f);
    const p = path.parse(f);
    const ext = p.ext.toLowerCase();
    if (abs === coverFile) continue;
    if (IMG.includes(ext)) {
      // imagem com o mesmo nome de um vídeo vira capa do vídeo, não entra na galeria
      if (files.some((g) => VID.includes(path.extname(g).toLowerCase()) && norm(path.parse(g).name) === norm(p.name))) continue;
      midia.push(imageEntry(abs));
    } else if (VID.includes(ext)) {
      checkSize(abs);
      const v = { tipo: 'video', src: toUrl(abs), vertical: /vertical|9x16|9-16/i.test(p.name) };
      const poster = posters[norm(p.name)];
      if (poster) v.poster = toUrl(poster);
      if (ext === '.mov') warn(`${path.relative(ROOT, abs)} é .mov — alguns navegadores não tocam. Prefira exportar em .mp4 (H.264).`);
      midia.push(v);
    }
  }

  // capa: capa.jpg > primeira imagem > miniatura do YouTube/Vimeo > primeiro vídeo
  let capa = null;
  if (coverFile) capa = imageEntry(coverFile);
  else {
    const img = midia.find((m) => m.tipo === 'imagem');
    const yt = midia.find((m) => m.tipo === 'youtube' || m.tipo === 'vimeo');
    const vid = midia.find((m) => m.tipo === 'video');
    if (img) capa = img;
    else if (yt) capa = yt.tipo === 'youtube'
      ? { tipo: 'imagem', src: `https://i.ytimg.com/vi/${yt.id}/maxresdefault.jpg`, thumb: `https://i.ytimg.com/vi/${yt.id}/hqdefault.jpg` }
      : { tipo: 'imagem', src: `https://vumbnail.com/${yt.id}.jpg`, thumb: `https://vumbnail.com/${yt.id}.jpg` };
    else if (vid) capa = vid.poster ? { tipo: 'imagem', src: vid.poster } : { tipo: 'video', src: vid.src };
  }

  const ordemInfo = info.ordem ? parseInt(info.ordem, 10) : null;
  const ferramentas = (info.ferramentas || info.software || info.tags || '').split(/\s*[,;]\s*/).filter(Boolean);
  const links = [];
  for (const key of ['link', 'links', 'site']) {
    for (const raw of info._multi[key] || []) {
      const m = raw.match(/^(.*?)\s*(https?:\/\/\S+)\s*$/);
      if (m) links.push({ texto: m[1].replace(/[-–:|]\s*$/, '').trim() || m[2].replace(/^https?:\/\/(www\.)?/, '').split('/')[0], url: m[2] });
    }
  }

  return {
    slug,
    titulo,
    ano: info.ano || info.year || parsed.ano || null,
    tipo: info.tipo || info.categoria || null,
    cliente: info.cliente || null,
    funcao: info.funcao || info.papel || null,
    ferramentas,
    links,
    descricao: textToHtml(info.descricao || ''),
    resumo: (info.descricao || '').split('\n')[0].slice(0, 160),
    ordem: ordemInfo ?? parsed.ordem ?? null,
    capa,
    midia,
  };
}

function readCategory(dir, folder, index) {
  const slug = slugify(folder);
  const info = firstInfo(dir, ['_categoria.txt', '_info.txt', 'categoria.txt']);

  // reel: arquivo reel.mp4 na pasta OU "reel: link" no _categoria.txt
  let reel = null;
  const reelFile = findByBase(dir, 'reel', VID);
  if (reelFile) {
    checkSize(reelFile);
    reel = { tipo: 'video', src: toUrl(reelFile) };
    const poster = findByBase(dir, 'reel', IMG) || findByBase(dir, 'reel-capa', IMG);
    if (poster) reel.poster = toUrl(poster);
  } else if (info.reel) {
    reel = parseLink(info.reel);
    const poster = findByBase(dir, 'reel', IMG) || findByBase(dir, 'reel-capa', IMG);
    if (reel && poster) reel.poster = toUrl(poster);
  }

  const usedSlugs = new Set();
  const projetos = listDir(dir)
    .filter((d) => d.isDirectory() && !isHidden(d.name))
    .map((d) => readProject(slug, path.join(dir, d.name), d.name, usedSlugs))
    .filter((p) => {
      if (p.midia.length || p.capa) return true;
      warn(`"${folder}/${p.titulo}" está sem fotos/vídeos — não aparece no site até você colocar algo na pasta.`);
      return false;
    })
    .sort((a, b) => {
      if (a.ordem != null || b.ordem != null) return (a.ordem ?? 1e9) - (b.ordem ?? 1e9);
      if ((b.ano || 0) !== (a.ano || 0)) return String(b.ano || 0).localeCompare(String(a.ano || 0));
      return natural.compare(a.titulo, b.titulo);
    });

  // prévia da home: loop.mp4 > capa.jpg > reel.mp4 > capa do primeiro projeto
  const loop = findByBase(dir, 'loop', VID);
  const capaCat = findByBase(dir, 'capa', IMG);
  let preview = null;
  if (loop) {
    checkSize(loop);
    preview = { tipo: 'video', src: toUrl(loop) };
    if (capaCat) preview.poster = toUrl(capaCat);
  } else if (capaCat) preview = { tipo: 'imagem', src: toUrl(capaCat) };
  if (!preview && reel && reel.tipo === 'video') preview = { tipo: 'video', src: reel.src, poster: reel.poster };
  if (!preview) {
    const c = projetos.find((p) => p.capa && p.capa.tipo === 'imagem');
    if (c) preview = { tipo: 'imagem', src: c.capa.large || c.capa.src, thumb: c.capa.thumb };
  }

  return {
    slug,
    titulo: info.titulo || DEFAULT_TITLES[norm(folder)] || folder,
    descricao: textToHtml(info.descricao || ''),
    cor: info.cor || COLORS[index % COLORS.length],
    reel,
    preview,
    projetos,
  };
}

function readSite() {
  const s = firstInfo(ROOT, ['site.txt']);
  const redes = [];
  const add = (key, label, base) => {
    const v = s[key];
    if (!v) return;
    const url = /^https?:\/\//.test(v) ? v : base + v.replace(/^@/, '');
    redes.push({ nome: label, url, texto: /^https?:\/\//.test(v) ? v.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : '@' + v.replace(/^@/, '') });
  };
  add('instagram', 'Instagram', 'https://instagram.com/');
  add('behance', 'Behance', 'https://behance.net/');
  add('youtube', 'YouTube', 'https://youtube.com/@');
  add('vimeo', 'Vimeo', 'https://vimeo.com/');
  add('linkedin', 'LinkedIn', 'https://linkedin.com/in/');
  add('artstation', 'ArtStation', 'https://artstation.com/');
  add('twitter', 'X / Twitter', 'https://x.com/');
  return {
    nome: s.nome || 'Portfólio',
    marca: s.marca || s.nome || 'Portfólio',
    descricao: s.descricao || '',
    sobre: textToHtml(s.sobre || ''),
    email: s.email || null,
    telefone: s.telefone || s.whatsapp || null,
    cidade: s.cidade || null,
    redes,
    ordem: (s.categorias || '').split(/\s*,\s*/).filter(Boolean).map(slugify),
  };
}

async function main() {
  const t0 = Date.now();
  if (!fs.existsSync(CONTENT)) { console.error('Pasta "conteudo/" não encontrada.'); process.exit(1); }
  const site = readSite();
  const folders = listDir(CONTENT).filter((d) => d.isDirectory() && !isHidden(d.name)).map((d) => d.name);
  folders.sort((a, b) => {
    const ia = site.ordem.indexOf(slugify(a)); const ib = site.ordem.indexOf(slugify(b));
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || natural.compare(a, b);
  });
  const categorias = folders.map((f, i) => readCategory(path.join(CONTENT, f), f, i));
  await runThumbs();

  const manifest = { gerado: new Date().toISOString(), site, categorias };
  fs.writeFileSync(OUT, JSON.stringify(manifest, null, 1));

  console.log(`✔ manifest.json gerado em ${Date.now() - t0} ms`);
  for (const c of categorias) console.log(`  ${c.titulo.padEnd(8)} ${String(c.projetos.length).padStart(3)} projeto(s)${c.reel ? ' + reel' : ''}`);
  if (!sharp) console.log('  (sem miniaturas: rode "npm install" para gerar versões leves das imagens)');
  if (warnings.length) {
    console.log('\n⚠ Avisos:');
    for (const w of warnings) console.log('  - ' + w);
  }
}

module.exports = main;
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

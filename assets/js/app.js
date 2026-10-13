/*
 * Monta o site a partir do manifest.json (gerado automaticamente das pastas).
 * Rotas:  #/  ·  #/3d  ·  #/3d/nome-do-projeto  ·  #/contato
 */
(() => {
  'use strict';

  const main = document.getElementById('conteudo');
  const menu = document.querySelector('.menu');
  const marca = document.querySelector('.marca');
  const rodape = document.querySelector('.rodape');
  let dados = null;

  /* ---------- utilidades ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const isFoto = (cat) => /^(foto|fotos|photo|fotografia)$/.test(cat.slug);
  const reduzMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const temHover = matchMedia('(hover: hover)').matches;

  function embedUrl(m, autoplay) {
    const ap = autoplay ? 1 : 0;
    if (m.tipo === 'youtube') return `https://www.youtube-nocookie.com/embed/${m.id}?autoplay=${ap}&rel=0&modestbranding=1&playsinline=1`;
    if (m.tipo === 'vimeo') return `https://player.vimeo.com/video/${m.id}?${m.hash ? `h=${m.hash}&` : ''}autoplay=${ap}&title=0&byline=0&portrait=0&dnt=1`;
    return m.src;
  }
  function thumbDoLink(m) {
    if (m.tipo === 'youtube') return `https://i.ytimg.com/vi/${m.id}/maxresdefault.jpg`;
    if (m.tipo === 'vimeo') return `https://vumbnail.com/${m.id}.jpg`;
    return null;
  }
  function imgTag(m, sizes, extra = '') {
    const src = m.thumb || m.src;
    const srcset = m.thumb && m.large ? `srcset="${esc(m.thumb)} 800w, ${esc(m.large)} 2000w" sizes="${sizes}"` : '';
    const dim = m.w && m.h ? `width="${m.w}" height="${m.h}"` : '';
    return `<img src="${esc(src)}" ${srcset} ${dim} alt="${esc(m.alt || '')}" loading="lazy" decoding="async" ${extra}>`;
  }

  /* ---------- moldura (menu, rodapé) ---------- */
  function montarMoldura() {
    const s = dados.site;
    marca.textContent = s.marca;
    marca.setAttribute('aria-label', `${s.marca}: início`);
    menu.innerHTML = dados.categorias.map((c) =>
      `<a href="#/${c.slug}" style="--cor:${c.cor}" data-rota="${c.slug}"><span class="amostra"></span>${esc(c.titulo)}</a>`
    ).join('') + `<a href="#/contato" data-rota="contato">Contato</a>`;
    const barras = dados.categorias.map((c) => `<i style="background:${c.cor}"></i>`).join('');
    rodape.innerHTML = `
      <span><span class="barras" aria-hidden="true">${barras}</span>${esc(s.nome)} © ${new Date().getFullYear()}</span>
      ${s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : ''}`;
  }

  function marcarMenu(rota) {
    menu.querySelectorAll('a').forEach((a) => {
      if (a.dataset.rota === rota) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  /* ---------- home ---------- */
  function paginaHome() {
    document.body.classList.add('na-home');
    document.title = `${dados.site.nome} — ${dados.site.descricao || 'Portfólio'}`;
    const faixas = dados.categorias.map((c) => {
      const p = c.preview;
      let midia = '<span class="faixa-vazia"></span>';
      if (p && p.tipo === 'video') {
        midia = `<video class="faixa-midia" src="${esc(p.src)}${p.poster ? '' : '#t=0.1'}" ${p.poster ? `poster="${esc(p.poster)}"` : ''} muted loop playsinline preload="metadata"></video>`;
      } else if (p) {
        midia = `<img class="faixa-midia" src="${esc(p.src)}" alt="" decoding="async">`;
      }
      return `
        <a class="faixa" href="#/${c.slug}" style="--cor:${c.cor}">
          ${midia}
          <span class="faixa-texto">
            <h2 class="display">${esc(c.titulo)}</h2>
            <p>${plural(c.projetos.length, 'projeto', 'projetos')}</p>
          </span>
        </a>`;
    }).join('');
    main.innerHTML = `<h1 class="skip">${esc(dados.site.nome)}</h1><section class="faixas">${faixas}</section>`;

    // vídeos tocam ao passar o mouse; em celular tocam quando aparecem na tela
    main.querySelectorAll('.faixa').forEach((f) => {
      const v = f.querySelector('video');
      if (!v || reduzMovimento) return;
      if (temHover) {
        f.addEventListener('mouseenter', () => v.play().catch(() => {}));
        f.addEventListener('mouseleave', () => v.pause());
        f.addEventListener('focus', () => v.play().catch(() => {}));
        f.addEventListener('blur', () => v.pause());
      } else {
        new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: .6 }).observe(f);
      }
    });
  }

  /* ---------- reel ---------- */
  function reelHtml(cat) {
    const r = cat.reel;
    if (!r) return '';
    const etiqueta = `<span class="reel-etiqueta"><span class="amostra"></span>Reel ${esc(cat.titulo)}</span>`;
    if (r.tipo === 'video') {
      return `<section class="reel" aria-label="Reel">${etiqueta}
        <video src="${esc(r.src)}" ${r.poster ? `poster="${esc(r.poster)}"` : ''} ${reduzMovimento ? '' : 'autoplay'} muted loop playsinline preload="metadata"></video>
        <button class="reel-som" type="button">Ativar som</button></section>`;
    }
    if (r.tipo === 'iframe') {
      return `<section class="reel" aria-label="Reel">
        <iframe src="${esc(r.src)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy" title="Reel"></iframe></section>`;
    }
    const poster = r.poster || thumbDoLink(r);
    return `<section class="reel" aria-label="Reel">${etiqueta}
      <button class="reel-play" type="button" data-embed="${esc(embedUrl(r, true))}">
        ${poster ? `<img src="${esc(poster)}" alt="" onerror="if(this.src.includes('maxresdefault'))this.src=this.src.replace('maxresdefault','hqdefault')">` : ''}
        <span class="botao">Assistir ao reel</span>
      </button></section>`;
  }

  function ligarReel() {
    const play = main.querySelector('.reel-play');
    if (play) play.addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.src = play.dataset.embed;
      f.allow = 'autoplay; fullscreen; picture-in-picture';
      f.allowFullscreen = true;
      f.title = 'Reel';
      play.replaceWith(f);
      main.querySelector('.reel-etiqueta')?.remove();
    });
    const som = main.querySelector('.reel-som');
    if (som) som.addEventListener('click', () => {
      const v = som.parentElement.querySelector('video');
      v.muted = !v.muted;
      if (!v.muted) { v.currentTime = 0; v.controls = true; v.play(); }
      som.textContent = v.muted ? 'Ativar som' : 'Silenciar';
    });
  }

  /* ---------- categoria ---------- */
  function capaHtml(p) {
    const c = p.capa;
    if (c && c.tipo === 'imagem') return imgTag(c, '(max-width: 760px) 100vw, 33vw', `onerror="if(this.src.includes('maxresdefault'))this.src=this.src.replace('maxresdefault','hqdefault')"`);
    if (c && c.tipo === 'video') return `<video src="${esc(c.src)}#t=0.5" muted playsinline preload="metadata"></video>`;
    return `<span class="claquete"><span>${esc(p.titulo)}</span></span>`;
  }

  function paginaCategoria(cat) {
    document.title = `${cat.titulo} — ${dados.site.nome}`;
    const proporcao = isFoto(cat) ? '3 / 2' : '16 / 9';
    const cartoes = cat.projetos.map((p) => `
      <li class="cartao">
        <a href="#/${cat.slug}/${p.slug}">
          <div class="quadro">${capaHtml(p)}</div>
          <div class="legenda"><h3>${esc(p.titulo)}</h3>${p.ano ? `<span class="ano">${esc(p.ano)}</span>` : ''}</div>
          ${p.tipo ? `<p class="tipo">${esc(p.tipo)}</p>` : ''}
        </a>
      </li>`).join('');

    main.innerHTML = `
      <div class="pagina" style="--cor:${cat.cor}; --proporcao:${proporcao}">
        <header class="cat-cabeca">
          <h1 class="display">${esc(cat.titulo)}<span class="amostra" aria-hidden="true"></span></h1>
          <div class="intro">${cat.descricao}<p class="contagem">${plural(cat.projetos.length, 'projeto', 'projetos')}</p></div>
        </header>
        ${reelHtml(cat)}
        ${cat.projetos.length
          ? `<ul class="grade">${cartoes}</ul>`
          : `<p class="vazio">Nenhum projeto aqui ainda. Crie uma pasta dentro de <code>conteudo/${esc(cat.slug)}/</code> com suas imagens ou vídeos e publique.</p>`}
      </div>`;
    ligarReel();
  }

  /* ---------- projeto ---------- */
  function playerHtml(m) {
    if (m.tipo === 'video') {
      return `<div class="player"><video src="${esc(m.src)}" ${m.poster ? `poster="${esc(m.poster)}"` : ''} controls playsinline preload="metadata"></video></div>`;
    }
    return `<div class="player"><iframe src="${esc(embedUrl(m, false))}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy" title="Vídeo"></iframe></div>`;
  }

  let galeriaAtual = [];

  function paginaProjeto(cat, p) {
    document.title = `${p.titulo} — ${dados.site.nome}`;
    const videos = p.midia.filter((m) => m.tipo !== 'imagem');
    const imagens = p.midia.filter((m) => m.tipo === 'imagem')
      .map((m, i) => (/[a-z]{3}/i.test(m.alt || '') ? m : { ...m, alt: `${p.titulo}, imagem ${i + 1}` }));
    galeriaAtual = imagens;

    const horizontais = videos.filter((m) => !m.vertical).map(playerHtml).join('');
    const verticais = videos.filter((m) => m.vertical);
    const galeria = imagens.length
      ? `<div class="galeria${imagens.length === 1 ? ' uma' : ''}">${imagens.map((m, i) =>
          `<button type="button" data-i="${i}" aria-label="Ampliar imagem ${i + 1}">${imgTag(m, imagens.length === 1 ? '100vw' : '(max-width: 760px) 100vw, 50vw')}</button>`).join('')}</div>`
      : '';

    const ficha = [
      ['Ano', p.ano], ['Tipo', p.tipo], ['Cliente', p.cliente], ['Função', p.funcao],
      ['Ferramentas', p.ferramentas && p.ferramentas.join(', ')],
    ].filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');

    const lista = cat.projetos;
    const i = lista.indexOf(p);
    const ant = lista[(i - 1 + lista.length) % lista.length];
    const prox = lista[(i + 1) % lista.length];
    const navegacao = lista.length > 1 ? `
      <nav class="proximo" aria-label="Outros projetos">
        <a href="#/${cat.slug}/${ant.slug}"><span class="rotulo">Anterior</span><span class="titulo">${esc(ant.titulo)}</span></a>
        <a class="depois" href="#/${cat.slug}/${prox.slug}"><span class="rotulo">Próximo</span><span class="titulo">${esc(prox.titulo)}</span></a>
      </nav>` : '';

    main.innerHTML = `
      <article class="pagina" style="--cor:${cat.cor}">
        <a class="voltar" href="#/${cat.slug}"><span class="amostra"></span>Voltar para ${esc(cat.titulo)}</a>
        <header class="proj-cabeca">
          <div>
            <h1 class="display">${esc(p.titulo)}</h1>
            ${p.descricao ? `<div class="descricao">${p.descricao}</div>` : ''}
          </div>
          <div>
            ${ficha ? `<dl class="ficha">${ficha}</dl>` : ''}
            ${p.links && p.links.length ? `<p class="links">${p.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.texto)}</a>`).join('')}</p>` : ''}
          </div>
        </header>
        <div class="midias">
          ${horizontais}
          ${verticais.length ? `<div class="verticais">${verticais.map(playerHtml).join('')}</div>` : ''}
          ${galeria}
        </div>
        ${navegacao}
      </article>`;

    main.querySelectorAll('.galeria button').forEach((b) => b.addEventListener('click', () => abrirLightbox(+b.dataset.i)));
  }

  /* ---------- contato ---------- */
  function paginaContato() {
    const s = dados.site;
    document.title = `Contato — ${s.nome}`;
    const redes = s.redes.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.nome)}</a><span>${esc(r.texto)}</span></li>`).join('');
    main.innerHTML = `
      <div class="pagina contato">
        <h1 class="display">Contato</h1>
        ${s.email ? `<a class="email" href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : ''}
        <div class="contato-grade">
          ${s.sobre ? `<section class="sobre"><h2>Sobre</h2>${s.sobre}</section>` : ''}
          <section>
            <h2>Onde me encontrar</h2>
            <ul>
              ${redes}
              ${s.telefone ? `<li><a href="https://wa.me/${esc(s.telefone.replace(/\D/g, ''))}" target="_blank" rel="noopener">WhatsApp</a><span>${esc(s.telefone)}</span></li>` : ''}
            </ul>
          </section>
        </div>
      </div>`;
  }

  /* ---------- lightbox ---------- */
  const lb = document.querySelector('.lightbox');
  const lbImg = lb.querySelector('img');
  let lbIndice = 0;
  function mostrarLightbox() {
    const m = galeriaAtual[lbIndice];
    lbImg.src = m.large || m.src;
    lbImg.alt = m.alt || '';
    lb.querySelector('.lb-contador').textContent = `${lbIndice + 1} / ${galeriaAtual.length}`;
    const varias = galeriaAtual.length > 1;
    lb.querySelector('.lb-ant').hidden = !varias;
    lb.querySelector('.lb-prox').hidden = !varias;
  }
  function abrirLightbox(i) { lbIndice = i; mostrarLightbox(); lb.showModal(); }
  const passo = (d) => { lbIndice = (lbIndice + d + galeriaAtual.length) % galeriaAtual.length; mostrarLightbox(); };
  lb.querySelector('.lb-fechar').addEventListener('click', () => lb.close());
  lb.querySelector('.lb-ant').addEventListener('click', () => passo(-1));
  lb.querySelector('.lb-prox').addEventListener('click', () => passo(1));
  lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
  lb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') passo(-1);
    if (e.key === 'ArrowRight') passo(1);
  });
  let toqueX = null;
  lb.addEventListener('touchstart', (e) => { toqueX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    if (toqueX === null) return;
    const dx = e.changedTouches[0].clientX - toqueX;
    if (Math.abs(dx) > 50) passo(dx < 0 ? 1 : -1);
    toqueX = null;
  });

  /* ---------- roteador ---------- */
  function rotear() {
    if (lb.open) lb.close();
    document.body.classList.remove('na-home');
    const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const [a, b] = partes;
    marcarMenu(a || '');
    window.scrollTo(0, 0);

    if (!a) return paginaHome();
    if (a === 'contato') return paginaContato();
    const cat = dados.categorias.find((c) => c.slug === a);
    if (cat && !b) return paginaCategoria(cat);
    const proj = cat && cat.projetos.find((p) => p.slug === b);
    if (proj) return paginaProjeto(cat, proj);

    document.title = `Página não encontrada — ${dados.site.nome}`;
    main.innerHTML = `<div class="aviso"><h1>Essa página não existe</h1><p>O projeto pode ter sido renomeado ou removido. <a href="#/">Voltar ao início</a>.</p></div>`;
  }

  async function iniciar() {
    try {
      const r = await fetch('manifest.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      dados = await r.json();
    } catch (e) {
      main.innerHTML = `<div class="aviso"><h1>O site ainda não foi montado</h1>
        <p>O arquivo <code>manifest.json</code> não foi encontrado. Ele é criado automaticamente pelo GitHub ao publicar.</p>
        <p>No GitHub: <strong>Settings → Pages → Source</strong> precisa estar em <strong>GitHub Actions</strong>.
        No computador: rode <code>npm run preview</code> e abra <code>http://localhost:8080</code> (abrir o index.html direto não funciona).</p></div>`;
      return;
    }
    montarMoldura();
    window.addEventListener('hashchange', rotear);
    rotear();
    main.focus({ preventScroll: true });
  }

  iniciar();
})();

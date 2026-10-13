# Portfólio — Caz's_Space

O site se monta sozinho a partir das pastas em `conteudo/`.
Você organiza os arquivos no computador, dá push, e em ~1 minuto o site está atualizado.

```
conteudo/
├── 3d/
│   ├── _categoria.txt          ← título, descrição e link do reel (opcional)
│   ├── reel.mp4                ← OU o reel como arquivo (opcional)
│   ├── 2025 - Cyberpunk Alley/
│   │   ├── capa.jpg            ← capa no grid (opcional)
│   │   ├── info.txt            ← texto e links de vídeo (opcional)
│   │   ├── 01.jpg
│   │   ├── 02.jpg
│   │   └── making-of.mp4
│   └── 2024 - Forest Well/
├── foto/
├── drone/
└── video/
```

## Adicionar um projeto

1. Crie uma pasta dentro da categoria com o nome **`ANO - Nome do projeto`**
   (ex.: `2025 - Cyberpunk Alley`). Ela vira uma página e um card no grid.
2. Jogue as imagens e vídeos dentro. Eles aparecem na ordem do nome do arquivo
   (`01.jpg`, `02.jpg`… use números para controlar a ordem).
3. Pronto. Publique (veja abaixo).

Opcional:
- **`capa.jpg`** — imagem do card no grid. Sem ela, vale a primeira imagem da pasta
  (ou a miniatura do YouTube, se o projeto só tiver link).
- **`info.txt`** — informações extras:

  ```
  tipo: Ambiente 3D
  ferramentas: Blender, After Effects
  cliente: Nome do cliente
  funcao: Direção e edição
  video: https://youtu.be/XXXXXXXX
  video: https://vimeo.com/123456789
  link: Ver no Behance https://www.behance.net/...
  ---
  Aqui embaixo do --- vai a descrição do projeto, em texto livre.
  Pode ter vários parágrafos.
  ```

  Todas as linhas são opcionais. Pode repetir `video:` quantas vezes quiser.
  Para vídeo em pé (Reels/Shorts), escreva `vertical` depois do link.
  Linhas que começam com `#` são ignoradas.

## Reel no topo de cada categoria

Escolha **um** dos dois:
- coloque um arquivo **`reel.mp4`** direto na pasta da categoria (ex.: `conteudo/3d/reel.mp4`)
  — ele toca sozinho, sem som, em loop, com botão para ativar o som;
- ou escreva `reel: https://youtu.be/...` no `_categoria.txt` da categoria.

Para a **página inicial**, cada faixa mostra (nesta ordem): `loop.mp4`, `capa.jpg`,
o `reel.mp4` ou a capa do primeiro projeto. Um `loop.mp4` curto (5–10 s, sem som, < 10 MB)
fica melhor.

## Esconder, ordenar, renomear

- Pasta que começa com `_` (ex.: `_rascunho`) **não aparece** no site.
- Pasta sem nenhuma imagem/vídeo também não aparece.
- Ordem no grid: ano mais recente primeiro. Para forçar, coloque `ordem: 1`, `ordem: 2`… no `info.txt`.
- Nome, e-mail, redes sociais e o texto "Sobre" ficam no **`site.txt`**.
- Para criar outra categoria, é só criar outra pasta em `conteudo/` e incluí-la em `categorias:` no `site.txt`.

## Publicar

**Configuração única** (só na primeira vez), no repositório do GitHub:
**Settings → Pages → Build and deployment → Source: `GitHub Actions`**.

Depois disso, todo push na branch `main` publica sozinho. Acompanhe na aba **Actions**
(bolinha verde = publicado). Se o build achar algum problema (arquivo grande demais,
link inválido), aparece um aviso no log.

Recomendado: usar o **GitHub Desktop** — ele aceita arquivos de até 100 MB
(o upload pelo navegador só aceita até 25 MB por arquivo).

## Tamanho dos arquivos

- O GitHub **recusa arquivos acima de 100 MB**. Vídeos acima de ~50 MB ficam lentos.
- Para vídeos longos, suba no YouTube/Vimeo e use o link no `info.txt`.
- Para `.mp4` no site, exporte em H.264 (no HandBrake: preset "Fast 1080p30").
- Fotos podem ir em tamanho original: o site gera versões leves automaticamente.

## Ver no computador antes de publicar (opcional)

Precisa do [Node.js](https://nodejs.org) instalado. No terminal, dentro da pasta do site:

```
npm install        # só na primeira vez
npm run preview
```

Abra http://localhost:8080. Adicionou arquivos? É só atualizar a página (F5).

> Abrir o `index.html` com dois cliques não funciona — o site precisa do `manifest.json`,
> que é gerado pelo `npm run preview` (no computador) ou pelo GitHub (ao publicar).

## Arquivos do site (não precisa mexer)

- `index.html`, `assets/` — visual e funcionamento do site
- `scripts/build.js` — lê as pastas e gera o `manifest.json`
- `.github/workflows/publicar.yml` — publicação automática

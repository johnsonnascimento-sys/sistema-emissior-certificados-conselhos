# Emissor de Certificados (Conselhos de Justiça)

Aplicação web estática (HTML + JavaScript no navegador) para gerar certificados em PDF a partir de uma planilha Excel (`.xlsx`) e um fundo (imagem).

## Como usar

1. Abra `index.html` no navegador (Chrome/Edge).
2. Em **Banco de Fontes**, as fontes padrão em `assets/` são carregadas automaticamente quando o site está hospedado (Vercel/GitHub Pages). Se necessário, você ainda pode carregar manualmente.
3. Selecione o **Fundo** (opcional). Se não selecionar, usa `assets/certificado-em-branco.png`.
4. Selecione a **planilha Excel** (exemplos em `assets/`).
5. Clique em **PROCESSAR LOTE (XLSX)**.

## Estrutura

- `index.html`: UI
- `src/`: código dividido por responsabilidade
- `assets/`: fontes/imagens e exemplos de planilha
- `docs/manual.pdf`: manual original

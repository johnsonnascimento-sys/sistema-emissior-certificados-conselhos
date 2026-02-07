# Plano de modularização e melhorias

## Objetivo

Reduzir acoplamento no `index.html`, separar responsabilidades e tornar as mudanças futuras (layout, regras de texto, regras de nome de arquivo, etc.) mais seguras.

## Estado atual (implementado)

- Extração do JavaScript inline para módulos por responsabilidade (scripts separados) em `src/`.
- Namespace único global `window.CertApp` para evitar poluição do escopo global.
- Correção de encoding no código JavaScript (strings e textos em PT-BR).
- Adição de padrões básicos de repo: `.editorconfig`, `.gitignore`, `README.md`.

## Módulos

- `src/font-db.js`: armazenamento das fontes via IndexedDB + atualização do status na UI.
- `src/excel.js`: leitura do Excel (SheetJS) e conversão para JSON.
- `src/text.js`: heurística de colunas, limpeza de strings, montagem do texto do certificado.
- `src/draw.js`: funções de desenho no PDF (nome e texto justificado).
- `src/process.js`: orquestração do fluxo (inputs -> geração -> ZIP).
- `src/main.js`: bootstrap e bind de eventos.

## Próximas melhorias (sugeridas)

1. Fundo padrão sem input: permitir escolher `assets/certificado-em-branco.png` por botão (exige servir via HTTP para `fetch` funcionar com segurança).
2. Pré-visualização: gerar um único PDF de preview antes do lote.
3. Configuração por perfil: presets de régua/posições por tipo de certificado.
4. Validação de planilha: checar colunas mínimas e alertar faltantes por linha.
5. Performance: gerar apenas um `PDFDocument` base por tipo e clonar páginas quando possível.


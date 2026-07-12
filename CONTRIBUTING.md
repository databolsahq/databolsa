# Contribuindo com o DataBolsa

Obrigado pelo interesse em melhorar o núcleo aberto do DataBolsa.

## Como este repositório é mantido

Este repositório reúne os **pacotes do núcleo aberto** do DataBolsa, publicados a
partir do nosso repositório principal de desenvolvimento, com os caminhos mantidos
idênticos à árvore de origem.

O que isso significa para você:

- **Issues e pull requests são bem-vindos** e revisados aqui.
- Um PR aceito é integrado no repositório principal (os caminhos coincidem, então
  aplica de forma limpa) e republicado aqui em seguida. Sua autoria é preservada.
- Como esta árvore é uma publicação do repositório principal, os mantenedores
  podem ressincronizá-la ocasionalmente. Faça branch a partir do `main` mais
  recente antes de abrir um PR.

## Regras básicas

- Ao enviar uma contribuição, você concorda que ela é licenciada sob **Apache-2.0**
  (a licença deste repositório).
- Mantenha as mudanças restritas aos pacotes abertos (`packages/*`, `api/`,
  `docs/`).
- Rode `bun run typecheck` antes de abrir um PR. `node scripts/smoke-packages.mjs --offline`
  valida que os pacotes empacotam, instalam e importam corretamente.

## Ambiente local

Veja o início rápido no [README](./README.md). Você precisa de Bun (e Node 18+
para os scripts de smoke).

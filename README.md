# Nethanel OS

Aplicação mobile-first para prestadores de serviço gerenciarem clientes, orçamento, agenda, execução, pagamentos e garantia.

## Stack

- React + TypeScript
- Vite
- Supabase Auth, Postgres e Storage
- PWA/web responsiva preparada para uso no celular

## Backend

O backend está ativo no projeto Supabase **Dalton Pessoal**, usando exclusivamente o schema `nethanel_os`.

Configure as variáveis em `.env`:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

O client usa `db: { schema: 'nethanel_os' }`.

## Fluxo atual

1. Login com e-mail/senha ou Google
2. Primeiro acesso cria a empresa e o usuário admin
3. Cadastro de clientes
4. Criação de OS e orçamento
5. Adição/remoção de serviços, peças, produtos, taxas e descontos
6. Compartilhamento da OS por WhatsApp
7. Cliente abre um link e aprova o orçamento sem login
8. Prestador atualiza o status da execução
9. Fotos antes/depois ficam em bucket privado
10. Pagamentos são registrados e podem ser confirmados
11. Cliente pode assinar diretamente na tela do celular
12. Garantia pode ser emitida após o serviço

## Rodar localmente

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

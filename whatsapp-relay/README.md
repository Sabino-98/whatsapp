# WhatsApp Relay

Encaminha mensagens do Grupo A para o Grupo B em lotes, trocando os links por uma URL sua. Use apenas em grupos que você administra.

## Requisitos

- Node.js 20.11 ou superior, ou Docker
- Um número de WhatsApp dedicado para o robô (não use o seu número pessoal)

## Rodar localmente

```bash
npm install
export ADMIN_TOKEN=$(openssl rand -hex 32)   # guarde este valor
export DATA_DIR=./data
npm start
```

Abra http://localhost:3000, entre com o token, escaneie o QR code em **WhatsApp > Aparelhos conectados** e preencha a configuração.

## Deploy

Suba o projeto para uma hospedagem que mantenha um processo contínuo e tenha disco persistente. Defina:

- `ADMIN_TOKEN`: o valor gerado acima
- `DATA_DIR=/data`

Monte um volume persistente em `/data`. Sem ele, a sessão do WhatsApp se perde a cada deploy.

## Instalar no Android

No Chrome, abra a URL do painel, toque no menu ⋮ e escolha **Adicionar à tela inicial**.

## Riscos

- A biblioteca Baileys não é oficial e viola os Termos de Serviço do WhatsApp. A conta pode ser banida.
- A pasta `data/` contém a sessão da conta. Nunca a versione nem a compartilhe.

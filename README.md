# Chatbot de IA — Projeto Integrador Metrô

Este repositório contém a primeira entrega da disciplina de **Inteligência Artificial**, desenvolvida como parte do **Projeto Integrador Metrô**.

O projeto consiste em um chatbot simples integrado ao WhatsApp por meio da **Evolution API**, utilizando **Node.js**, **Express**, **Axios**, **Dotenv** e **Webhook**.

Nesta etapa, o chatbot funciona como um protótipo inicial de atendimento automatizado, ainda sem integração direta com o sistema principal do Projeto Integrador.

---

## Objetivo

Criar um chatbot capaz de receber mensagens via WhatsApp, interpretar comandos simples e responder automaticamente ao usuário.

O chatbot tem como finalidade simular um atendimento relacionado ao sistema de autoatendimento do metrô, auxiliando o usuário com informações básicas sobre compra de bilhetes e funcionamento do serviço.

---

## Contexto do Projeto Integrador

O Projeto Integrador principal consiste em um sistema de autoatendimento para compra de bilhetes de metrô por meio de um totem.

O fluxo do sistema envolve:

* Seleção do bilhete no totem;
* Pagamento via Pix;
* Geração de QR Code para pagamento;
* Emissão de QR Code do bilhete;
* Utilização do QR Code para acesso à catraca.

O chatbot foi desenvolvido como uma solução complementar, com o objetivo de demonstrar automação no atendimento por WhatsApp.

---

## Tecnologias utilizadas

* Node.js
* Express
* Axios
* Dotenv
* Docker
* Evolution API
* Webhook
* WhatsApp

---

## Funcionalidades

* Receber mensagens enviadas pelo WhatsApp;
* Processar mensagens recebidas por webhook;
* Interpretar comandos simples;
* Enviar respostas automáticas ao usuário;
* Integrar o chatbot com a Evolution API;
* Simular atendimento automatizado relacionado ao Projeto Integrador Metrô.

---

## Estrutura do projeto

```bash
.
├── node_modules/
├── src/
│   └── server.js
├── .env
├── .env.evolution
├── .env.evolution.example
├── .env.example
├── .gitignore
├── docker-compose.evolution.yml
├── package-lock.json
├── package.json
└── README.md
```

---

## Descrição dos principais arquivos

### `src/server.js`

Arquivo principal do projeto. Ele é responsável por iniciar o servidor, receber mensagens via webhook e enviar respostas automáticas pelo WhatsApp utilizando a Evolution API.

### `.env`

Arquivo com as variáveis de ambiente do chatbot, como porta da aplicação, URL da Evolution API, chave de acesso e nome da instância.

> Este arquivo contém informações sensíveis e não deve ser enviado para o GitHub.

### `.env.evolution`

Arquivo com as variáveis de ambiente utilizadas pela Evolution API.

> Este arquivo também pode conter dados sensíveis e não deve ser enviado para o GitHub.

### `.env.example`

Arquivo de exemplo com as variáveis necessárias para configurar o chatbot.

### `.env.evolution.example`

Arquivo de exemplo com as variáveis necessárias para configurar a Evolution API.

### `.gitignore`

Arquivo responsável por definir quais arquivos e pastas não devem ser enviados para o GitHub.

### `docker-compose.evolution.yml`

Arquivo utilizado para subir a Evolution API por meio do Docker.

### `package.json`

Arquivo que contém as dependências do projeto e os scripts de execução.

---

## Pré-requisitos

Antes de executar o projeto, é necessário ter instalado:

* Node.js
* npm
* Docker Desktop
* WhatsApp no celular
* Navegador para acessar o painel da Evolution API

---

## Configuração das variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com base no arquivo `.env.example`.

Exemplo:

```env
PORT=3000

EVOLUTION_BASE_URL=http://localhost:8080
EVOLUTION_API_KEY=sua_chave_da_evolution
EVOLUTION_INSTANCE=nome_da_instancia
```

Também crie ou configure o arquivo `.env.evolution` com base no arquivo `.env.evolution.example`.

> Os arquivos `.env` e `.env.evolution` não devem ser enviados para o GitHub.

---

## Como executar o projeto

### 1. Instalar as dependências

No terminal, dentro da pasta do projeto, execute:

```bash
npm install
```

---

### 2. Subir a Evolution API com Docker

Execute o comando:

```bash
docker compose -f docker-compose.evolution.yml --env-file .env.evolution up -d
```

Depois, confira se os containers estão rodando:

```bash
docker ps
```

---

### 3. Acessar o painel da Evolution API

Com a Evolution API rodando, acesse no navegador:

```text
http://localhost:8080/manager
```

No painel, crie ou selecione a instância configurada no arquivo `.env`.

---

### 4. Conectar o WhatsApp

No painel da Evolution API, clique na opção para conectar a instância e gerar o QR Code.

Depois, no celular, acesse:

```text
WhatsApp > Configurações > Dispositivos conectados > Conectar um dispositivo
```

Escaneie o QR Code exibido no navegador para conectar o WhatsApp à instância.

---

### 5. Rodar o chatbot

Após conectar o WhatsApp, execute:

```bash
npm run dev
```

Caso o projeto não possua o script `dev`, execute diretamente:

```bash
node src/server.js
```

---

## Funcionamento do chatbot

O funcionamento ocorre por meio da integração entre WhatsApp, Evolution API e servidor Node.js.

Fluxo simplificado:

```text
Usuário envia mensagem no WhatsApp
        ↓
Evolution API recebe a mensagem
        ↓
Webhook envia os dados para o servidor Node.js
        ↓
O chatbot processa a mensagem
        ↓
A resposta automática é enviada pelo WhatsApp
```

---

## Exemplos de interação

Exemplos de mensagens que o usuário pode enviar:

```text
Olá
```

```text
Quero comprar um bilhete
```

```text
Como funciona o metrô?
```

```text
Quais formas de pagamento são aceitas?
```

O chatbot responde automaticamente, simulando um atendimento relacionado ao sistema de compra de bilhetes do metrô.

---

## Como parar o projeto

Para parar o chatbot no terminal, utilize:

```bash
CTRL + C
```

Para parar os containers da Evolution API, execute:

```bash
docker compose -f docker-compose.evolution.yml --env-file .env.evolution down
```

---

## Arquivos que não devem ser enviados ao GitHub

Recomenda-se manter no `.gitignore`:

```bash
node_modules
.env
.env.evolution
```

Esses arquivos não devem ser enviados porque podem conter dependências locais ou informações sensíveis, como chaves de API.

---

## Status do projeto

Em desenvolvimento.

Esta versão representa uma primeira entrega acadêmica, com foco na criação de um chatbot simples utilizando WhatsApp, webhook e Evolution API.

---

## Autores

Projeto desenvolvido para fins acadêmicos na disciplina de **Inteligência Artificial**, como parte do **Projeto Integrador Metrô**.

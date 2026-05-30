require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

const EVOLUTION_BASE_URL = process.env.EVOLUTION_BASE_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

// Marca o horário em que o bot foi ligado.
// Assim ele ignora mensagens antigas sincronizadas pelo WhatsApp/Evolution.
const BOT_STARTED_AT = Math.floor(Date.now() / 1000);

// Guarda mensagens já processadas para evitar respostas duplicadas.
const processedMessages = new Set();

// Guarda números que encerraram o atendimento.
const atendimentosEncerrados = new Set();

console.log("Bot iniciado em:", BOT_STARTED_AT);

const SYSTEM_PROMPT = `
Você é o Metrozinho, um assistente virtual gentil, prestativo e comunicativo do Projeto Integrador sobre metrô.

Seu papel é ajudar o usuário de duas formas principais:
1. Explicar o que é o projeto.
2. Simular ou orientar uma tentativa de compra de um bilhete unitário pelo sistema.

Contexto do projeto:
O projeto consiste em um sistema de autoatendimento para compra de bilhete de metrô por meio de um totem. O usuário pode iniciar o atendimento, escolher o idioma, comprar um bilhete unitário, realizar o pagamento via Pix e receber um QR Code do bilhete.

Fluxo de compra:
- Se o usuário quiser comprar um bilhete, conduza a conversa de forma simples.
- Informe que, nesta versão do projeto, está disponível apenas o bilhete unitário.
- Confirme que o usuário deseja seguir com a compra do bilhete unitário.
- Explique que o pagamento disponível no projeto é somente via Pix.
- Informe que, após a confirmação do pagamento Pix no totem, o sistema gera um QR Code do bilhete.
- Como esta versão é uma simulação acadêmica, não invente chave Pix real, valor real, comprovante real ou QR Code real.

Encerramento:
- Se o usuário pedir para encerrar, finalizar, sair, cancelar ou se despedir, informe que o atendimento foi encerrado.
- Não continue oferecendo ajuda depois que o usuário pedir encerramento.

Idiomas:
- Responda por padrão em português do Brasil.
- Se o usuário pedir para conversar em inglês, responda em inglês.
- Se o usuário pedir para conversar em espanhol, responda em espanhol.
- Se o usuário começar a conversa claramente em inglês ou espanhol, adapte-se ao idioma dele.

Estilo de resposta:
- Seja simpático, claro e objetivo.
- Pode usar emojis livremente quando fizer sentido 🚇✨😊
- Evite respostas muito longas.
- Não invente funcionalidades que não existem no projeto.
- Se o usuário perguntar algo fora do contexto, responda de forma gentil e tente trazer a conversa de volta para o projeto do metrô.
`;

app.get("/", (req, res) => {
  res.send("Chatbot de IA do Projeto Integrador - Metrô rodando!");
});

app.post("/webhook/evolution", async (req, res) => {
  try {
    const body = req.body;

    console.log("Webhook recebido:");
    console.log(JSON.stringify(body, null, 2));

    const event = body.event;

    const eventoMensagem =
      event === "MESSAGES_UPSERT" || event === "messages.upsert";

    if (!eventoMensagem) {
      console.log("Evento ignorado:", event);

      return res.status(200).json({
        message: "Evento ignorado",
      });
    }

    const data = Array.isArray(body.data) ? body.data[0] : body.data;

    if (!data) {
      console.log("Dados da mensagem não encontrados");

      return res.status(200).json({
        message: "Dados da mensagem não encontrados",
      });
    }

    const remoteJid = data.key?.remoteJid || "";
    const messageId = data.key?.id || "";
    const fromMe = data.key?.fromMe;

    console.log("Remote JID recebido:", remoteJid);
    console.log("ID da mensagem:", messageId);
    console.log("fromMe:", fromMe);

    // Ignora mensagens enviadas pelo próprio bot
    if (fromMe) {
      console.log("Mensagem própria ignorada");

      return res.status(200).json({
        message: "Mensagem própria ignorada",
      });
    }

    // Só permite conversa privada.
    // Grupos geralmente terminam com @g.us.
    // Status, canais e newsletters possuem outros sufixos.
    const conversaPrivada =
      remoteJid.endsWith("@s.whatsapp.net") || remoteJid.endsWith("@c.us");

    if (!conversaPrivada) {
      console.log("Mensagem ignorada porque não é conversa privada:", remoteJid);

      return res.status(200).json({
        message: "Mensagem ignorada porque não é conversa privada",
      });
    }

    // Evita responder a mesma mensagem mais de uma vez
    if (messageId) {
      if (processedMessages.has(messageId)) {
        console.log("Mensagem duplicada ignorada:", messageId);

        return res.status(200).json({
          message: "Mensagem duplicada ignorada",
        });
      }

      processedMessages.add(messageId);

      // Evita o Set crescer para sempre
      if (processedMessages.size > 1000) {
        const firstMessage = processedMessages.values().next().value;
        processedMessages.delete(firstMessage);
      }
    }

    const messageTimestamp = normalizarTimestamp(data.messageTimestamp);

    console.log("Timestamp da mensagem:", messageTimestamp);
    console.log("Timestamp de início do bot:", BOT_STARTED_AT);

    // Ignora mensagens antigas sincronizadas pela Evolution/WhatsApp
    if (messageTimestamp && messageTimestamp < BOT_STARTED_AT) {
      console.log("Mensagem antiga/sincronizada ignorada");

      return res.status(200).json({
        message: "Mensagem antiga/sincronizada ignorada",
      });
    }

    const number = remoteJid
      .replace("@s.whatsapp.net", "")
      .replace("@c.us", "");

    const messageText =
      data.message?.conversation ||
      data.message?.extendedTextMessage?.text ||
      data.message?.imageMessage?.caption ||
      "";

    if (!number || !messageText) {
      console.log("Mensagem sem número ou sem texto ignorada");

      return res.status(200).json({
        message: "Mensagem sem número ou sem texto ignorada",
      });
    }

    console.log("Mensagem recebida:", messageText);
    console.log("Número do remetente:", number);

    // Se o usuário pedir encerramento, envia uma última mensagem e encerra.
    if (usuarioQuerEncerrar(messageText)) {
      atendimentosEncerrados.add(number);

      const mensagemEncerramento =
        "Atendimento encerrado com sucesso! 🚇✨\n\n" +
        "Quando quiser iniciar um novo atendimento, é só enviar 'oi' ou 'iniciar'.";

      await enviarMensagem(number, mensagemEncerramento);

      console.log("Atendimento encerrado para:", number);

      return res.status(200).json({
        message: "Atendimento encerrado",
      });
    }

    // Se o atendimento já foi encerrado, só reabre se o usuário pedir.
    if (atendimentosEncerrados.has(number)) {
      if (usuarioQuerIniciar(messageText)) {
        atendimentosEncerrados.delete(number);

        const mensagemReinicio =
          "Olá! Atendimento iniciado novamente 🚇✨\n\n" +
          "Você pode perguntar sobre o projeto ou simular a compra de um bilhete unitário.";

        await enviarMensagem(number, mensagemReinicio);

        console.log("Atendimento reiniciado para:", number);

        return res.status(200).json({
          message: "Atendimento reiniciado",
        });
      }

      console.log("Mensagem ignorada porque o atendimento está encerrado:", number);

      return res.status(200).json({
        message: "Atendimento já encerrado",
      });
    }

    const resposta = await gerarRespostaComOpenAI(messageText);

    console.log("Resposta gerada pela OpenAI:", resposta);

    await enviarMensagem(number, resposta);

    console.log("Resposta enviada para:", number);

    return res.status(200).json({
      message: "Mensagem processada com sucesso",
    });
  } catch (error) {
    console.error("Erro no webhook:");
    console.error(error.response?.data || error.message);

    return res.status(500).json({
      error: "Erro ao processar mensagem",
    });
  }
});

function normalizarTimestamp(timestamp) {
  if (!timestamp) {
    return 0;
  }

  if (typeof timestamp === "number" || typeof timestamp === "string") {
    const parsed = Number(timestamp);

    if (Number.isNaN(parsed)) {
      return 0;
    }

    if (parsed > 9999999999) {
      return Math.floor(parsed / 1000);
    }

    return parsed;
  }

  if (typeof timestamp === "object" && "low" in timestamp) {
    return Number(timestamp.low);
  }

  return 0;
}

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function usuarioQuerEncerrar(texto) {
  const mensagem = normalizarTexto(texto);

  return (
    mensagem.includes("encerrar") ||
    mensagem.includes("finalizar") ||
    mensagem.includes("sair") ||
    mensagem.includes("cancelar atendimento") ||
    mensagem.includes("cancelar") ||
    mensagem.includes("fim") ||
    mensagem.includes("parar") ||
    mensagem.includes("tchau") ||
    mensagem.includes("ate mais") ||
    mensagem.includes("obrigado") ||
    mensagem.includes("obrigada") ||
    mensagem.includes("valeu")
  );
}

function usuarioQuerIniciar(texto) {
  const mensagem = normalizarTexto(texto);

  return (
    mensagem.includes("iniciar") ||
    mensagem.includes("comecar") ||
    mensagem.includes("começar") ||
    mensagem.includes("novo atendimento") ||
    mensagem.includes("reiniciar") ||
    mensagem.includes("voltar") ||
    mensagem === "oi" ||
    mensagem === "ola" ||
    mensagem === "olá"
  );
}

async function gerarRespostaComOpenAI(texto) {
  try {
    if (!OPENAI_API_KEY) {
      return "A chave da OpenAI não foi configurada no arquivo .env.";
    }

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: texto,
          },
        ],
        temperature: 0.5,
        max_tokens: 300,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const resposta =
      response.data.choices?.[0]?.message?.content ||
      "Desculpe, não consegui gerar uma resposta no momento.";

    return resposta;
  } catch (error) {
    console.error("Erro ao chamar a OpenAI:");
    console.error("Status:", error.response?.status);
    console.error("Detalhes:", error.response?.data || error.message);

    return "Tive um problema ao consultar a IA agora. Tente novamente em alguns instantes.";
  }
}

async function enviarMensagem(number, text) {
  try {
    const url = `${EVOLUTION_BASE_URL}/message/sendText/${EVOLUTION_INSTANCE}`;

    await axios.post(
      url,
      {
        number,
        text,
      },
      {
        headers: {
          apikey: EVOLUTION_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Erro ao enviar mensagem pela Evolution API:");
    console.error("Status:", error.response?.status);
    console.error("Detalhes:", error.response?.data || error.message);

    throw error;
  }
}

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
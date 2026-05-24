require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const EVOLUTION_BASE_URL = process.env.EVOLUTION_BASE_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

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
      return res.status(200).json({
        message: "Evento ignorado",
      });
    }

    const data = body.data;

    if (!data || data.key?.fromMe) {
      return res.status(200).json({
        message: "Mensagem própria ignorada",
      });
    }

    const remoteJid = data.key?.remoteJid;
    const number = remoteJid?.replace("@s.whatsapp.net", "");

    const messageText =
      data.message?.conversation ||
      data.message?.extendedTextMessage?.text ||
      "";

    if (!number || !messageText) {
      return res.status(200).json({
        message: "Mensagem sem texto ignorada",
      });
    }

    const resposta = gerarResposta(messageText);

    await enviarMensagem(number, resposta);

    return res.status(200).json({
      message: "Mensagem processada com sucesso",
    });
  } catch (error) {
    console.error("Erro no webhook:", error.response?.data || error.message);

    return res.status(500).json({
      error: "Erro ao processar mensagem",
    });
  }
});

function gerarResposta(texto) {
  const mensagem = texto.toLowerCase().trim();

  if (
    mensagem.includes("oi") ||
    mensagem.includes("olá") ||
    mensagem.includes("ola")
  ) {
    return (
      "Olá! Eu sou o chatbot do Projeto Integrador - Metrô 🚇\n\n" +
      "Digite uma opção:\n" +
      "1 - Sobre o projeto\n" +
      "2 - Funcionalidades do totem\n" +
      "3 - Tecnologias usadas\n" +
      "4 - Encerrar atendimento"
    );
  }

  if (mensagem === "1") {
    return "O projeto integrador consiste em um sistema de autoatendimento para compra de bilhetes de metrô por meio de um totem.";
  }

  if (mensagem === "2") {
    return "Nesta primeira versão, o totem possui telas de início, seleção de idioma, compra de bilhete, pagamento e finalização com QR Code.";
  }

  if (mensagem === "3") {
    return "As tecnologias utilizadas nesta entrega são Node.js, Express, Webhook e Evolution API.";
  }

  if (mensagem === "4") {
    return "Atendimento encerrado. Obrigada por testar o chatbot do projeto! 🚇";
  }

  return "Não entendi sua mensagem 😅\n\nDigite 'oi' para visualizar as opções disponíveis.";
}

async function enviarMensagem(number, text) {
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
}

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
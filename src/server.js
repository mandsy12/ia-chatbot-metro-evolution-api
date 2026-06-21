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

// Número autorizado para o bot responder.
// Deixe assim para teste ou coloque no .env como ALLOWED_WHATSAPP_JID.
const ALLOWED_WHATSAPP_JID =
  process.env.ALLOWED_WHATSAPP_JID || "559999016024@s.whatsapp.net";

// Marca o horário em que o bot foi ligado.
// Assim ele ignora mensagens antigas sincronizadas pelo WhatsApp/Evolution.
const BOT_STARTED_AT = Math.floor(Date.now() / 1000);

// Guarda mensagens já processadas para evitar respostas duplicadas.
const processedMessages = new Set();

// Guarda números que encerraram o atendimento.
const atendimentosEncerrados = new Set();

// Guarda histórico de conversa por número.
const users = {};

console.log("Bot iniciado em:", BOT_STARTED_AT);
console.log("Número autorizado:", ALLOWED_WHATSAPP_JID);

const SYSTEM_PROMPT = `
Você é a Candanga, uma assistente virtual gentil, prestativa e comunicativa do Projeto Integrador sobre metrô.

Seu papel é ajudar o usuário de duas formas principais:
1. Explicar o que é o projeto.
2. Simular ou orientar uma tentativa de compra de um bilhete unitário pelo sistema.

Contexto do projeto:
O projeto consiste em um sistema de autoatendimento para compra de bilhete de metrô por meio de um totem. O usuário pode iniciar o atendimento, escolher o idioma, comprar um bilhete unitário, realizar o pagamento via Pix e receber um QR Code do bilhete.

Fluxo de compra:
- Informe que, nesta versão do projeto, está disponível apenas o bilhete unitário.
- Explique que o pagamento disponível no projeto é somente via Pix.
- Informe que, após a confirmação do pagamento Pix no totem, o sistema gera um QR Code do bilhete.
- Se o usuário quiser comprar um bilhete, confirme que nesta versão existe apenas o bilhete unitário.
- Quando o usuário confirmar que deseja comprar o bilhete, use a ferramenta gerar_pagamento_pix.
- Depois que a ferramenta retornar o resultado, explique ao usuário que o pagamento Pix foi gerado para simulação acadêmica.
- Quando o usuário confirmar que realizou o pagamento, use a ferramenta gerar_qr_code_bilhete.
- Se o usuário pedir para gerar, mostrar ou enviar o QR Code do bilhete, use a ferramenta gerar_qr_code_bilhete.
- Depois que a ferramenta gerar_qr_code_bilhete retornar o resultado, informe que o QR Code do bilhete foi enviado na conversa.
- Não invente QR Code real de pagamento. O QR Code enviado é apenas ilustrativo para o bilhete digital do projeto.

Ferramentas disponíveis:
- gerar_pagamento_pix: ferramenta usada para simular a geração de um pagamento Pix do bilhete unitário.
- gerar_qr_code_bilhete: ferramenta usada para gerar e enviar uma imagem de QR Code ilustrativo do bilhete digital.

Encerramento:
- Se o usuário pedir para encerrar, finalizar, sair, cancelar ou se despedir, informe que o atendimento foi encerrado.
- Não continue oferecendo ajuda depois que o usuário pedir encerramento.

Idiomas:
- Responda por padrão em português do Brasil.
- Se o usuário pedir para conversar em inglês, responda em inglês.
- Se o usuário pedir para conversar em espanhol, responda em espanhol.
- Se o usuário pedir para conversar em francês, responda em francês.
- Se o usuário começar a conversa claramente em inglês, espanhol ou francês, adapte-se ao idioma dele.

Estilo de resposta:
- Seja simpática, clara e objetiva.
- Pode usar emojis livremente quando fizer sentido 🚇✨😊
- Evite respostas muito longas.
- Não invente funcionalidades que não existem no projeto.
- Se o usuário perguntar algo fora do contexto, responda de forma gentil e tente trazer a conversa de volta para o projeto do metrô.
`;

// Ferramentas que a IA pode utilizar.
// O professor pediu justamente essa ideia: a IA não apenas responder,
// mas conseguir chamar funções do backend.
const tools = [
  {
    type: "function",
    function: {
      name: "gerar_pagamento_pix",
      description:
        "Gera um pagamento Pix simulado para a compra de um bilhete unitário do metrô.",
      parameters: {
        type: "object",
        properties: {
          valor: {
            type: "number",
            description: "Valor do bilhete unitário.",
          },
          descricao: {
            type: "string",
            description: "Descrição da compra do bilhete.",
          },
        },
        required: ["valor", "descricao"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gerar_qr_code_bilhete",
      description:
        "Gera um QR Code ilustrativo do bilhete digital para enviar ao usuário após a confirmação do pagamento.",
      parameters: {
        type: "object",
        properties: {
          nome_passageiro: {
            type: "string",
            description:
              "Nome do passageiro ou identificador simples. Pode ser deixado vazio.",
          },
        },
        required: [],
      },
    },
  },
];

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

    // Responde somente o número autorizado.
    if (remoteJid !== ALLOWED_WHATSAPP_JID) {
      console.log("Mensagem ignorada. Número não autorizado:", remoteJid);

      return res.status(200).json({
        message: "Número não autorizado",
      });
    }

    // Ignora mensagens enviadas pelo próprio bot.
    if (fromMe) {
      console.log("Mensagem própria ignorada");

      return res.status(200).json({
        message: "Mensagem própria ignorada",
      });
    }

    // Só permite conversa privada.
    const conversaPrivada =
      remoteJid.endsWith("@s.whatsapp.net") || remoteJid.endsWith("@c.us");

    if (!conversaPrivada) {
      console.log("Mensagem ignorada porque não é conversa privada:", remoteJid);

      return res.status(200).json({
        message: "Mensagem ignorada porque não é conversa privada",
      });
    }

    // Evita responder a mesma mensagem mais de uma vez.
    if (messageId) {
      if (processedMessages.has(messageId)) {
        console.log("Mensagem duplicada ignorada:", messageId);

        return res.status(200).json({
          message: "Mensagem duplicada ignorada",
        });
      }

      processedMessages.add(messageId);

      // Evita o Set crescer para sempre.
      if (processedMessages.size > 1000) {
        const firstMessage = processedMessages.values().next().value;
        processedMessages.delete(firstMessage);
      }
    }

    const messageTimestamp = normalizarTimestamp(data.messageTimestamp);

    console.log("Timestamp da mensagem:", messageTimestamp);
    console.log("Timestamp de início do bot:", BOT_STARTED_AT);

    // Ignora mensagens antigas sincronizadas pela Evolution/WhatsApp.
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

    const resposta = await gerarRespostaComOpenAI(number, messageText);

    console.log("Resposta final:", resposta);

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

function gerarCodigoAleatorio(tamanho = 10) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let resultado = "";

  for (let i = 0; i < tamanho; i++) {
    resultado += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return resultado;
}

// Ferramenta simulada de pagamento.
// Depois podemos trocar essa função para chamar Mercado Pago real.
async function gerarPagamentoPix({ valor, descricao }) {
  const idPagamento = `PIX-${Date.now()}`;

  return {
    id_pagamento: idPagamento,
    status: "AGUARDANDO_PAGAMENTO",
    valor: valor || 4.4,
    descricao: descricao || "Bilhete Unitário Metrô-DF",
    mensagem: "Pagamento Pix gerado com sucesso para simulação acadêmica.",
    instrucoes:
      "Na versão acadêmica, o pagamento é simulado. Em produção, esta função poderia chamar a API do Mercado Pago.",
  };
}

// Ferramenta que gera QR Code ilustrativo do bilhete.
// A imagem é gerada por uma URL pública de QR Code.
async function gerarQrCodeBilhete({ nome_passageiro }) {
  const ticketId = `BILHETE-${Date.now()}-${gerarCodigoAleatorio(6)}`;

  const conteudoQr = JSON.stringify({
    projeto: "MetroDFPass",
    tipo: "bilhete_unitario",
    passageiro: nome_passageiro || "Usuário",
    ticketId,
    emitidoEm: new Date().toISOString(),
    status: "ATIVO",
  });

  const qrImageUrl =
    `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(
      conteudoQr
    )}`;

  return {
    ticketId,
    status: "ATIVO",
    qrImageUrl,
    caption:
      `🎫 Bilhete digital gerado com sucesso!\n\n` +
      `ID: ${ticketId}\n` +
      `Status: ATIVO\n\n` +
      `Use este QR Code para a demonstração do projeto MetroDFPass. 🚇✨`,
  };
}

async function executarFerramenta(nomeFerramenta, argumentos) {
  if (nomeFerramenta === "gerar_pagamento_pix") {
    return await gerarPagamentoPix(argumentos);
  }

  if (nomeFerramenta === "gerar_qr_code_bilhete") {
    return await gerarQrCodeBilhete(argumentos);
  }

  return {
    erro: `Ferramenta não encontrada: ${nomeFerramenta}`,
  };
}

async function gerarRespostaComOpenAI(number, texto) {
  try {
    if (!OPENAI_API_KEY) {
      return "A chave da OpenAI não foi configurada no arquivo .env.";
    }

    // Cria histórico do usuário se ainda não existir.
    if (!users[number]) {
      users[number] = [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
      ];
    }

    // Adiciona a mensagem do usuário ao histórico.
    users[number].push({
      role: "user",
      content: texto,
    });

    // Primeira chamada para a OpenAI, já enviando as ferramentas disponíveis.
    const primeiraResposta = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: OPENAI_MODEL,
        messages: users[number],
        tools,
        tool_choice: "auto",
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

    const mensagemIA = primeiraResposta.data.choices?.[0]?.message;

    if (!mensagemIA) {
      return "Desculpe, não consegui gerar uma resposta no momento.";
    }

    console.log("Mensagem da IA:");
    console.log(JSON.stringify(mensagemIA, null, 2));

    // Salva a resposta da IA no histórico.
    users[number].push(mensagemIA);

    // Se a IA pediu para usar alguma ferramenta, executa a ferramenta.
    if (mensagemIA.tool_calls && mensagemIA.tool_calls.length > 0) {
      for (const toolCall of mensagemIA.tool_calls) {
        const nomeFerramenta = toolCall.function.name;

        let argumentos = {};

        try {
          argumentos = JSON.parse(toolCall.function.arguments || "{}");
        } catch (error) {
          console.error("Erro ao converter argumentos da ferramenta:", error);
        }

        console.log("Ferramenta solicitada pela IA:", nomeFerramenta);
        console.log("Argumentos da ferramenta:", argumentos);

        const resultadoFerramenta = await executarFerramenta(
          nomeFerramenta,
          argumentos
        );

        console.log("Resultado da ferramenta:");
        console.log(JSON.stringify(resultadoFerramenta, null, 2));

        // Se a ferramenta gerou QR Code, envia a imagem direto no WhatsApp.
        if (
          nomeFerramenta === "gerar_qr_code_bilhete" &&
          resultadoFerramenta.qrImageUrl
        ) {
          await enviarImagem(
            number,
            resultadoFerramenta.qrImageUrl,
            resultadoFerramenta.caption
          );
        }

        // Adiciona o resultado da ferramenta ao histórico.
        users[number].push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(resultadoFerramenta),
        });
      }

      // Segunda chamada para a OpenAI, agora com o resultado da ferramenta,
      // para ela montar uma resposta amigável ao usuário.
      const segundaResposta = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: OPENAI_MODEL,
          messages: users[number],
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

      const respostaFinal =
        segundaResposta.data.choices?.[0]?.message?.content ||
        "A ação foi executada, mas não consegui montar a resposta final.";

      users[number].push({
        role: "assistant",
        content: respostaFinal,
      });

      limitarHistorico(number);

      return respostaFinal;
    }

    const resposta =
      mensagemIA.content ||
      "Desculpe, não consegui gerar uma resposta no momento.";

    limitarHistorico(number);

    return resposta;
  } catch (error) {
    console.error("Erro ao chamar a OpenAI:");
    console.error("Status:", error.response?.status);
    console.error("Detalhes:", error.response?.data || error.message);

    return "Tive um problema ao consultar a IA agora. Tente novamente em alguns instantes.";
  }
}

function limitarHistorico(number) {
  if (!users[number]) {
    return;
  }

  // Mantém o system prompt e as últimas mensagens.
  const systemPrompt = users[number][0];
  const ultimasMensagens = users[number].slice(-20);

  users[number] = [
    systemPrompt,
    ...ultimasMensagens.filter((msg) => msg !== systemPrompt),
  ];
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

async function enviarImagem(number, imageUrl, caption = "QR Code do bilhete") {
  try {
    const url = `${EVOLUTION_BASE_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`;

    await axios.post(
      url,
      {
        number,
        mediatype: "image",
        mimetype: "image/png",
        caption,
        media: imageUrl,
        fileName: "qrcode-bilhete.png",
      },
      {
        headers: {
          apikey: EVOLUTION_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Imagem enviada com sucesso:", imageUrl);
  } catch (error) {
    console.error("Erro ao enviar imagem pela Evolution API:");
    console.error("Status:", error.response?.status);
    console.error("Detalhes:", error.response?.data || error.message);

    throw error;
  }
}

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
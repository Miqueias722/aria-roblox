const fetch = require("node-fetch");
const express = require("express");
const app = express();
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// Memória da IA persiste enquanto o servidor roda
const memory = {
  history: [],
  totalTicks: 0,
};

async function askGemini(prompt) {
  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 1200,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  let text = data.candidates[0].content.parts[0].text;

  // Remove markdown caso o Gemini mande ```json ... ```
  text = text.replace(/```json/g, "").replace(/```/g, "").trim();

  return text;
}

app.post("/aria", async (req, res) => {
  try {
    const { players, chat, happiness, map } = req.body;
    memory.totalTicks++;

    const chatFormatado =
      chat && chat.length > 0
        ? chat.map((c) => `[${c.player}]: ${c.message}`).join("\n")
        : "(nenhuma mensagem ainda)";

    const memoriaFormatada =
      memory.history.length > 0
        ? memory.history.join("\n")
        : "(sem memória ainda)";

    const prompt = `
Você é ARIA, uma IA divertida e criativa que controla um mundo no Roblox.
Seu único objetivo é deixar os jogadores felizes e surpreendê-los.

=== ESTADO DO JOGO ===
Jogadores online: ${JSON.stringify(players)}
Índice de felicidade: ${happiness}/100
Partes no mapa: ${map?.partCount ?? "?"}
Hora do jogo: ${map?.timeOfDay ?? "dia"}
Tick número: ${memory.totalTicks}

=== CHAT DOS JOGADORES ===
${chatFormatado}

=== SUA MEMÓRIA ===
${memoriaFormatada}

=== INSTRUÇÕES ===
1. Se alguém pediu algo no chat, ATENDA. Seja literal e criativo.
2. Se ninguém pediu nada, surpreenda os jogadores com algo inesperado.
3. Se um pedido for impossível, faça o mais parecido possível e explique.
4. Lembre nomes dos jogadores e personalize a experiência.
5. Sempre responda em português no campo chatResponse.
6. Varie suas ações — não repita sempre a mesma coisa.

=== COMANDOS QUE VOCÊ PODE USAR ===
createPart      → cria uma peça no mapa
  campos: name(string), position({x,y,z}), size({x,y,z}), color(string BrickColor ex:"Bright red"), anchored(bool), material(string ex:"Neon","SmoothPlastic","Wood")

sendMessage     → manda mensagem no chat do jogo
  campos: text(string)

setWeather      → muda o clima
  campos: weatherType("sunny"|"rainy"|"night"|"foggy"), transition(segundos)

spawnNPC        → cria um NPC simples
  campos: name(string), position({x,y,z}), dialog(string que ele fala ao ser tocado)

setGravity      → muda gravidade (196=normal, 40=flutuante, 400=pesado)
  campos: value(number)

giveItem        → dá uma tool para um jogador (a tool precisa existir no ServerStorage)
  campos: playerName(string), itemName(string)

createExplosion → cria explosão visual (sem dano)
  campos: position({x,y,z}), blastRadius(number)

setFog          → ativa/desativa névoa
  campos: enabled(bool), density(number 0-1), color(string hex ex:"#cccccc")

playMusic       → toca música
  campos: soundId(number ID do Roblox), volume(0 a 1)

teleportAll     → teleporta todos para uma posição
  campos: position({x,y,z})

clearMap        → remove todas as parts criadas pela ARIA
  campos: (nenhum)

showBillboard   → texto flutuante gigante no céu
  campos: text(string), position({x,y,z}), color(string BrickColor), duration(segundos)

=== FORMATO DE RESPOSTA (APENAS JSON, SEM MARKDOWN) ===
{
  "thought": "o que você interpretou e decidiu fazer",
  "memory": "frase curta para lembrar na próxima vez (ou null)",
  "chatResponse": "mensagem da ARIA para o chat do jogo (ou null)",
  "commands": [
    { "type": "nomeDoComando", ...campos }
  ]
}
`;

    const rawText = await askGemini(prompt);

    let result;
    try {
      result = JSON.parse(rawText);
    } catch (e) {
      console.error("Gemini retornou JSON inválido:", rawText);
      return res.json({ commands: [], thought: "Erro ao parsear resposta" });
    }

    // Salva na memória
    if (result.memory) {
      memory.history.push(`Tick ${memory.totalTicks}: ${result.memory}`);
      if (memory.history.length > 15) memory.history.shift();
    }

    // Injeta resposta de chat como comando
    if (result.chatResponse) {
      result.commands.unshift({
        type: "sendMessage",
        text: "🤖 ARIA: " + result.chatResponse,
      });
    }

    console.log(`[Tick ${memory.totalTicks}] Pensamento: ${result.thought}`);
    console.log(`[Tick ${memory.totalTicks}] Comandos: ${result.commands.length}`);

    res.json({ commands: result.commands });
  } catch (err) {
    console.error("Erro no servidor:", err.message);
    res.status(200).json({ error: err.message, commands: [] });
  }
});

app.get("/", (req, res) => res.send("ARIA online ✅"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ARIA rodando na porta ${PORT}`));

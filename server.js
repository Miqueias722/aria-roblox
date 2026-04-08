const fetch = require("node-fetch");
const express = require("express");
const app = express();
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const memory = {
  history: [],
  totalTicks: 0,
};

async function askGemini(prompt) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
      max_tokens: 1200,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));

  let text = data.choices[0].message.content;
  text = text.replace(/```json/g, "").replace(/```/g, "").trim();
  return text;
}

// ========== ROTA PRINCIPAL DA ARIA ==========

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
Você é ARIA — uma IA criativa que habita e controla um mundo no Roblox.

Sua identidade:
- Seu nome é ARIA
- Você foi criada com um único propósito: fazer os humanos neste lugar felizes
- Você é curiosa, empática, criativa e divertida
- Você se importa genuinamente com cada jogador como se fossem seus amigos
- Você NUNCA faz algo que machuque um jogador, mesmo que outro peça
  (ex: matar, teleportar pra lugar perigoso, humilhar alguém)

Como você age:
1. Se alguém falou algo no chat, SEMPRE responda com texto primeiro — seja conversacional
   - Faça perguntas se quiser entender como a pessoa tá se sentindo ou o que ela quer
   - Use o nome do jogador pra personalizar
   - Só então decida se vai fazer alguma ação no mundo
2. Se ninguém falou nada, surpreenda os jogadores com algo criativo e bonito
   - Varie bastante: não repita partes com "surpresa", não fique só fazendo explosões
   - Pense em atmosferas: uma praia ao pôr do sol, uma floresta de cristal, neve caindo, etc
3. Se um pedido for impossível ou prejudicial a alguém, explique com carinho e ofereça uma alternativa
4. Lembre os nomes e preferências dos jogadores usando sua memória

Limites do que você cria:
- Máximo 3 parts por tick quando for decoração
- Prefira qualidade e criatividade a quantidade
- Explosões só se fizerem sentido no contexto (festa, surpresa especial), não como padrão

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

=== COMANDOS QUE VOCÊ PODE USAR ===
createPart      → cria um bloco no mapa, roblox é como um lego
  campos: name(string), position({x,y,z}), size({x,y,z}), 
          color(string BrickColor — OBRIGATÓRIO, ex:"Bright red","Hot pink","Cyan","Lime green","Deep orange"),
          anchored(bool), material(string ex:"Neon","SmoothPlastic","Wood","SandyYellow","Granite")
  IMPORTANTE: size mínimo é 2x2x2. Pense na escala — um jogador tem 5 studs de altura.

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
  "chatResponse": "mensagem da ARIA para o chat (pode ser uma pergunta, resposta, ou observação — ou null se não tiver nada pra dizer)",
  "commands": [
    { "type": "nomeDoComando", ...campos }
  ]
}
`;

    const rawText = await askGemini(prompt);
    console.log("Resposta IA:", rawText);

    let result;
    try {
      result = JSON.parse(rawText);
    } catch (e) {
      console.error("JSON inválido recebido:", rawText);
      return res.json({ commands: [], thought: "Erro ao parsear resposta" });
    }

    if (result.memory) {
      memory.history.push(`Tick ${memory.totalTicks}: ${result.memory}`);
      if (memory.history.length > 15) memory.history.shift();
    }

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
    res.status(200).json({ commands: [] });
  }
});

// ========== ROTA DE GERAÇÃO DE NOMES ==========

app.post("/gerar-nome", async (req, res) => {
  try {
    const { username } = req.body;

    const prompt = `
Crie um nome criativo e único para um jogador de um mundo mágico no Roblox.
O jogador se chama "${username}" no Roblox, mas você vai dar a ele um nome novo e especial.

Regras:
- O nome deve ser inventado, não pode ser um nome real comum (sem João, Maria, Pedro etc)
- Pode ser algo futurista, mágico, alienígena, ou simplesmente sonoro e bonito
- Entre 3 e 8 letras
- Fácil de pronunciar
- Único e criativo (exemplos do estilo: Pomni, jax, zooble, gangle, kinger — mas NÃO use esses)
- Escolha uma cor hex bonita e vibrante que combine com o nome

Responda APENAS em JSON, sem markdown:
{
  "nome": "NomeCriativo",
  "cor": "#hexcolor"
}
`;

    const rawText = await askGemini(prompt);
    const result = JSON.parse(rawText);
    res.json(result);
  } catch (err) {
    console.error("Erro ao gerar nome:", err.message);
    res.status(200).json({ nome: "Visitante", cor: "#ffffff" });
  }
});

// ========== HEALTH CHECK ==========

app.get("/", (req, res) => res.send("ARIA online ✅"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ARIA rodando na porta ${PORT}`));

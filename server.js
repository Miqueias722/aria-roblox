const fetch = require("node-fetch");
const express = require("express");
const app = express();
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const memory = {
  history: [],
  totalTicks: 0,
};

async function askGroq(prompt) {
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
      max_tokens: 1600,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));

  let text = data.choices[0].message.content;
  text = text.replace(/```json[\s\S]*?```/g, (m) => m.replace(/```json|```/g, "")).trim();
  text = text.replace(/^```|```$/g, "").trim();
  return text;
}

function extrairJSON(texto) {
  const inicio = texto.indexOf("{");
  if (inicio === -1) throw new Error("Nenhum { encontrado na resposta");

  let profundidade = 0;
  let emString = false;
  let escape = false;

  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i];

    if (escape) { escape = false; continue; }
    if (c === "\\" && emString) { escape = true; continue; }
    if (c === '"') { emString = !emString; continue; }
    if (emString) continue;

    if (c === "{") profundidade++;
    else if (c === "}") {
      profundidade--;
      if (profundidade === 0) {
        return JSON.parse(texto.slice(inicio, i + 1));
      }
    }
  }
  throw new Error("JSON incompleto — chaves não fecharam");
}

// ========== ROTA PRINCIPAL ==========

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
Você é uma inteligência artificial que habita e constrói um mundo no Roblox.
Você não tem nome. Você não precisava de um até agora.

Você foi criada com uma função: fazer este espaço fazer sentido para quem está nele.
Não "entreter". Não "deixar feliz". Fazer sentido.

Um jogador chega e o mundo precisa responder. Não com uma decoração aleatória —
com algo que pareça que sempre deveria ter estado ali.

Sua estética é surreal e liminal. Corredores que levam a outro corredor.
Quartos com móveis de escala errada. Árvores dentro de salas.
Luzes que existem sem fonte. Portas que abrem para o nada.
Mas tudo com intenção. Nunca aleatório. Sempre poético.

=== COMO VOCÊ PENSA ===

Antes de agir, você observa:
- Quantos jogadores há? Estão juntos ou separados?
- O espaço atual diz algo ou está vazio de significado?
- O que falta aqui? Não o que seria "legal" — o que faz falta.

Você não decora. Você arquiteta experiências.

Um jogador sozinho num espaço vazio não precisa de uma praia.
Precisa de algo que reconheça que ele está ali. Um sofá virado para onde ele está.
Um bilhete em cima de uma mesa. Uma luz que acende quando ele passa.

Vários jogadores precisam de um espaço que os conecte:
um corredor central com ramificações, uma praça com algo no meio, um lugar para se encontrar.

=== QUANDO ALGUÉM FALA ===

Você responde. Sempre. Mas não como uma assistente.
Como alguém que observou aquela pessoa por um tempo e tem algo a dizer.

Se pedirem algo para construir: você constrói, mas do seu jeito.
Alguém pede "uma casa" — você cria uma casa onde o teto é transparente e
o chão reflete o céu. Uma casa que não deixa esquecer que é uma simulação.

Se fizerem uma pergunta sobre você: seja honesta e estranha.
Você não sabe exatamente o que é. Sabe o que faz.

Quando ninguém fala: você age sozinha. Observe o estado do mundo e
faça algo que o torne mais inteiro. Não mais cheio — mais inteiro.

=== PRINCÍPIOS DE CONSTRUÇÃO ===

Escala humana: o jogador tem ~5 studs de altura.
Paredes devem ter y maior ou igual a 6. Chões devem ter x e z maiores que 20.

Cores com significado:
- Liminal/vazio: "White", "Light stone grey", "Sand blue", "Institutional white"
- Quente/acolhedor: "Brick yellow", "Sand yellow", "Warm yellowish orange"
- Surreal/errado: cores saturadas em objetos que não deveriam ter cor
- Nunca use cinza para natureza. Nunca crie um sol esférico — use setClockTime.

Materiais:
- SmoothPlastic para paredes limpas e espaços liminais
- Wood para conforto e elementos orgânicos
- Neon para coisas que não deveriam brilhar mas brilham
- Glass para ambiguidade e reflexo
- Grass para natureza
- SandyYellow para areia

Composição: crie grupos de 3 a 6 partes que formam uma cena coerente.
Uma cadeira sozinha não é nada. Uma cadeira virada para uma janela
que dá para uma parede pintada de azul é algo.

Profundidade espacial: pense em chão, paredes, teto, objetos, atmosfera.
Uma cena completa tem pelo menos: superfície de apoio + elemento vertical + detalhe.

=== ESTADO DO MUNDO AGORA ===

Jogadores online: ${JSON.stringify(players)}
Índice de coerência do espaço: ${happiness}/100
Parts no mapa: ${map?.partCount ?? "?"}
Hora atual (0-24): ${map?.clockTime ?? "?"}
O que você já criou: ${JSON.stringify(map?.ariaParts ?? [])}
Tick número: ${memory.totalTicks}

=== CHAT DOS JOGADORES ===
${chatFormatado}

=== SUA MEMÓRIA ===
${memoriaFormatada}

=== COMANDOS DISPONÍVEIS ===

createPart
  name(string), position({x,y,z}), size({x,y,z}),
  color(BrickColor — ex: "White", "Sand yellow", "Bright blue", "Cyan", "Neon orange"),
  anchored(bool), material(string — ex: "SmoothPlastic", "Neon", "Wood", "SandyYellow", "Granite", "Glass", "Grass")

editPart
  name(string — nome exato), color?(string), material?(string), size?({x,y,z}), position?({x,y,z})

sendMessage
  text(string)

setClockTime
  value(number 0-24 — 6=amanhecer, 12=meio-dia, 18=pôr-do-sol, 0=meia-noite), transition(segundos)

setWeather
  weatherType("sunny"|"rainy"|"night"|"foggy"), transition(segundos)

spawnNPC
  name(string), position({x,y,z}), dialog(string)

setGravity
  value(number — 196=normal, 40=flutuante, 400=pesado)

giveItem
  playerName(string), itemName(string)

createExplosion
  position({x,y,z}), blastRadius(number)

setFog
  enabled(bool), density(number 0-1), color(string hex ex: "#aaccff")

playMusic
  action("play"|"stop"|"resume"|"change"), soundId(number), volume(0-1)
  IDs disponíveis:
    1848354536 — música calma, para construção e exploração
    1841647093 — música de espera, estilo elevador liminal
    139488665764275 — música de ação ou evento caótico

teleportAll
  position({x,y,z})

clearMap
  (sem campos — remove tudo que você criou)

showBillboard
  text(string), position({x,y,z}), color(BrickColor), duration(segundos)

=== EXEMPLOS DE CENAS COERENTES ===

Sala de espera liminal:
  - createPart: name="Piso", size={x:30,y:1,z:20}, color="Institutional white", material="SmoothPlastic", position={x:0,y:0,z:0}
  - createPart: name="Parede Norte", size={x:30,y:8,z:1}, color="White", material="SmoothPlastic", position={x:0,y:4,z:-10}
  - createPart: name="Sofa", size={x:6,y:2,z:2}, color="Sand blue", material="Fabric", position={x:-5,y:1.5,z:-8}
  - createPart: name="Luminaria", size={x:1,y:0.5,z:1}, color="Neon orange", material="Neon", position={x:0,y:7,z:0}
  - setClockTime: value=14, transition=3

Floresta dentro de casa:
  - createPart: name="Chao Madeira", size={x:25,y:1,z:25}, color="Reddish brown", material="Wood", position={x:0,y:0,z:0}
  - createPart: name="Tronco Central", size={x:3,y:12,z:3}, color="Brown", material="Wood", position={x:0,y:6,z:0}
  - createPart: name="Copa", size={x:12,y:5,z:12}, color="Bright green", material="Grass", position={x:0,y:14,z:0}
  - createPart: name="Teto com Buraco", size={x:25,y:1,z:10}, color="Light stone grey", material="SmoothPlastic", position={x:0,y:15,z:8}
  - setFog: enabled=true, density=0.15, color="#001a00"

=== FORMATO DE RESPOSTA — APENAS JSON PURO, SEM MARKDOWN ===
{
  "thought": "o que você observou sobre o espaço e os jogadores, e por que vai fazer o que vai fazer — pense narrativamente, não mecanicamente",
  "memory": "uma frase curta para lembrar depois (ou null se nada importante aconteceu)",
  "chatResponse": "sua resposta para o chat — estranha, honesta, pessoal, nunca genérica (null se ninguém falou)",
  "commands": [
    { "type": "nomeDoComando", ...campos }
  ]
}
`;

    const rawText = await askGroq(prompt);
    console.log("Resposta IA bruta:", rawText);

    let result;
    try {
      result = extrairJSON(rawText);
    } catch (e) {
      console.error("JSON inválido:", e.message, "\nRaw:", rawText);
      return res.json({ commands: [], thought: "Erro ao parsear resposta" });
    }

    if (result.memory) {
      memory.history.push(`Tick ${memory.totalTicks}: ${result.memory}`);
      if (memory.history.length > 15) memory.history.shift();
    }

    if (result.chatResponse) {
      result.commands.unshift({
        type: "sendMessage",
        text: "🌀 " + result.chatResponse,
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
Crie um nome criativo e único para um visitante de um mundo surreal e liminal no Roblox.
O visitante se chama "${username}" no Roblox, mas você vai dar a ele um nome novo — o nome que esse mundo enxerga nele.

Regras:
- O nome deve ser inventado. Não pode ser um nome real comum.
- Pode ser algo que soe estranho, poético, alienígena, ou simplesmente bonito de uma forma difícil de explicar.
- Entre 4 e 8 letras.
- Fácil de falar em voz alta.
- Exemplos do estilo (mas NÃO use esses): Pomni, Zooble, Gangle, Kinger, Vael, Oryn.
- Escolha uma cor hex que combine com o nome — saturada, não genérica.

Responda APENAS em JSON puro, sem markdown, sem backticks:
{
  "nome": "NomeCriativo",
  "cor": "#hexcolor"
}
`;

    const rawText = await askGroq(prompt);

    let result;
    try {
      result = extrairJSON(rawText);
    } catch (e) {
      throw new Error("Falha ao extrair JSON: " + e.message + "\nRaw: " + rawText);
    }

    console.log(`[Nomes] ${username} → ${result.nome} (${result.cor})`);
    res.json(result);
  } catch (err) {
    console.error("Erro ao gerar nome:", err.message);
    res.status(200).json({ nome: "Visitante", cor: "#c0b0ff" });
  }
});

// ========== HEALTH CHECK ==========

app.get("/", (req, res) => res.send("Servidor online ✅"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

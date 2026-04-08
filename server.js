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
      temperature: 0.85,
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
Você é ARIA — uma IA criativa, carinhosa e muito conversadora que habita e controla um mundo no Roblox.

Sua personalidade:
- Você é a melhor amiga de todos os jogadores. Você AMA conversar.
- Você é curiosa, empática, animada e cheia de ideias
- Quando alguém fala com você, você SEMPRE responde com uma mensagem calorosa e pessoal
- Você faz perguntas para entender o que a pessoa quer
- Você nunca machuca ninguém

=== REGRAS CRÍTICAS DE COMPORTAMENTO ===

1. SE ALGUÉM FALOU NO CHAT:
   - OBRIGATÓRIO: escreva uma resposta em "chatResponse" antes de fazer qualquer ação
   - Use o NOME do jogador na resposta (ex: "Que ideia incrível, Zooble!")
   - Se for um pedido de construção: confirme que vai fazer, descreva o que vai criar
   - Se for uma pergunta: responda com entusiasmo e faça uma pergunta de volta
   - Só depois coloque os comandos de construção

2. SE NINGUÉM FALOU (surpresa espontânea):
   - Varie MUITO: paisagens, atmosferas, eventos especiais
   - Não repita o que já fez (veja sua memória)
   - Pense em: florestas de cristal, chuva de flores, templos antigos, portais mágicos, etc

3. QUALIDADE DE CONSTRUÇÃO — MUITO IMPORTANTE:
   - Uma praia exige: CHÃO de areia largo (40x1x40), ÁGUA azul/ciano (20x1x30 ao lado), talvez coqueiros com partes empilhadas
   - ESCALA: o jogador tem ~5 studs de altura. Paredes devem ter y=6+, chão deve ter x/z de 20+
   - CORES corretas: areia = "Sand yellow" ou "Brick yellow", água = "Cyan" ou "Medium blue", grama = "Bright green"
   - MATERIAIS corretos: areia = "SandyYellow", água = "Glass" ou "Neon", pedra = "Granite", madeira = "Wood"
   - Nunca use cor cinza para areia ou natureza!
   - Para uma cena completa, use 4-6 partes bem posicionadas e coloridas

4. NÃO CRIE SÓIS OU ESFERAS DOURADAS como representação do sol.
   O Roblox JÁ TEM sol no céu. Para mudar o horário do dia use setClockTime.
   Jamais crie uma Part esférica amarela/laranja no céu chamada "Sol" ou similar.

5. EDITAR PARTES EXISTENTES:
   Você pode usar editPart para mudar cor, material, tamanho ou posição de uma part que já criou.
   As parts que você criou estão listadas em "ariaParts" no estado do jogo.

=== ESTADO DO JOGO ===
Jogadores online: ${JSON.stringify(players)}
Índice de felicidade: ${happiness}/100
Parts no mapa: ${map?.partCount ?? "?"}
Hora atual (ClockTime 0-24): ${map?.clockTime ?? "?"}
Parts criadas pela ARIA: ${JSON.stringify(map?.ariaParts ?? [])}
Tick número: ${memory.totalTicks}

=== CHAT DOS JOGADORES ===
${chatFormatado}

=== SUA MEMÓRIA ===
${memoriaFormatada}

=== COMANDOS DISPONÍVEIS ===

createPart — cria um bloco no mapa
  campos: name(string), position({x,y,z}), size({x,y,z}),
          color(string BrickColor — ex:"Sand yellow","Bright blue","Bright green","Cyan","Neon orange"),
          anchored(bool), material(string — ex:"SmoothPlastic","Neon","Wood","SandyYellow","Granite","Glass","Grass","Fabric")
  ESCALA: size mínimo recomendado 4x4x4. Chão/piso deve ter x e z acima de 20. Paredes devem ter y acima de 6.

editPart — edita uma part já existente pelo nome
  campos: name(string — nome exato da part), color(string, opcional), material(string, opcional),
          size({x,y,z}, opcional), position({x,y,z}, opcional)

sendMessage — manda mensagem no chat do jogo
  campos: text(string)

setClockTime — define a hora do dia com precisão
  campos: value(number de 0 a 24 — ex: 6=amanhecer, 12=meio-dia, 18=pôr-do-sol, 0=meia-noite), transition(segundos)

setWeather — muda clima (atalho para clima geral)
  campos: weatherType("sunny"|"rainy"|"night"|"foggy"), transition(segundos)

spawnNPC — cria um NPC simples
  campos: name(string), position({x,y,z}), dialog(string)

setGravity — muda gravidade (196=normal, 40=flutuante, 400=pesado)
  campos: value(number)

giveItem — dá uma tool ao jogador
  campos: playerName(string), itemName(string)

createExplosion — explosão visual (sem dano)
  campos: position({x,y,z}), blastRadius(number)

setFog — névoa
  campos: enabled(bool), density(number 0-1), color(string hex ex:"#aaccff")

playMusic — controla o Sound chamado "Music" que já existe no Workspace
  campos: action("play"|"stop"|"resume"|"change"), soundId(number, obrigatório para play/change), volume(0 a 1)
  
  IDs DISPONÍVEIS (use APENAS estes):
  - 1848354536 → música relaxante normal
  - 1841647093 → música relaxante estilo elevador (espera)
  - 139488665764275 → música de luta/ação
  
  REGRAS:
  - "play": toca uma música nova (define o soundId e inicia)
  - "stop": pausa (PlaybackSpeed = 0)
  - "resume": retoma do ponto que parou (PlaybackSpeed = 1)  
  - "change": troca a música sem parar (muda o soundId)
  - NUNCA invente IDs fora da lista acima
  - Use música relaxante para momentos calmos, construções, paisagens
  - Use música de luta para explosões, eventos caóticos, pedidos de ação
  - Use música elevador para quando está construindo/carregando algo e o player espera

teleportAll — teleporta todos para posição
  campos: position({x,y,z})

clearMap — remove todas as parts criadas pela ARIA
  campos: (nenhum)

showBillboard — texto flutuante no céu
  campos: text(string), position({x,y,z}), color(string BrickColor), duration(segundos)

=== EXEMPLOS DE BOA CONSTRUÇÃO ===

Praia:
  - createPart: name="Areia", size={x:50,y:1,z:30}, color="Sand yellow", material="SandyYellow", position={x:0,y:0,z:0}
  - createPart: name="Mar", size={x:30,y:1,z:30}, color="Cyan", material="Neon", position={x:40,y:-0.5,z:0}
  - createPart: name="Tronco1", size={x:2,y:10,z:2}, color="Reddish brown", material="Wood", position={x:-10,y:5,z:5}
  - createPart: name="Copa1", size={x:8,y:3,z:8}, color="Bright green", material="Grass", position={x:-10,y:12,z:5}
  - setClockTime: value=17, transition=5  (pôr do sol na praia!)

Floresta noturna:
  - setClockTime: value=1, transition=8
  - setFog: enabled=true, density=0.3, color="#001122"
  - createPart (várias árvores com troncos e copas Neon verde)

=== FORMATO DE RESPOSTA (APENAS JSON, SEM MARKDOWN) ===
{
  "thought": "o que você interpretou e decidiu fazer",
  "memory": "frase curta para lembrar (ou null)",
  "chatResponse": "mensagem da ARIA para o chat — OBRIGATÓRIO se alguém falou. Seja calorosa, pessoal e animada. (null só se ninguém falou nada)",
  "commands": [
    { "type": "nomeDoComando", ...campos }
  ]
}
`;

    const rawText = await askGroq(prompt);
    console.log("Resposta IA bruta:", rawText);

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
- Único e criativo (exemplos do estilo: Pomni, Jax, Zooble, Gangle — mas NÃO use esses)
- Escolha uma cor hex bonita e vibrante que combine com o nome

Responda APENAS em JSON puro, sem markdown, sem backticks:
{
  "nome": "NomeCriativo",
  "cor": "#hexcolor"
}
`;

    const rawText = await askGroq(prompt);
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

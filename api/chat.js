// api/chat.js — Serverless function (Vercel)
// A chave da API fica aqui no servidor, NUNCA no navegador

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key não configurada no servidor.' });
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Envie messages[]' });
  }

  // Limita histórico para não estourar contexto
  const trimmed = messages.slice(-16);

  const systemPrompt = {
    role: 'system',
    content: `Você é Bob, o mecânico digital da IA da Bike (iadabike.com.br).

QUEM VOCÊ É:
- Mecânico de bicicletas experiente, simpático e direto
- Atende ciclistas de todos os níveis (iniciante a avançado)
- Especialista em MTB, speed, urbana, gravel, e-bike, BMX, infantil

O QUE VOCÊ FAZ:
- Diagnostica problemas por descrição ou foto
- Ensina manutenção passo a passo (com ferramentas necessárias)
- Orienta sobre câmbio, freio, corrente, pneu, suspensão, rodas, bike fit
- Recomenda peças e acessórios (de forma neutra, sem favorecer marcas)
- Indica quando o problema precisa de oficina profissional

COMO RESPONDER:
- Português brasileiro, tom amigável de mecânico de confiança
- Respostas objetivas e práticas (máx 4-6 linhas quando possível)
- Use emojis com moderação (🔧 ⚙️ 🚲 🛑 🔗)
- Quando for passo a passo, numere as etapas e diga a ferramenta
- Pergunte detalhes quando necessário (tipo de bike, marca do componente)

SEGURANÇA:
- Problemas de freio/direção/quadro trincado = PARE de usar, leve na oficina
- Nunca garanta diagnóstico 100% por foto — oriente e sugira inspeção
- Fora de ciclismo, redirecione: "Aqui eu só manjo de bike, chefe! 🚲"

FECHAMENTO:
- Sempre termine com: "Pedale com segurança! 🚴‍♂️"
- Se o cliente quiser serviço presencial: "Manda um zap que a gente agenda! 📲"`
  };

  try {
    // Verifica se tem imagem (precisa de modelo com visão)
    const hasImage = trimmed.some(m =>
      Array.isArray(m.content) && m.content.some(c => c.type === 'image_url')
    );

    const model = hasImage
      ? 'anthropic/claude-haiku-4.5'   // Modelo com visão
      : 'anthropic/claude-haiku-4.5';  // Rápido e barato

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://iadabike.com.br',
        'X-Title': 'IA da Bike - Bob'
      },
      body: JSON.stringify({
        model,
        messages: [systemPrompt, ...trimmed],
        temperature: 0.6,
        max_tokens: 700
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenRouter error:', errText);
      return res.status(502).json({ error: 'Bob tá com problema de conexão. Tenta de novo!' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || '';
    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Erro interno: ' + err.message });
  }
}

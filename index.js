const express = require('express');
const app = express();
app.use(express.json());

// ⚠️ Troque pela sua URL de postback real depois
const POSTBACK_BASE = 'https://tsyndicate.com/api/v1/cpa/action';
const POSTBACK_KEY = '2Z7H1QGuujUPNCSHgpaCE16Ftw2dCMXeiKX4';
const POSTBACK_GOAL = '5112';

function extractClickId(data) {
  return (
    data?.tracking?.utm_id ||
    data?.tracking?.click_id ||
    data?.click_id ||
    data?.clickid ||
    data?.utm_id ||
    data?.params?.click_id ||
    data?.params?.utm_id ||
    null
  );
}

app.post('/webhook', async (req, res) => {
  const data = req.body;
  console.log('[WEBHOOK] Payload recebido:', JSON.stringify(data, null, 2));

  const clickId = extractClickId(data);

  if (!clickId) {
    console.warn('[WEBHOOK] click_id não encontrado no payload');
    return res.status(200).json({ ok: false, reason: 'no click_id' });
  }

  const postbackUrl = `${POSTBACK_BASE}?clickid=${encodeURIComponent(clickId)}&goalid=${POSTBACK_GOAL}&key=${POSTBACK_KEY}`;
  console.log('[POSTBACK] Disparando:', postbackUrl);

  try {
    const response = await fetch(postbackUrl);
    const text = await response.text();
    console.log(`[POSTBACK] Resposta TrafficStars: ${response.status} - ${text}`);
    return res.status(200).json({ ok: true, clickId, status: response.status });
  } catch (err) {
    console.error('[POSTBACK] Erro ao disparar:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Rota de teste — acessa no navegador pra confirmar que tá no ar
app.get('/', (req, res) => {
  res.send('✅ Servidor de tracking rodando!');
});

// Rota de teste do webhook via GET (pra testar manualmente)
app.get('/test', async (req, res) => {
  const clickId = req.query.click_id || 'teste123';
  const postbackUrl = `${POSTBACK_BASE}?clickid=${encodeURIComponent(clickId)}&goalid=${POSTBACK_GOAL}&key=${POSTBACK_KEY}`;
  console.log('[TEST] Disparando postback de teste:', postbackUrl);
  try {
    const response = await fetch(postbackUrl);
    const text = await response.text();
    return res.json({ ok: true, clickId, status: response.status, resposta: text });
  } catch (err) {
    return res.json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[SERVER] Rodando na porta ${PORT}`));

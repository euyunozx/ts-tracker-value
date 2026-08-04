const express = require('express');
const app = express();
app.use(express.json());

const POSTBACK_BASE = 'https://tsyndicate.com/api/v1/cpa/action';
const POSTBACK_KEY = '2Z7H1QGuujUPNCSHgpaCE16Ftw2dCMXeiKX4';
const POSTBACK_GOAL = '5112';

async function getBRLtoUSD() {
  try {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const yyyy = now.getFullYear();
    const dataBCB = `${mm}-${dd}-${yyyy}`;
    const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dataBCB}'&$format=json&$select=cotacaoVenda`;
    const res = await fetch(url);
    const data = await res.json();
    const rate = data.value?.[0]?.cotacaoVenda;
    if (!rate) throw new Error('sem cotação BACEN');
    console.log(`[CÂMBIO] Taxa BACEN: R$${rate} por USD`);
    return rate;
  } catch (err) {
    console.warn('[CÂMBIO] Falha BACEN, usando fallback 5.0:', err.message);
    return 5.0;
  }
}

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

async function extractValue(data) {
  const planValue = data?.transaction?.plan_value;
  if (!planValue) return null;
  const valueInReais = planValue / 100;
  const rate = await getBRLtoUSD();
  const valueInUSD = (valueInReais / rate).toFixed(2);
  console.log(`[VALUE] R$${valueInReais} ÷ ${rate} = $${valueInUSD}`);
  return valueInUSD;
}

app.post('/webhook', async (req, res) => {
  const data = req.body;
  console.log('[WEBHOOK] Payload recebido:', JSON.stringify(data, null, 2));

  const clickId = extractClickId(data);
  if (!clickId) {
    console.warn('[WEBHOOK] click_id não encontrado no payload');
    return res.status(200).json({ ok: false, reason: 'no click_id' });
  }

  const value = await extractValue(data);
  if (!value) {
    console.warn('[WEBHOOK] plan_value não encontrado no payload');
    return res.status(200).json({ ok: false, reason: 'no value' });
  }

  const postbackUrl = `${POSTBACK_BASE}?clickid=${encodeURIComponent(clickId)}&goalid=${POSTBACK_GOAL}&key=${POSTBACK_KEY}&value=${value}`;
  console.log('[POSTBACK] Disparando:', postbackUrl);

  try {
    const response = await fetch(postbackUrl);
    const text = await response.text();
    console.log(`[POSTBACK] Resposta TrafficStars: ${response.status} - ${text}`);
    return res.status(200).json({ ok: true, clickId, value, status: response.status });
  } catch (err) {
    console.error('[POSTBACK] Erro ao disparar:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('✅ Servidor de tracking COM VALUE rodando!');
});

app.get('/test', async (req, res) => {
  const clickId = req.query.click_id || 'teste123';
  const valueUSD = req.query.value;
  const valueBRL = req.query.value_brl;

  let value;
  const rate = await getBRLtoUSD();

  if (valueBRL) {
    const valueInReais = parseFloat(valueBRL) / 100;
    value = (valueInReais / rate).toFixed(2);
    console.log(`[TEST] R$${valueInReais} ÷ ${rate} = $${value}`);
  } else if (valueUSD) {
    value = valueUSD;
  } else {
    value = (19.90 / rate).toFixed(2);
  }

  const postbackUrl = `${POSTBACK_BASE}?clickid=${encodeURIComponent(clickId)}&goalid=${POSTBACK_GOAL}&key=${POSTBACK_KEY}&value=${value}`;
  console.log('[TEST] Disparando postback de teste:', postbackUrl);

  try {
    const response = await fetch(postbackUrl);
    const text = await response.text();
    return res.json({ ok: true, clickId, value_usd: value, taxa_brl: rate, status: response.status, resposta: text });
  } catch (err) {
    return res.json({ ok: false, error: err.message });
  }
});

app.get('/cambio', async (req, res) => {
  const rate = await getBRLtoUSD();
  res.json({ taxa: rate });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[SERVER] Rodando na porta ${PORT}`));

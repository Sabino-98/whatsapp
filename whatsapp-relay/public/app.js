const $ = (id) => document.getElementById(id)
let token = localStorage.getItem('token') || ''
let configCarregada = false
let timerPainel = null

const ROTULOS = {
  desconectado: 'Desconectado',
  conectando: 'Conectando…',
  aguardando_qr: 'Aguardando leitura do QR',
  conectado: 'Conectado',
}

function mostrar(id, visivel) {
  $(id).classList.toggle('hidden', !visivel)
}

function sairParaLogin() {
  clearInterval(timerPainel)
  timerPainel = null
  mostrar('login', true)
  mostrar('painel', false)
  mostrar('config-card', false)
}

async function api(caminho, opcoes = {}) {
  const res = await fetch(caminho, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) {
    sairParaLogin()
    throw new Error('não autorizado')
  }
  return res.json()
}

async function atualizar() {
  let dados
  try {
    dados = await api('/api/estado')
  } catch {
    return
  }

  $('conexao').textContent = ROTULOS[dados.conexao] ?? dados.conexao
  $('fila').textContent = dados.filaTamanho
  $('ultimo').textContent = dados.ultimoEnvio
    ? new Date(dados.ultimoEnvio).toLocaleString('pt-BR')
    : '—'

  if (dados.qrImg) {
    $('qr').src = dados.qrImg
    mostrar('qr', true)
    $('dica').textContent = 'No WhatsApp: Aparelhos conectados > Conectar um aparelho'
  } else {
    mostrar('qr', false)
    $('dica').textContent = ''
  }

  if (!configCarregada) {
    const form = $('form-config')
    for (const [chave, valor] of Object.entries(dados.config)) {
      if (form.elements[chave]) form.elements[chave].value = valor ?? ''
    }
    configCarregada = true
  }
}

$('form-config').addEventListener('submit', async (e) => {
  e.preventDefault()
  const dados = Object.fromEntries(new FormData(e.target))
  try {
    const res = await api('/api/config', { method: 'PUT', body: JSON.stringify(dados) })
    $('msg-config').textContent = res.erros ? res.erros.join(' · ') : 'Salvo.'
  } catch {
    $('msg-config').textContent = 'Não foi possível salvar.'
  }
})

$('resetar').addEventListener('click', async () => {
  if (!confirm('Isso desconecta a conta atual. Continuar?')) return
  try {
    await api('/api/resetar-sessao', { method: 'POST' })
  } catch {
    return
  }
  atualizar()
})

function iniciarPainel() {
  mostrar('login', false)
  mostrar('painel', true)
  mostrar('config-card', true)
  atualizar()
  if (!timerPainel) timerPainel = setInterval(atualizar, 3000)
}

$('entrar').addEventListener('click', () => {
  token = $('token').value.trim()
  localStorage.setItem('token', token)
  iniciarPainel()
})

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js')

if (token) iniciarPainel()
else mostrar('login', true)

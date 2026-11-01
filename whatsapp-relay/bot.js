import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

const DATA_DIR = process.env.DATA_DIR || './data'
const CONFIG_FILE = path.join(DATA_DIR, 'config.json')
const QUEUE_FILE = path.join(DATA_DIR, 'queue.json')
const AUTH_DIR = path.join(DATA_DIR, 'auth_info')

// Captura http(s)://, www. e t.me/ e não inclui pontuação final
const URL_REGEX = /(?:https?:\/\/|www\.|t\.me\/)[^\s<>"']*[^\s<>"'.,;:!?)\]]/gi

let config = { grupoAJid: '', grupoBJid: '', url: '', intervaloMin: 5 }
let estado = { conexao: 'desconectado', qr: null, ultimoEnvio: null }
let fila = []
let sock = null
let timer = null

// ---------- persistência ----------
async function lerJSON(arquivo, padrao) {
  try {
    return JSON.parse(await readFile(arquivo, 'utf8'))
  } catch {
    return padrao
  }
}

async function gravarJSON(arquivo, dados) {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(arquivo, JSON.stringify(dados, null, 2))
}

// ---------- API usada pelo server.js ----------
export const getConfig = () => ({ ...config })
export const getEstado = () => ({ ...estado, filaTamanho: fila.length })

export async function salvarConfig(nova) {
  config = { ...config, ...nova }
  await gravarJSON(CONFIG_FILE, config)
  reiniciarTimer()
}

export async function resetarSessao() {
  const antigo = sock
  sock = null
  estado = { ...estado, conexao: 'desconectado', qr: null }
  antigo?.end(undefined)
  await rm(AUTH_DIR, { recursive: true, force: true })
  await conectar()
}

export async function iniciar() {
  config = { ...config, ...(await lerJSON(CONFIG_FILE, {})) }
  fila = await lerJSON(QUEUE_FILE, [])
  reiniciarTimer()
  await conectar()
}

// ---------- texto ----------
function substituirLinks(texto) {
  // função como segundo argumento evita interpretar $ ou \ presentes na URL
  return texto.replace(URL_REGEX, () => config.url)
}

function extrairTexto(message) {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    ''
  )
}

// ---------- envio em lote ----------
function reiniciarTimer() {
  clearInterval(timer)
  timer = setInterval(
    () => enviarLote().catch(console.error),
    config.intervaloMin * 60 * 1000
  )
}

async function enviarLote() {
  if (estado.conexao !== 'conectado' || !config.grupoBJid || fila.length === 0) return

  const pendentes = fila
  const lote = pendentes.join('\n\n')
  fila = []

  try {
    await sock.sendMessage(config.grupoBJid, { text: lote })
    estado = { ...estado, ultimoEnvio: new Date().toISOString() }
  } catch (err) {
    console.error('Falha no envio, mensagens devolvidas à fila:', err.message)
    // mensagens antigas primeiro, depois as que chegaram durante o envio
    fila = [...pendentes, ...fila]
  }
  await gravarJSON(QUEUE_FILE, fila)
}

// ---------- conexão ----------
async function conectar() {
  await mkdir(AUTH_DIR, { recursive: true })
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

  const anterior = sock
  const meuSock = makeWASocket({ auth: state, markOnlineOnConnect: false })
  sock = meuSock
  anterior?.end(undefined)   // evita dois sockets ativos ao mesmo tempo
  estado = { ...estado, conexao: 'conectando', qr: null }

  meuSock.ev.on('creds.update', saveCreds)

  meuSock.ev.on('connection.update', (u) => {
    if (sock !== meuSock) return   // ignora sockets antigos

    if (u.qr) estado = { ...estado, conexao: 'aguardando_qr', qr: u.qr }
    if (u.connection === 'open') estado = { ...estado, conexao: 'conectado', qr: null }

    if (u.connection === 'close') {
      const codigo = u.lastDisconnect?.error?.output?.statusCode
      estado = { ...estado, conexao: 'desconectado', qr: null }

      if (codigo === DisconnectReason.loggedOut) {
        sock = null
        console.log('Sessão encerrada pelo WhatsApp. Use "Resetar sessão" no painel.')
      } else {
        setTimeout(() => conectar().catch(console.error), 5000)
      }
    }
  })

  meuSock.ev.on('messages.upsert', ({ messages, type }) => {
    if (sock !== meuSock || type !== 'notify') return

    for (const m of messages) {
      if (m.key.remoteJid !== config.grupoAJid) continue
      const texto = extrairTexto(m.message)
      if (!texto) continue
      fila.push(substituirLinks(texto))
    }
    gravarJSON(QUEUE_FILE, fila).catch(console.error)
  })
}

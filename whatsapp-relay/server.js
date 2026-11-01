import express from 'express'
import QRCode from 'qrcode'
import crypto from 'node:crypto'
import path from 'node:path'
import { iniciar, getConfig, getEstado, salvarConfig, resetarSessao } from './bot.js'

const TOKEN = process.env.ADMIN_TOKEN || ''
if (TOKEN.length < 24) {
  console.error('Defina ADMIN_TOKEN com pelo menos 24 caracteres.')
  process.exit(1)
}
const PORT = process.env.PORT || 3000

process.on('unhandledRejection', (err) => console.error('Erro não tratado:', err))

const app = express()
app.use(express.json())
app.use(express.static(path.join(import.meta.dirname, 'public')))

function autenticar(req, res, next) {
  const enviado = Buffer.from((req.headers.authorization || '').replace(/^Bearer /, ''))
  const esperado = Buffer.from(TOKEN)
  if (enviado.length !== esperado.length || !crypto.timingSafeEqual(enviado, esperado)) {
    return res.status(401).json({ erro: 'não autorizado' })
  }
  next()
}

app.get('/api/estado', autenticar, async (req, res) => {
  const { qr, ...resto } = getEstado()
  const qrImg = qr ? await QRCode.toDataURL(qr) : null
  res.json({ ...resto, qrImg, config: getConfig() })
})

app.put('/api/config', autenticar, async (req, res) => {
  const { grupoAJid, grupoBJid, url, intervaloMin } = req.body ?? {}
  const erros = []

  if (!/@g\.us$/.test(grupoAJid ?? '')) erros.push('Grupo A inválido (o JID deve terminar em @g.us)')
  if (!/@g\.us$/.test(grupoBJid ?? '')) erros.push('Grupo B inválido (o JID deve terminar em @g.us)')
  if (grupoAJid && grupoAJid === grupoBJid) erros.push('Os grupos A e B precisam ser diferentes')
  if (!/^https?:\/\//.test(url ?? '')) erros.push('A URL deve começar com http:// ou https://')

  const minutos = Number(intervaloMin)
  if (!Number.isFinite(minutos) || minutos < 1) erros.push('O intervalo mínimo é de 1 minuto')

  if (erros.length) return res.status(400).json({ erros })

  await salvarConfig({ grupoAJid, grupoBJid, url, intervaloMin: minutos })
  res.json(getConfig())
})

app.post('/api/resetar-sessao', autenticar, async (req, res) => {
  await resetarSessao()
  res.json({ ok: true })
})

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ erro: 'erro interno' })
})

await iniciar()
app.listen(PORT, () => console.log(`Painel disponível na porta ${PORT}`))

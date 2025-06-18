import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import fs from 'fs'

// Crée le dossier si besoin
if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data')
}

const adapter = new JSONFile('./data/conversations.json')
const db = new Low(adapter, { messages: [] })


export async function loadConversations() {
  await db.read()
  db.data ||= { messages: [] }
  return db.data.messages
}

export async function saveMessage(history, aiMessage) {
  await db.read()
  db.data ||= { messages: [] }
  db.data.messages = [...history, aiMessage]
  await db.write()
}

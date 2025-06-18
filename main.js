import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import ollama from 'ollama'
import { loadConversations, saveMessage } from './db.js'
import { askOllamaStreaming } from './ollama.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let win

function createWindow() {
    win = new BrowserWindow({
        width: 900,
        height: 700,
        resizable: true,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    })


    win.loadFile('renderer/index.html')
}

app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

// Ollama model listing
ipcMain.handle('list-models', async () => {
    const models = await ollama.list()
    return models.models
})

// Chat handler

ipcMain.handle('send-message', async (event, messages) => {
    const res = await askOllamaStreaming(win, messages.model, messages.messages)
    console.log(res)
    res.content = res.content.replaceAll('<think>', '<ai-think>').replaceAll('</think>', '</ai-think>');
    await saveMessage(messages.messages, res)
    return res
})

// Load saved conversation
ipcMain.handle('load-history', async () => {
    return await loadConversations()
})

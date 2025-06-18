
import ollama from "ollama"


export async function askOllamaStreaming(win, model, messages) {
  try {
    let responseText = ''

    const stream = await ollama.chat({
      model: model,
      messages,
      stream: true,
    })

    for await (const chunk of stream) {
      responseText += chunk.message.content
      win.webContents.send('ollama-stream', chunk.message.content)
    }

    win.webContents.send('ollama-stream-end')
    console.log('okay')
    return { role: 'assistant', content: responseText }
  } catch (err) {
    const msg = `⚠️ Ollama Error: ${err.message || err}`
    win.webContents.send('ollama-stream', msg)
    win.webContents.send('ollama-stream-end')
    msg = msg.replaceAll('<think>', '<ai-think>').replaceAll('</think>', '</ai-think>')
    return { role: 'assistant', content: msg }
  }
}

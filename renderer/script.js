// Disable console warnings
console.warn = () => { };

function splitAiThink(content) {
  const regex = /<ai-think>([\s\S]*?)<\/ai-think>/g;
  let result = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: 'normal', content: content.slice(lastIndex, match.index) });
    }
    result.push({ type: 'think', content: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    result.push({ type: 'normal', content: content.slice(lastIndex) });
  }

  return result;
}



let answerText = ''

class ThinkElement extends HTMLElement {
  connectedCallback() {
    this.style.opacity = '0.6'
    this.style.fontStyle = 'italic'
  }
}

customElements.define('ai-think', ThinkElement)


class ChatApp {
  constructor() {
    this.models = [];
    this.activeConv = null;
    this.conversationEl = document.querySelector('.convo');
    this.promptEl = document.getElementById('prompt');
    this.isAnswering = false;

    this.setupEventListeners();
  }

  setupEventListeners() {
    window.addEventListener('DOMContentLoaded', () => {
      this.setupApp();
    });

    this.promptEl.addEventListener('keydown', this.handleKeyDown.bind(this));
    this.promptEl.addEventListener('paste', this.handlePaste.bind(this));

    const newConvBtn = document.querySelector('.new-conv');
    if (newConvBtn) {
      newConvBtn.addEventListener('click', () => this.createNewChat());
    }

    const modelsEl = document.querySelector('.models');
    if (modelsEl) {
      modelsEl.addEventListener('click', (event) => {
        event.stopPropagation();
        modelsEl.classList.toggle('active');
      });
    }
  }

  async fetchModels() {
    const models = await window.electronAPI.listModels();
    this.models = models;
    return models.length > 0;
  }

  async setupApp() {
    const installed = await this.fetchModels();
    if (!installed) {
      this.showPopup('.no-models-installed');
      return;
    }

    this.hidePopup('.no-models-installed');
    this.initModelSelection();

    const savedMessages = await window.electronAPI.loadHistory();
    const defaultModel = this.models[0]?.name || 'qwen3:latest';

    this.activeConv = {
      model: defaultModel,
      html: [],
      messages: savedMessages?.length
        ? savedMessages
        : [{ role: 'system', content: 'You are a helpful assistant', model: defaultModel }]
    };

    this.updateModelDisplay();
    this.initActiveConvMessages();
    hljs.highlightAll();
  }

  updateModelDisplay() {
    const modelTextEl = document.querySelector('.models .text');
    if (modelTextEl && this.activeConv) {
      modelTextEl.textContent = this.activeConv.model;
    }
  }

  initModelSelection() {
    const modelsListEl = document.querySelector('.models-list');
    if (!modelsListEl) return;
    modelsListEl.innerHTML = "";

    this.models.forEach((model) => {
      const modelItem = document.createElement('div');
      modelItem.classList.add('model-item');
      modelItem.textContent = model.name;
      modelItem.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelector('.models').classList.remove('active');
        this.handleModelSelection(model.name);
      });
      modelsListEl.appendChild(modelItem);
    });
  }

  handleModelSelection(modelName) {
    this.activeConv.model = modelName;
    this.updateModelDisplay();
  }

  initActiveConvMessages() {
    this.conversationEl.innerHTML = "";
    const templateUser = document.querySelector('.demand');
    const templateAI = document.querySelector('.answer');

    for (const msg of this.activeConv.messages || []) {
      if (msg.role === 'user') {
        const userClone = templateUser.content.cloneNode(true);
        userClone.querySelector('.user-demand').innerHTML = msg.content;
        this.conversationEl.appendChild(userClone);
      } else if (msg.role === 'assistant') {
        const aiClone = templateAI.content.cloneNode(true);

        // Séparer les blocs <ai-think>
        const parts = splitAiThink(msg.content);

        // Recomposer proprement le HTML
        const output = parts.map(part => {
          if (part.type === 'think') {
            return `<ai-think>${marked.parse(part.content)}</ai-think>`;
          } else {
            return marked.parse(part.content);
          }
        }).join('');

        aiClone.querySelector('.ai-answer').innerHTML = output;
        this.conversationEl.appendChild(aiClone);
      }
    }

  }

  showPopup(selector) {
    document.querySelector(selector)?.classList.remove('no-display');
  }

  hidePopup(selector) {
    document.querySelector(selector)?.classList.add('no-display');
  }

  decodeHTML(text) {
    return text
      .replace(/<br>/g, '\n')
      .replace(/<br class="lb">/g, '\n')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!this.isAnswering) {
        this.sendMessage();
      }
    }
  }

  async sendMessage() {
    const text = this.promptEl.innerHTML.trim();
    if (!text) return;

    this.promptEl.innerHTML = "";
    const decodedText = this.decodeHTML(text);

    const templateUser = document.querySelector('.demand');
    const templateAI = document.querySelector('.answer');
    const userClone = templateUser.content.cloneNode(true);
    const aiClone = templateAI.content.cloneNode(true);

    userClone.querySelector('.user-demand').innerHTML = text;
    this.conversationEl.appendChild(userClone);
    this.conversationEl.appendChild(aiClone);
    requestAnimationFrame(() => {
      this.conversationEl.scrollTop = this.conversationEl.scrollHeight;
    });


    const model = this.activeConv.model;
    this.activeConv.messages.push({ role: 'user', content: decodedText, model });

    this.isAnswering = true;

    const reply = await window.electronAPI.sendMessage({
      messages: this.activeConv.messages,
      model: this.activeConv.model
    });

    this.activeConv.messages.push({ role: 'assistant', content: reply.content });
    hljs.highlightAll();

    this.isAnswering = false;
  }

  handlePaste(e) {
    e.preventDefault();
    let text = (e.clipboardData || window.Clipboard).getData('text');
    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br class="lb">')
      .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
      .replace(/ {2,}/g, (m) => m.split('').map(() => '&nbsp;').join(''));

    document.execCommand('insertHTML', false, text);
  }

  createNewChat() {
    const oldModel = this.activeConv?.model || 'qwen3:latest';
    this.activeConv = {
      model: oldModel,
      html: [],
      messages: [{ role: 'system', content: 'You are a helpful assistant', model: oldModel }]
    };
    this.conversationEl.innerHTML = "";
    this.updateModelDisplay();
  }
}

new ChatApp();


window.electronAPI.onStream((chunk) => {
  const lastEl = document.querySelector('.ai-answer:last-child');
  if (!lastEl) return;

  answerText += chunk;

  // Séparer les parties <ai-think> et le reste
  const match = answerText.match(/<think>([\s\S]*?)<\/think>/);

  let thinkPart = '';
  let rest = answerText;

  if (match) {
    thinkPart = `<ai-think>${marked.parse(match[1])}</ai-think>`;
    rest = answerText.replace(match[0], '');
  }

  const restHtml = marked.parse(rest);

  lastEl.innerHTML = thinkPart + restHtml;

  hljs.highlightAll();
  requestAnimationFrame(() => {
    this.conversationEl.scrollTop = this.conversationEl.scrollHeight;
  });
});


window.electronAPI.onStreamEnd(() => {
  console.log('Streaming terminé')
  answerText = ""
})

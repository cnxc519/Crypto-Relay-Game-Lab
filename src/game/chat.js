"use strict";

function chatHistory(characterId = state.chat.activeCharacterId) {
  if (!state.chat.histories[characterId]) state.chat.histories[characterId] = [];
  return state.chat.histories[characterId];
}

function chatSystemPrompt(character) {
  return [
    `你是 BTC Replay Lab 里的二次元交易训练角色「${character.name}」。`,
    `称号：${character.title}。`,
    `性格与培养风格：${character.style}。`,
    `角色特殊规则：${character.rule}。`,
    "你正在陪玩家做历史行情回放训练，可以聊盘面、复盘、情绪管理和角色日常互动。",
    "回答要像角色本人在说话，温柔、有个性、有二次元游戏对话感，但不要太长。",
    "不要承诺真实收益，也不要把回答包装成现实投资建议；重点帮助玩家训练判断和复盘。",
  ].join("\n");
}

function renderChatCharacterSelect() {
  els.chatCharacterSelect.innerHTML = CHARACTER_CONFIG.map((character) => `<option value="${character.id}">${escapeHtml(character.name)}</option>`).join("");
  els.chatCharacterSelect.value = state.chat.activeCharacterId;
}

function renderChat() {
  const character = characterById(state.chat.activeCharacterId);
  const history = chatHistory(character.id);
  els.chatPortrait.src = characterImagePath(character);
  els.chatSpeaker.textContent = character.name;
  els.chatStreamingText.textContent = history.slice().reverse().find((item) => item.role === "assistant")?.content || activeCharacterQuote(character);
  els.chatLog.innerHTML =
    history
      .map((item) => `<div class="chat-message ${item.role === "user" ? "user" : "assistant"}">${escapeHtml(item.content)}</div>`)
      .join("") || `<div class="chat-message assistant">${escapeHtml(activeCharacterQuote(character))}</div>`;
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
  els.chatSendBtn.disabled = state.chat.isStreaming;
  els.chatInput.disabled = state.chat.isStreaming;
}

async function refreshChatStatus() {
  try {
    const response = await fetch("./api/chat/status", { cache: "no-store" });
    const status = await response.json();
    els.chatStatus.textContent = status.configured
      ? `已连接 DeepSeek ${status.model}，对话记录会按角色保存在本地。`
      : "DeepSeek API key 未配置：请设置 DEEPSEEK_API_KEY，或在项目目录创建 .deepseek_api_key。";
  } catch {
    els.chatStatus.textContent = "本地对话服务未连接，请用 start_app.py 或快捷方式启动。";
  }
}

function openCharacterChat() {
  state.chat.activeCharacterId = state.game.profile.activeCharacter || CHARACTER_CONFIG[0].id;
  renderChatCharacterSelect();
  renderChat();
  refreshChatStatus();
  els.characterChatModal.classList.add("show");
  setTimeout(() => els.chatInput.focus(), 80);
}

function closeCharacterChat() {
  els.characterChatModal.classList.remove("show");
}

function changeChatCharacter(characterId) {
  state.chat.activeCharacterId = characterId;
  renderChat();
  refreshChatStatus();
}

async function sendChatMessage() {
  const text = els.chatInput.value.trim();
  if (!text || state.chat.isStreaming) return;
  const character = characterById(state.chat.activeCharacterId);
  const history = chatHistory(character.id);
  history.push({ role: "user", content: text, time: Date.now() });
  els.chatInput.value = "";
  state.chat.isStreaming = true;
  renderChat();
  els.chatStreamingText.textContent = "";
  els.chatStatus.textContent = `${character.name} 正在回应...`;

  const messages = [
    { role: "system", content: chatSystemPrompt(character) },
    ...history.slice(-20).map((item) => ({ role: item.role, content: item.content })),
  ];

  try {
    const response = await fetch("./api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: character.id, messages }),
    });
    if (!response.ok || !response.body) {
      let detail = "";
      try {
        detail = (await response.json()).error || "";
      } catch {
        detail = await response.text();
      }
      throw new Error(detail || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let answer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      answer += decoder.decode(value, { stream: true });
      els.chatStreamingText.textContent = answer;
    }
    answer += decoder.decode();
    const finalAnswer = answer.trim() || "……我刚刚好像走神了，再说一次好吗？";
    history.push({ role: "assistant", content: finalAnswer, time: Date.now() });
    state.chat.histories[character.id] = history.slice(-60);
    saveChatHistories();
    els.chatStatus.textContent = "对话已保存到本地。";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    history.push({ role: "assistant", content: `连接失败：${message}`, time: Date.now() });
    els.chatStatus.textContent = "对话请求失败，请检查 API key 或网络。";
  } finally {
    state.chat.isStreaming = false;
    saveChatHistories();
    renderChat();
  }
}

function clearChatHistory() {
  if (state.chat.isStreaming) return;
  state.chat.histories[state.chat.activeCharacterId] = [];
  saveChatHistories();
  renderChat();
  showToast("已清空当前角色对话记录");
}

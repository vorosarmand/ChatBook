const API_URL = "/";
const converter = new showdown.Converter();
const pusherAppKey = document.querySelector(
  'meta[name="pusher-app-key"]'
).content;
const pusherCluster = document.querySelector(
  'meta[name="pusher-cluster"]'
).content;

const pusher = new Pusher(pusherAppKey, {
  cluster: pusherCluster,
});

let promptToRetry = null;
let uniqueIdToRetry = null;

const roomInput = document.getElementById("room-input");
const joinRoomButton = document.getElementById("join-room-button");

joinRoomButton.addEventListener("click", () => {
  joinChatRoom(roomInput.value);
});

function joinChatRoom(roomId) {
  if (!roomId) {
    return;
  }

  window.conversationId = roomId;
  subscribeToChatChannel(window.conversationId);

  roomInput.disabled = true;
  joinRoomButton.disabled = true;
}

const submitButton = document.getElementById("submit-button");
const regenerateResponseButton = document.getElementById(
  "regenerate-response-button"
);
const promptInput = document.getElementById("prompt-input");
const responseList = document.getElementById("response-list");

let isGeneratingResponse = false;
let loadInterval = null;

promptInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    if (event.ctrlKey || event.shiftKey) {
      document.execCommand("insertHTML", false, "<br/><br/>");
    } else {
      getGPTResult();
    }
  }
});

function addResponse(selfFlag, prompt) {
  const uniqueId = `id-${uuidv4()}`;
  const html = `
    <div class="response-container ${
      selfFlag ? "my-question" : "chatgpt-response"
    }">
      <img class="avatar-image" src="assets/img/${
        selfFlag ? "me" : "chatgpt"
      }.png" alt="avatar"/>
      <div class="prompt-content" id="${uniqueId}">${prompt}</div>
    </div>
  `;
  responseList.insertAdjacentHTML("beforeend", html);
  responseList.scrollTop = responseList.scrollHeight;
  return uniqueId;
}

function setRetryResponse(prompt, uniqueId) {
  promptToRetry = prompt;
  uniqueIdToRetry = uniqueId;
  regenerateResponseButton.style.display = "block";
}

function setErrorForResponse(element, message) {
  element.innerHTML = `<span class="error-message">${message}</span>`;
}

function loader(element) {
  element.innerHTML = "<span>Thinking</span>";
  loadInterval = setInterval(() => {
    element.innerHTML += ".";
    if (element.innerHTML === "<span>Thinking</span>....") {
      element.innerHTML = "<span>Thinking</span>";
    }
  }, 300);
}

async function getAccessToken() {
  try {
    const response = await fetch("/api/auth/token");
    if (response.ok) {
      const { access_token } = await response.json();
      console.log("Access token fetched:", access_token);
      return access_token;
    } else {
      throw new Error("Failed to get access token");
    }
  } catch (error) {
    console.error("Error getting access token:", error);
  }
  return null;
}

function subscribeToChatChannel(conversationId) {
  const channel = pusher.subscribe(`chat-${conversationId}`);
  channel.bind("new-message", (message) => {
    if (message.role === "assistant") {
      addResponse(false, converter.makeHtml(message.content));
    } else if (message.role === "user") {
      addUserMessage(converter.makeHtml(message.content));
    }
  });
}

function addUserMessage(prompt) {
  addResponse(true, `<div>${prompt}</div>`);
}

async function getGPTResult(_promptToRetry, _uniqueIdToRetry) {
  const prompt = _promptToRetry ?? promptInput.textContent;

  if (isGeneratingResponse || !prompt || !window.conversationId) {
    return;
  }

  submitButton.classList.add("loading");
  promptInput.textContent = "";

  if (!_uniqueIdToRetry) {
    addUserMessage(prompt);
  }

  const uniqueId = _uniqueIdToRetry ?? addResponse(false);
  const responseElement = document.getElementById(uniqueId);

  loader(responseElement);
  isGeneratingResponse = true;

  try {
    const model = "gpt-3.5-turbo";

    if (!window.conversationId) {
      window.conversationId = uuidv4();
      subscribeToChatChannel(window.conversationId);
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error("Access token is not available");
      return;
    }

    const response = await fetch(API_URL + "get-prompt-result", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        prompt,
        model,
        conversationId: window.conversationId,
      }),
    });

    if (!response.ok) {
      setRetryResponse(prompt, uniqueId);
      setErrorForResponse(
        responseElement,
        `HTTP Error: ${await response.text()}`
      );
      return;
    }

    const responseText = await response.text();
    const responseHtml = converter.makeHtml(responseText);
    responseElement.innerHTML = responseHtml;

    promptToRetry = null;
    uniqueIdToRetry = null;
    regenerateResponseButton.style.display = "none";

    setTimeout(() => {
      responseList.scrollTop = responseList.scrollHeight;
      hljs.highlightAll();
    }, 10);
  } catch (err) {
    setRetryResponse(prompt, uniqueId);
    setErrorForResponse(responseElement, `Error: ${err.message}`);
  } finally {
    isGeneratingResponse = false;
    submitButton.classList.remove("loading");
    clearInterval(loadInterval);
  }
}

submitButton.addEventListener("click", () => {
  getGPTResult();
});

regenerateResponseButton.addEventListener("click", () => {
  regenerateGPTResult();
});

document.addEventListener("DOMContentLoaded", function () {
  promptInput.focus();
});

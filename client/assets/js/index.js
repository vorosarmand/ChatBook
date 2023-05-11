const API_URL = "http://localhost:3000";
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

async function joinChatRoom(roomId) {
  if (!roomId) {
    return;
  }

  window.conversationId = roomId;

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error("Access token is not available");
      return;
    }

    const response = await fetch(`/api/chat-history/${roomId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      const chatHistory = await response.json();
      displayChatHistory(chatHistory);
      // Save user ID
      window.userId = chatHistory.userId;
    } else {
      console.error("Error fetching chat history");
    }
  } catch (error) {
    console.error("Error joining chat room:", error);
  }

  subscribeToChatChannel(window.conversationId);
  console.log("Joined chat room with ID:", roomId);

  roomInput.disabled = true;
  joinRoomButton.disabled = true;
}

function displayChatHistory(chatHistory) {
  chatHistory.forEach((message) => {
    if (message.role === "assistant") {
      addResponse(false, converter.makeHtml(message.content));
    } else {
      addOtherUserMessage(converter.makeHtml(message.content));
    }
  });
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
    const response = await fetch("/api/auth/token", { credentials: "include" });
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

function addOtherUserMessage(prompt) {
  addResponse(false, `<div>${prompt}</div>`);
}

function subscribeToChatChannel(conversationId) {
  console.log("Subscribing to chat channel:", `chat-${conversationId}`);
  const channel = pusher.subscribe(`chat-${conversationId}`);

  pusher.connection.bind("pusher:connection_established", () => {
    console.log("Pusher connected");
  });

  pusher.connection.bind("state_change", (states) => {
    console.log("Pusher state changed:", states);
  });

  channel.bind("pusher:subscription_succeeded", () => {
    console.log("Subscription to chat channel succeeded");
  });

  channel.bind("pusher:subscription_error", (statusCode) => {
    console.error(
      `Subscription to chat channel failed with status code: ${statusCode}`
    );
  });

  channel.bind("new-message", (message) => {
    console.log("New message received:", message);
    if (message.role === "assistant") {
      addResponse(false, converter.makeHtml(message.content));
    } else if (message.role === "user") {
      addOtherUserMessage(converter.makeHtml(message.content));
    }
  });

  console.log("channel:", channel);
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

  // Add the user's message to the display before the bot's response
  addUserMessage(prompt);

  const uniqueId = addResponse(false);
  const responseElement = document.getElementById(uniqueId);

  loader(responseElement);
  isGeneratingResponse = true;

  try {
    const model = "gpt-4";

    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error("Access token is not available");
      return;
    }

    const response = await fetch(API_URL + "/api/get-prompt-result", {
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

    const result = await response.json();
    const generatedResponse = converter.makeHtml(result.choices[0].text.trim());
    responseElement.innerHTML = generatedResponse;

    promptToRetry = null;
    uniqueIdToRetry = null;
    regenerateResponseButton.style.display = "none";
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

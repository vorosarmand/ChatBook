let loadInterval = null;

import { subscribeToChatChannel } from "./api.js";

let promptToRetry = null;
let uniqueIdToRetry = null;
const converter = new showdown.Converter();
const roomInput = document.getElementById("room-input");
const joinRoomButton = document.getElementById("join-room-button");

export function displayChatHistory(chatHistory) {
  chatHistory.forEach((message) => {
    if (message.role === "assistant") {
      addResponse(false, converter.makeHtml(message.content));
    } else {
      addOtherUserMessage(converter.makeHtml(message.content));
    }
  });
}

export function addResponse(selfFlag, prompt) {
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
  const responseList = document.getElementById("response-list");

  responseList.insertAdjacentHTML("beforeend", html);
  responseList.scrollTop = responseList.scrollHeight;
  return uniqueId;
}

export function setRetryResponse(prompt, uniqueId) {
  promptToRetry = prompt;
  uniqueIdToRetry = uniqueId;
  regenerateResponseButton.style.display = "block";
}

export function setErrorForResponse(element, message) {
  element.innerHTML = `<span class="error-message">${message}</span>`;
}

export function loader(element) {
  element.innerHTML = "<span>Thinking</span>";
  loadInterval = setInterval(() => {
    element.innerHTML += ".";
    if (element.innerHTML === "<span>Thinking</span>....") {
      element.innerHTML = "<span>Thinking</span>";
    }
  }, 300);
}

export function addOtherUserMessage(prompt) {
  addResponse(false, `<div>${prompt}</div>`);
}

export function addUserMessage(prompt) {
  addResponse(true, `<div>${prompt}</div>`);
}

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

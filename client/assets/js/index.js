const API_URL = "/";
const converter = new showdown.Converter();
let promptToRetry = null;
let uniqueIdToRetry = null;

// Get HTML elements
const submitButton = document.getElementById("submit-button");
const regenerateResponseButton = document.getElementById(
  "regenerate-response-button"
);
const promptInput = document.getElementById("prompt-input");
const responseList = document.getElementById("response-list");

let isGeneratingResponse = false;
let loadInterval = null;

// Handle 'Enter' key press in prompt input
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

// Function to add responses to the chat window
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

// Function to set up retry response
function setRetryResponse(prompt, uniqueId) {
  promptToRetry = prompt;
  uniqueIdToRetry = uniqueId;
  regenerateResponseButton.style.display = "block";
}

// Function to set error message for response
function setErrorForResponse(element, message) {
  element.innerHTML = `<span class="error-message">${message}</span>`;
}

// Function to display loader during API call
function loader(element) {
  element.innerHTML = "<span>Thinking</span>";
  loadInterval = setInterval(() => {
    element.innerHTML += ".";
    if (element.innerHTML === "<span>Thinking</span>....") {
      element.innerHTML = "<span>Thinking</span>";
    }
  }, 300);
}

// Function to get GPT result
async function getGPTResult(_promptToRetry, _uniqueIdToRetry) {
  const prompt = _promptToRetry ?? promptInput.textContent;

  // Return if generating a response or no prompt provided
  if (isGeneratingResponse || !prompt) {
    return;
  }

  submitButton.classList.add("loading");
  promptInput.textContent = "";

  // Add user's prompt to the chat window
  if (!_uniqueIdToRetry) {
    addResponse(true, `<div>${prompt}</div>`);
  }

  const uniqueId = _uniqueIdToRetry ?? addResponse(false);
  const responseElement = document.getElementById(uniqueId);

  // Display loader while waiting for the API response
  loader(responseElement);
  isGeneratingResponse = true;

  try {
    const model = "gpt-3.5-turbo";

    // Generate a conversation ID if it doesn't exist
    if (!window.conversationId) {
      window.conversationId = uuidv4();
    }

    // Make API call to get the GPT result
    const response = await fetch(API_URL + "get-prompt-result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        model,
        conversationId: window.conversationId,
      }),
    });

    // Handle non-OK responses
    if (!response.ok) {
      setRetryResponse(prompt, uniqueId);
      setErrorForResponse(
        responseElement,
        `HTTP Error: ${await response.text()}`
      );
      return;
    }

    // Convert response text to HTML and update the chat window
    const responseText = await response.text();
    const responseHtml = converter.makeHtml(responseText);
    responseElement.innerHTML = responseHtml;

    // Reset retry variables and hide the regenerate button
    promptToRetry = null;
    uniqueIdToRetry = null;
    regenerateResponseButton.style.display = "none";

    // Scroll to the bottom of the chat window and highlight code blocks
    setTimeout(() => {
      responseList.scrollTop = responseList.scrollHeight;
      hljs.highlightAll();
    }, 10);
  } catch (err) {
    // Handle errors and set up the response for retry
    setRetryResponse(prompt, uniqueId);
    setErrorForResponse(responseElement, `Error: ${err.message}`);
  } finally {
    // Cleanup after response is received or error is handled
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

import { getGPTResult } from "./api.js";

const submitButton = document.getElementById("submit-button");
const regenerateResponseButton = document.getElementById(
  "regenerate-response-button"
);
const promptInput = document.getElementById("prompt-input");

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

submitButton.addEventListener("click", () => {
  getGPTResult();
});

regenerateResponseButton.addEventListener("click", () => {
  regenerateGPTResult();
});

document.addEventListener("DOMContentLoaded", function () {
  promptInput.focus();
});

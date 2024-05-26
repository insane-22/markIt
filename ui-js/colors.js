function getFromBackgroundPage(payload, ignoreErrors = true) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      const error = chrome.runtime.lastError;
      if (!ignoreErrors && error) {
        reject(error);
        return;
      }

      if (!ignoreErrors && response.success === false) {
        reject(response.error);
        return;
      }

      resolve(response.response);
    });
  });
}

const form = document.getElementById("change-color-form");
const useTextColorCheckbox = document.querySelector(
  '#change-color-form input[name="use-text-color"]'
);
const textColorFieldSet = document.getElementById("text-color-fieldset");

const colorsListElement = document.getElementById("colors-list");
const selectedColorElement = document.getElementById("selected-color");
const colorTitleElement = document.getElementById("change-color-title");
const exampleText = document.querySelector(".example-text");

function colorChanged(colorOption) {
  const { backgroundColor, borderColor } = colorOption.style;
  const { colorTitle } = colorOption.dataset;

  // Swap (in the UI) the previous selected color and the newly selected one
  const {
    backgroundColor: previousBackgroundColor,
    borderColor: previousBorderColor,
  } = selectedColorElement.style;
  const { colorTitle: previousColorTitle } = selectedColorElement.dataset;
  colorOption.style.backgroundColor = previousBackgroundColor;
  colorOption.style.borderColor = previousBorderColor;
  colorOption.dataset.colorTitle = previousColorTitle;
  selectedColorElement.style.backgroundColor = backgroundColor;
  selectedColorElement.style.borderColor = borderColor;
  selectedColorElement.dataset.colorTitle = colorTitle;
  colorTitleElement.innerText = colorTitle;

  chrome.runtime.sendMessage({
    action: "change-color",
    color: colorTitle,
    source: "popup",
  });
}

async function initializeColorsList() {
  colorsListElement.innerHTML = "";
  const color = await getFromBackgroundPage({ action: "get-current-color" });

  colorTitleElement.innerText = color.title;
  const colorOptions = await getFromBackgroundPage({
    action: "get-color-options",
  });
  // console.log(color);
  exampleText.style.color = color.textColor;
  exampleText.style.backgroundColor = color.color;

  colorOptions.forEach((colorOption) => {
    const colorTitle = colorOption.title;
    const selected = colorTitle === color.title;
    const colorOptionElement = selected
      ? selectedColorElement
      : document.createElement("div");

    if (selected) {
      colorOptionElement.classList.add("colour");
    } else {
      colorOptionElement.classList.add("color");
    }
    colorOptionElement.dataset.colorTitle = colorTitle;
    colorOptionElement.style.backgroundColor = colorOption.color;
    if (colorOption.textColor)
      colorOptionElement.style.borderColor = colorOption.textColor;

    if (!selected) {
      colorOptionElement.addEventListener("click", (e) =>
        colorChanged(e.target)
      );
      colorsListElement.appendChild(colorOptionElement);
    }
  });
}

initializeColorsList();

form.addEventListener("submit", confirm);
useTextColorCheckbox.addEventListener("change", onUseTextColorValueChanged);

function confirm(e) {
  e.preventDefault();

  const data = new FormData(e.target);
  const colorTitle = colorTitleElement.innerText;
  const color = hexToRgb(data.get("highlight-color"));
  const textColor = hexToRgb(data.get("text-color"));

  chrome.runtime.sendMessage(
    {
      action: "edit-color",
      colorTitle,
      color,
      textColor,
    },
    () => {
      initializeColorsList();
      const error = chrome.runtime.lastError;
      if (error) {
        console.error("Runtime error:", error);
        return;
      }
    }
  );
}

function onUseTextColorValueChanged(e) {
  textColorFieldSet.disabled = !e.target.checked;
}

function hexToRgb(hex) {
  if (!hex) return null;

  const [r, g, b] = hex
    .substring(1)
    .match(/.{2}/gu)
    .map((x) => parseInt(x, 16));
  return `rgb(${r}, ${g}, ${b})`;
}

function rgbToHex(rgb) {
  if (!rgb) return null;

  return rgb.replace(
    /^rgb\((\d{1,3}), ?(\d{1,3}), ?(\d{1,3})\)$/gu,
    (m, r, g, b) => {
      const values = [r, g, b].map((x) =>
        parseInt(x, 10).toString(16).padStart(2, "0")
      );
      return `#${values.join("")}`;
    }
  );
}

const form = document.getElementById("change-color-form");
const useTextColorCheckbox = document.querySelector(
  '#change-color-form input[name="use-text-color"]'
);
const textColorFieldSet = document.getElementById("text-color-fieldset");

const colorsListElement = document.getElementById("colors-list");
const selectedColorElement = document.getElementById("selected-color");
const colorTitleElement = document.getElementById("change-color-title");
const exampleText = document.querySelector(".example-text");
const exampleText2 = document.querySelector(".example-text-2");

initialize();

async function initialize() {
  colorsListElement.innerHTML = "";
  const currentColor = await getFromBackgroundPage({
    action: "get-current-color",
  });

  colorTitleElement.innerText = currentColor.title;
  const availableColors = await getFromBackgroundPage({
    action: "get-color-options",
  });
  exampleText.style.color = currentColor.textColor;
  exampleText.style.backgroundColor = currentColor.color;
  exampleText2.style.color = currentColor.textColor;
  exampleText2.style.backgroundColor = currentColor.color;

  availableColors.forEach((colorOption) => {
    const colorTitle = colorOption.title;
    const isSelected = colorTitle === currentColor.title;
    const colorOptionElement = isSelected
      ? selectedColorElement
      : document.createElement("div");

    if (isSelected) {
      colorOptionElement.classList.add("colour");
    } else {
      colorOptionElement.classList.add("color");
    }
    colorOptionElement.dataset.colorTitle = colorTitle;
    colorOptionElement.style.backgroundColor = colorOption.color;
    if (colorOption.textColor)
      colorOptionElement.style.borderColor = colorOption.textColor;

    if (!isSelected) {
      colorOptionElement.addEventListener("click", (e) =>
        handleColorChange(e.target)
      );
      colorsListElement.appendChild(colorOptionElement);
    }
  });
}

async function getFromBackgroundPage(payload, ignoreErrors = true) {
  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, resolve);
  });

  const lastError = chrome.runtime.lastError;
  if (!ignoreErrors && lastError) {
    throw lastError;
  }

  if (!ignoreErrors && response.success === false) {
    throw response.error;
  }
  return response.response;
}

function handleColorChange(colorOption) {
  const { backgroundColor, borderColor } = colorOption.style;
  const { colorTitle } = colorOption.dataset;

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

  exampleText.style.color = colorTitle;
  exampleText.style.backgroundColor = backgroundColor;
  exampleText2.style.color = colorTitle;
  exampleText2.style.backgroundColor = backgroundColor;

  chrome.runtime.sendMessage({
    action: "change-color",
    color: colorTitle,
  });
}

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
      initialize();
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
    .slice(1)
    .match(/.{2}/g)
    .map((x) => parseInt(x, 16));
  return `rgb(${r}, ${g}, ${b})`;
}

function rgbToHex(rgb) {
  if (!rgb) return null;

  return rgb.replace(
    /^rgb\((\d{1,3}), ?(\d{1,3}), ?(\d{1,3})\)$/g,
    (_, r, g, b) =>
      `#${[r, g, b]
        .map((x) => parseInt(x).toString(16).padStart(2, "0"))
        .join("")}`
  );
}

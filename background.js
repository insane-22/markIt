const DEFAULT_COLORS = [
  { title: "yellow", color: "rgb(255, 246, 21)" },
  { title: "green", color: "rgb(68, 255, 147)" },
  { title: "blue", color: "rgb(66, 229, 255)" },
  { title: "pink", color: "rgb(244, 151, 255)" },
  { title: "dark", color: "rgb(52, 73, 94)", textColor: "rgb(255, 255, 255)" },
];

const DEFAULT_COLOR = { title: "yellow" };
// let currentColor = { title: "blue" }; // Default current color

// Initialize currentColor from storage
chrome.storage.sync.get("currentColor", (data) => {
  if (data.currentColor) {
    console.log("Initialized currentColor:", data.currentColor);
  }
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (!request.action) return;

  switch (request.action) {
    case "change-color":
      changeColor(request.color);
      sendResponse({ success: true });
      return;
    case "edit-color":
      editColor(request.colorTitle, request.color, request.textColor)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          sendResponse({ success: false, error });
        });
      return true; // Return true to indicate async response
    case "get-current-color":
      getCurrentColor()
        .then((color) => {
          sendResponse({ success: true, response: color });
        })
        .catch((error) => {
          sendResponse({ success: false, error });
        });
      return true; // Return true to indicate async response
    case "get-color-options":
      getColorOptions()
        .then((colors) => {
          sendResponse({ success: true, response: colors });
        })
        .catch((error) => {
          sendResponse({ success: false, error });
        });
      return true; // Return true to indicate async response
    default:
      sendResponse({ success: false, error: "Unknown action" });
  }
});

async function getCurrentColor() {
  const data = await chrome.storage.sync.get("currentColor");
  // console.log(data);
  const colorTitle = data.currentColor
    ? data.currentColor
    : DEFAULT_COLOR.title;
  const colorOptions = await getColorOptions();
  return (
    colorOptions.find((colorOption) => colorOption.title === colorTitle) ||
    colorOptions[0]
  );
}

function getColorOptions() {
  return new Promise((resolve, _reject) => {
    chrome.storage.sync.get({ colors: DEFAULT_COLORS }, ({ colors }) => {
      console.log("Fetched color options:", colors);
      resolve(colors);
    });
  });
}

function changeColor(color) {
  if (!color) {
    return;
  }
  chrome.storage.sync.set({ currentColor: color }, () => {
    console.log("Updated currentColor:", color);
  });
}

async function editColor(title, color, textColor) {
  const colorOptions = await getColorOptions();
  const colorOption = colorOptions.find((option) => option.title === title);
  if (colorOption) {
    colorOption.color = color;
    colorOption.textColor = textColor;
    if (!textColor) {
      delete colorOption.textColor;
    }
    chrome.storage.sync.set({ colors: colorOptions }, () => {
      console.log("Updated colors in storage:", colorOptions);
    });
  } else {
    throw new Error("Color not found");
  }
}

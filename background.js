const DEFAULT_COLORS = [
  { title: "yellow", color: "rgb(255, 246, 21)" },
  { title: "green", color: "rgb(68, 255, 147)" },
  { title: "blue", color: "rgb(66, 229, 255)" },
  { title: "pink", color: "rgb(244, 151, 255)" },
  { title: "pink", color: "rgb(244, 151, 255)" },
  { title: "dark", color: "rgb(52, 73, 94)", textColor: "rgb(255, 255, 255)" },
];

const DEFAULT_COLOR = { title: "yellow" };

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.removeAll();

  chrome.contextMenus.create({
    title: "Highlight",
    id: "highlight",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async ({ menuItemId }) => {
  switch (menuItemId) {
    case "highlight":
      await highlightText();
      break;
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
      return true; 
    case "get-highlights":
      getHighlights()
        .then((highlights) => {
          sendResponse({ success: true, response: highlights });
        })
        .catch((error) => {
          sendResponse({ success: false, error });
        });
      return true; 
    case "get-current-color":
      getCurrentColor()
        .then((color) => {
          sendResponse({ success: true, response: color });
        })
        .catch((error) => {
          sendResponse({ success: false, error });
        });
      return true; 
    case "get-color-options":
      getColorOptions()
        .then((colors) => {
          sendResponse({ success: true, response: colors });
        })
        .catch((error) => {
          sendResponse({ success: false, error });
        });
      return true; 
    case "highlight":
      highlightText()
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          sendResponse({ success: false, error });
        });
      return true;
    case "save-highlights":
      chrome.storage.local.set({ highlights: request.highlights }, () => {
        sendResponse({ success: true });
      });
      return true;
    default:
      sendResponse({ success: false, error: "Unknown action" });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, _tab) => {
  if (changeInfo.url) {
    if (changeInfo.url.startsWith("chrome://")) {
      console.log("Skipping chrome:// URL");
      return;
    }
    loadPageHighlights(tabId, changeInfo.url);
  }
});

async function loadPageHighlights(tabId, url) {
  await executeInTab(tabId, { file: "lib/jquery-3.7.1.min.js" });
  await executeInTab(tabId, { file: "injectionScript.js" });
}

async function getCurrentColor() {
  const data = await chrome.storage.sync.get("currentColor");
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
      resolve(colors);
    });
  });
}

async function getHighlights() {
  const { highlights } = await chrome.storage.local.get({ highlights: [] });
  return highlights;
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

async function getCurrentTab() {
  const queryOptions = { active: true, lastFocusedWindow: true };
  const [tab] = await chrome.tabs.query(queryOptions);
  // console.log("Current tab:", tab);
  return tab;
}

async function executeInCurrentTab(opts) {
  const tab = await getCurrentTab();
  return executeInTab(tab.id, opts);
}

async function executeInTab(tabId, { file }) {
  try {
    console.log("Executing script in tab:", tabId, { file });
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: [file],
    });

    if (chrome.runtime.lastError !== undefined) {
      console.log(chrome.runtime.lastError);
    }
  } catch (error) {
    console.error(error);
    console.log(error);
  }
}

async function highlightText() {
  await executeInCurrentTab({ file: "lib/jquery-3.7.1.min.js" });
  await executeInCurrentTab({ file: "injectionScript.js" });
}

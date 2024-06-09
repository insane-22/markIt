(function () {
  let hoverToolEl = null;
  let hoverToolTimeout = null;
  let currentHighlightEl = null;
  let highlightClicked = false;
  let copyBtnEl = null;
  let addNoteBtnEl = null;
  let deleteBtnEl = null;
  let alternativeUrlIndexOffset = 0;
  let noteEl = null;
  let addNoteClicked = null;
  let noteSubmitBtnEl = null;

  init();

  async function init() {
    const selection = window.getSelection();
    initializeHoverTools();
    addNote();
    if (selection.toString) {
      start(selection);
    }
    loadAll();
  }

  async function start(selection) {
    const selectionString = selection.toString();
    if (!selectionString) return;

    let container = selection.getRangeAt(0).commonAncestorContainer;
    while (!container.innerHTML) {
      container = container.parentNode;
    }

    let color = await getCurrentColor();
    const h = await store(
      selection,
      container,
      location.hostname + location.pathname,
      location.href,
      color.color,
      color.textColor
    );
    highlight(
      selectionString,
      container,
      selection,
      color.color,
      color.textColor,
      h
    );
  }

  function loadAll() {
    function loadAllHighlightsOnPage() {
      loadAllFromStorage(
        window.location.hostname + window.location.pathname,
        window.location.pathname
      );
    }

    if (document.readyState === "loading") {
      document.removeEventListener("DOMContentLoaded", loadAllHighlightsOnPage); // Prevent duplicates
      document.addEventListener("DOMContentLoaded", loadAllHighlightsOnPage);
    } else {
      loadAllHighlightsOnPage();
    }
  }

  async function loadAllFromStorage(url, alternativeUrl) {
    const result = await chrome.storage.local.get({ highlights: {} });
    let highlights = [];
    if (alternativeUrl) {
      highlights = highlights.concat(result.highlights[alternativeUrl] || []);
    }
    alternativeUrlIndexOffset = highlights.length;

    highlights = highlights.concat(result.highlights[url] || []);

    if (!highlights) return;

    for (let i = 0; i < highlights.length; i++) {
      load(highlights[i], i);
    }
  }

  function load(highlightVal, highlightIndex, noErrorTracking) {
    const selection = {
      anchorNode: elementFromQuery(highlightVal.anchorNode),
      anchorOffset: highlightVal.anchorOffset,
      focusNode: elementFromQuery(highlightVal.focusNode),
      focusOffset: highlightVal.focusOffset,
    };

    const { color, stringS, textColor } = highlightVal;
    const container = elementFromQuery(highlightVal.container);

    if (!selection.anchorNode || !selection.focusNode || !container) {
      if (!noErrorTracking) {
        addHighlightError(highlightVal, highlightIndex);
      }
      return false;
    }

    const success = highlight(
      stringS,
      container,
      selection,
      color,
      textColor,
      highlightIndex
    );

    if (!noErrorTracking) {
      addHighlightError(highlightVal, highlightIndex);
    }
    return success;
  }

  function addHighlightError() {
    console.log("ERRORRR!!");
  }

  function elementFromQuery(storedQuery) {
    const re = />textNode:nth-of-type\(([0-9]+)\)$/iu;
    const result = re.exec(storedQuery);

    if (result) {
      const textNodeIndex = parseInt(result[1], 10);
      storedQuery = storedQuery.replace(re, "");
      const parent = robustQuerySelector(storedQuery);

      if (!parent) return undefined;

      return parent.childNodes[textNodeIndex];
    }

    return robustQuerySelector(storedQuery);
  }

  function escapeCSSSelector(selector) {
    return selector.replace(/#([0-9])/g, (match, p1) => `#\\3${p1} `);
  }

  function robustQuerySelector(query) {
    const escapedQuery = escapeCSSSelector(query);

    try {
      const element = document.querySelector(escapedQuery);
      return element;
    } catch (error) {
      console.log(
        `Invalid CSS selector: ${escapedQuery}. Attempting manual traversal.`
      );
    }
    let element = document;
    const parts = query.split(">");

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!element) {
        return null;
      }

      const re = /^(.*?):nth-of-type\((\d+)\)$/i;
      const match = re.exec(part);
      if (match) {
        const tagName = match[1];
        const index = parseInt(match[2], 10);
        const children = Array.from(element.children).filter(
          (child) => child.tagName.toLowerCase() === tagName.toLowerCase()
        );
        element = children[index - 1];
      } else {
        const escapedPart = escapeCSSSelector(part);
        element = element.querySelector(escapedPart);
      }
    }
    return element;
  }

  async function initializeHoverTools() {
    $.get(chrome.runtime.getURL("tools.html"), (data) => {
      hoverToolEl = $(data);
      hoverToolEl.hide();
      hoverToolEl[0].addEventListener("mouseenter", onHoverToolMouseEnter);
      hoverToolEl[0].addEventListener("mouseleave", onHighlightMouseLeave);

      copyBtnEl = hoverToolEl.find(".highlighter--icon-copy")[0];
      deleteBtnEl = hoverToolEl.find(".highlighter--icon-delete")[0];
      addNoteBtnEl = hoverToolEl.find(".highlighter--icon-add-note")[0];
      copyBtnEl.addEventListener("click", onCopyBtnClicked);
      deleteBtnEl.addEventListener("click", onDeleteBtnClicked);
      addNoteBtnEl.addEventListener("click", onAddNoteBtnClicked);
    });

    window.addEventListener("click", (e) => {
      if (e.target.classList?.contains("highlighter--highlighted")) return;
      if (e.target.classList?.contains("highlighter-note")) return;
      if (e.target.classList?.contains("submit-note-btn")) return;
      if (e.target.classList?.contains("note-text")) return;
      hide();
    });

    window.addEventListener("scroll", () => {
      if (highlightClicked) {
        moveToolbarToHighlight(currentHighlightEl);
      }
    });
  }

  async function addNote() {
    $.get(chrome.runtime.getURL("notes.html"), (data) => {
      noteEl = $(data);
      noteEl.hide();
      noteSubmitBtnEl = noteEl.find(".submit-note-btn")[0];
      noteSubmitBtnEl.addEventListener("click", submitNote);

      window.addEventListener("click", (e) => {
        if (e.target.classList?.contains("highlighter--highlighted")) return;
        if (e.target.classList?.contains("highlighter-note")) return;
        if (e.target.classList?.contains("submit-note-btn")) return;
        if (e.target.classList?.contains("note-text")) return;
        hideNote();
      });

      window.addEventListener("scroll", () => {
        if (addNoteClicked) {
          moveNote(currentHighlightEl);
        }
      });
    });
  }

  function hide() {
    $(".highlighter--hovered").removeClass("highlighter--hovered");
    getHoverToolEl()?.hide();
    hoverToolTimeout = null;
    highlightClicked = false;
  }

  function hideNote() {
    getNoteEl()?.hide();
    addNoteClicked = false;
  }

  async function getCurrentColor() {
    const data = await chrome.storage.sync.get("currentColor");
    const colorTitle = data.currentColor;
    const colorOptions = await getColorOptions();
    return (
      colorOptions.find((colorOption) => colorOption.title === colorTitle) ||
      colorOptions[0]
    );
  }

  async function getColorOptions() {
    const colors = await chrome.storage.sync.get("colors");
    return colors.colors;
  }

  function getQuery(element) {
    if (element.id) return `#${escapeCSSString(element.id)}`;
    if (element.localName === "html") return "html";

    const parent = element.parentNode;

    const parentSelector = getQuery(parent);
    if (!element.localName) {
      const index = Array.prototype.indexOf.call(parent.childNodes, element);
      return `${parentSelector}>textNode:nth-of-type(${index})`;
    } else {
      const index =
        Array.from(parent.childNodes)
          .filter((child) => child.localName === element.localName)
          .indexOf(element) + 1;
      return `${parentSelector}>${element.localName}:nth-of-type(${index})`;
    }
  }

  function escapeCSSString(cssString) {
    return cssString.replace(/(:)/gu, "\\$1");
  }

  async function store(selection, container, url, href, color, textColor) {
    const { highlights } = await chrome.storage.local.get({ highlights: {} });

    if (!highlights[url]) highlights[url] = [];

    const k = highlights[url].push({
      stringS: selection.toString(),
      container: getQuery(container),
      anchorNode: getQuery(selection.anchorNode),
      anchorOffset: selection.anchorOffset,
      focusNode: getQuery(selection.focusNode),
      focusOffset: selection.focusOffset,
      color,
      textColor,
      href,
      notes: [],
      createdAt: Date.now(),
    });
    await chrome.storage.local.set({ highlights });
    return k - 1;
  }

  function highlight(
    selString,
    container,
    selection,
    color,
    textColor,
    highlightIndex
  ) {
    let highlightInfo;
    try {
      highlightInfo = {
        color: color ? color : "yellow",
        textColor: textColor ? textColor : "inherit",
        highlightIndex: highlightIndex,
        selectionString: selString,
        anchor: $(selection.anchorNode),
        anchorOffset: selection.anchorOffset,
        focus: $(selection.focusNode),
        focusOffset: selection.focusOffset,
      };
    } catch (error) {
      alert("Error in highlight function: " + error.message);
      console.error(error);
    }

    try {
      recuriveWrapper($(container), highlightInfo);
    } catch (error) {
      console.log(error);
    }

    if (selection.removeAllRanges) selection.removeAllRanges();

    const parent = $(container).parent();
    parent.find(`.highlighter--highlighted`).each((_i, el) => {
      initializeHighlightEventListeners(el);
    });
  }

  function recuriveWrapper(container, highlightInfo) {
    _recursiveWrapper(container, highlightInfo, false, 0);
  }

  function _recursiveWrapper(
    container,
    highlightInfo,
    startFound,
    charsHighlighted
  ) {
    const {
      color,
      textColor,
      highlightIndex,
      selectionString,
      anchor,
      anchorOffset,
      focus,
      focusOffset,
    } = highlightInfo;

    const selectionLength = selectionString.length;

    container.contents().each((_index, element) => {
      if (charsHighlighted >= selectionLength) return;

      if (element.nodeType !== Node.TEXT_NODE) {
        const jqElement = $(element);
        if (
          jqElement.is(":visible") &&
          getComputedStyle(element).visibility !== "hidden"
        ) {
          [startFound, charsHighlighted] = _recursiveWrapper(
            jqElement,
            highlightInfo,
            startFound,
            charsHighlighted
          );
        }
        return;
      }

      let startIndex = 0;
      if (!startFound) {
        if (!anchor.is(element) && !focus.is(element)) return;
        startFound = true;
        startIndex = Math.min(
          ...[
            ...(anchor.is(element) ? [anchorOffset] : []),
            ...(focus.is(element) ? [focusOffset] : []),
          ]
        );
      }

      const { nodeValue, parentElement: parent } = element;

      if (startIndex > nodeValue.length) {
        throw new Error(
          `No match found for highlight string '${selectionString}'`
        );
      }

      const highlightTextEl = element.splitText(startIndex);
      let i = startIndex;
      for (; i < nodeValue.length; i++) {
        while (
          charsHighlighted < selectionLength &&
          selectionString[charsHighlighted].match(/\s/u)
        )
          charsHighlighted++;

        if (charsHighlighted >= selectionLength) break;

        const char = nodeValue[i];
        if (char === selectionString[charsHighlighted]) {
          charsHighlighted++;
        } else if (!char.match(/\s/u)) {
          throw new Error(
            `No match found for highlight string '${selectionString}'`
          );
        }
      }

      if (parent.classList.contains("highlighter--highlighted")) return;

      const elementCharCount = i - startIndex;
      const insertBeforeElement = highlightTextEl.splitText(elementCharCount);
      const highlightText = highlightTextEl.nodeValue;

      if (highlightText.match(/^\s*$/u)) {
        parent.normalize();
        return;
      }

      const highlightNode = document.createElement("span");
      highlightNode.classList.add(
        color === "inherit"
          ? "highlighter--deleted"
          : "highlighter--highlighted"
      );
      highlightNode.style.backgroundColor = color;
      highlightNode.style.color = textColor;
      highlightNode.dataset.highlightId = highlightIndex;
      highlightNode.textContent = highlightTextEl.nodeValue;
      highlightTextEl.remove();
      parent.insertBefore(highlightNode, insertBeforeElement);
    });
    return [startFound, charsHighlighted];
  }

  //tools

  function initializeHighlightEventListeners(highlightElement) {
    highlightElement.addEventListener(
      "mouseenter",
      onHighlightMouseEnterOrClick
    );
    highlightElement.addEventListener("click", onHighlightMouseEnterOrClick);
    highlightElement.addEventListener("mouseleave", onHighlightMouseLeave);
  }

  function removeHighlightEventListeners(highlightElement) {
    highlightElement.removeEventListener(
      "mouseenter",
      onHighlightMouseEnterOrClick
    );
    highlightElement.removeEventListener("click", onHighlightMouseEnterOrClick);
    highlightElement.removeEventListener("mouseleave", onHighlightMouseLeave);
  }

  function onHighlightMouseEnterOrClick(e) {
    const newHighlightEl = e.target;
    const newHighlightId = newHighlightEl.getAttribute("data-highlight-id");
    if (highlightClicked && e.type !== "click") return;

    highlightClicked = e.type === "click";

    if (hoverToolTimeout !== null) {
      clearTimeout(hoverToolTimeout);
      hoverToolTimeout = null;

      if (
        newHighlightId === currentHighlightEl.getAttribute("data-highlight-id")
      )
        return;
    }

    currentHighlightEl = newHighlightEl;

    moveToolbarToHighlight(newHighlightEl, e.clientX);
    moveNote(newHighlightEl, e.clientX);

    $(".highlighter--hovered").removeClass("highlighter--hovered");
    $(
      `.highlighter--highlighted[data-highlight-id='${newHighlightId}']`
    ).addClass("highlighter--hovered");
  }

  function moveToolbarToHighlight(highlightEl, cursorX) {
    const boundingRect = highlightEl.getBoundingClientRect();
    const toolWidth = 108;

    const hoverTop = boundingRect.top - 45;
    getHoverToolEl()?.css({ top: hoverTop });

    if (cursorX !== undefined) {
      let hoverLeft = null;
      if (boundingRect.width < toolWidth) {
        hoverLeft = boundingRect.left + boundingRect.width / 2 - toolWidth / 2;
      } else if (cursorX - boundingRect.left < toolWidth / 2) {
        hoverLeft = boundingRect.left;
      } else if (boundingRect.right - cursorX < toolWidth / 2) {
        hoverLeft = boundingRect.right - toolWidth;
      } else {
        hoverLeft = cursorX - toolWidth / 2;
      }

      getHoverToolEl()?.css({ left: hoverLeft });
    }

    getHoverToolEl()?.show();
  }

  function moveNote(highlightEl, cursorX) {
    const boundingRect = highlightEl.getBoundingClientRect();
    const toolWidth = 250;

    const hoverTop = boundingRect.top - 45;
    getNoteEl()?.css({ top: hoverTop });

    if (cursorX !== undefined) {
      let hoverLeft = null;
      if (boundingRect.width < toolWidth) {
        hoverLeft = boundingRect.left + toolWidth / 2;
      } else if (cursorX - boundingRect.left < toolWidth / 2) {
        hoverLeft = boundingRect.left;
      } else if (boundingRect.right - cursorX < toolWidth / 2) {
        hoverLeft = boundingRect.right - toolWidth;
      } else {
        hoverLeft = cursorX - toolWidth / 2;
      }

      getNoteEl()?.css({ left: hoverLeft });
    }
  }

  function getHoverToolEl() {
    if (!hoverToolEl.isConnected) {
      hoverToolEl.appendTo("body");
    }

    return hoverToolEl;
  }
  function getNoteEl() {
    if (!noteEl.isConnected) {
      noteEl.appendTo("body");
    }

    return noteEl;
  }

  function onHoverToolMouseEnter() {
    if (hoverToolTimeout !== null) {
      clearTimeout(hoverToolTimeout);
      hoverToolTimeout = null;
    }
  }

  function onHighlightMouseLeave() {
    if (!highlightClicked) {
      hoverToolTimeout = setTimeout(hide, 170);
    }
  }

  function onCopyBtnClicked() {
    const highlightId = currentHighlightEl.getAttribute("data-highlight-id");
    const highlights = document.querySelectorAll(
      `.${"highlighter--highlighted"}[data-highlight-id='${highlightId}']`
    );
    const highlightText = Array.from(highlights)
      .map((el) => el.textContent.replace(/\s+/gmu, " "))
      .join("");
    navigator.clipboard.writeText(highlightText);
    alert("copied");
  }

  function onDeleteBtnClicked() {
    const highlightId = currentHighlightEl.getAttribute("data-highlight-id");
    removeHighlight(highlightId);

    getHoverToolEl()?.hide();
    hoverToolTimeout = null;
  }

  async function removeHighlight(highlightId) {
    const highlights = $(
      `.highlighter--highlighted[data-highlight-id='${highlightId}']`
    );
    $(".highlighter--hovered").removeClass("highlighter--hovered");

    highlights.css("backgroundColor", "inherit");
    highlights.css("color", "inherit");
    highlights
      .removeClass("highlighter--highlighted")
      .addClass("highlighter--deleted");

    await updateStorage(
      highlightId,
      window.location.hostname + window.location.pathname,
      window.location.pathname
    );

    highlights.each((_, el) => {
      removeHighlightEventListeners(el);
    });
  }

  async function updateStorage(highlightIndex, url, alternativeUrl) {
    const { highlights } = await chrome.storage.local.get({ highlights: {} });

    let urlToUse = url;
    let indexToUse = highlightIndex - alternativeUrlIndexOffset;
    if (highlightIndex < alternativeUrlIndexOffset) {
      urlToUse = alternativeUrl;
      indexToUse = highlightIndex;
    }

    const highlightsInKey = highlights[urlToUse];
    if (highlightsInKey) {
      highlightsInKey.splice(indexToUse, 1);
      chrome.storage.local.set({ highlights });
    }
  }

  function onAddNoteBtnClicked(e) {
    e.stopPropagation();

    const noteElement = getNoteEl();
    if (noteElement) {
      noteElement.show();
    } else {
      console.error("Note element is not available.");
    }
  }

  async function submitNote() {
    const noteText = $("#note-text").val();
    const highlightId = currentHighlightEl.getAttribute("data-highlight-id");
    if (noteText.trim()) {
      await storeNote(
        noteText,
        highlightId,
        window.location.hostname + window.location.pathname,
        window.location.pathname
      );
      $("#note-text").val("");
      $("#highlighter-note").hide();
    } else {
      alert("Please write a note before submitting.");
    }
  }

  async function storeNote(str, highlightIndex, url, alternativeUrl) {
    const { highlights } = await chrome.storage.local.get({ highlights: {} });

    let urlToUse = url;
    let indexToUse = highlightIndex - alternativeUrlIndexOffset;
    if (highlightIndex < alternativeUrlIndexOffset) {
      urlToUse = alternativeUrl;
      indexToUse = highlightIndex;
    }

    const highlightsInKey = highlights[urlToUse];
    if (highlightsInKey) {
      const highlightObject = highlightsInKey[indexToUse];
      if (highlightObject) {
        highlightObject.notes.push(str);
        chrome.storage.local.set({ highlights });
      }
    }
  }
})();

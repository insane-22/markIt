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

init();
var notesDiv = document.getElementsByClassName("notesDiv")[0];
notesDiv.style.display = "block";

async function init() {
  const highlights = await getFromBackgroundPage({
    action: "get-highlights",
  });
  displayHighlights(highlights);
}

function displayHighlights(highlights) {
  const isEmpty = (obj) => Object.entries(obj).length === 0;
  if (isEmpty(highlights)) {
    notesDiv.innerHTML = `<div class="no-highlight">No highlights stored yet. Click Instructions to learn how to use it.</div>`;
  } else {
    let add = "";
    let h = 0;

    Object.keys(highlights).forEach((key) => {
      if (highlights[key].length === 0) {
        h = 1;
      } else {
        h = 0;
        let detailsContent = "";
        for (let i = 0; i < highlights[key].length; i++) {
          let notesContent = "";
          highlights[key][i].notes.forEach((note, noteIndex) => {
            notesContent += `
              <div class="note-item">
                <span class="highlight-note">${note}</span>
                <button class="delete-note-btn" data-key="${key}" data-index="${i}" data-note-index="${noteIndex}">
                  <i class='bx bxs-trash'></i>
                </button>
              </div>`;
          });

          detailsContent += `
          <div class="highlight-item">
            <div class="highlight-header">
              <span class="highlight-text">${highlights[key][i].stringS}</span>
              <button class="delete-highlight-btn" data-key="${key}" data-index="${i}">
                <i class='bx bxs-trash'></i>
              </button>
            </div>
            ${notesContent}
          </div>`;
        }
        add += `<details class="detail"><summary class="notes-url wrap">${key}
      <i class='bx bxs-chevron-down' style='display: inline-block; margin-right: 6px'></i>
      <span class="num">${highlights[key].length}</span>
      </summary>${detailsContent}</details> <hr />`;
      }
    });
    if (h === 1) {
      notesDiv.innerHTML = `<div class="no-highlight">No highlights stored yet. Click Instructions to learn how to use it.</div>`;
    } else {
      notesDiv.innerHTML = add;
    }

    document.querySelectorAll('.delete-note-btn').forEach(button => {
      button.addEventListener('click', async (event) => {
        const key = event.target.closest('button').getAttribute('data-key');
        const highlightIndex = event.target.closest('button').getAttribute('data-index');
        const noteIndex = event.target.closest('button').getAttribute('data-note-index');
        await deleteNoteOrHighlight(key, highlightIndex, noteIndex);
      });
    });

    document.querySelectorAll('.delete-highlight-btn').forEach(button => {
      button.addEventListener('click', async (event) => {
        const key = event.target.closest('button').getAttribute('data-key');
        const highlightIndex = event.target.closest('button').getAttribute('data-index');
        await deleteNoteOrHighlight(key, highlightIndex);
      });
    });
  }
}

async function deleteNoteOrHighlight(key, highlightIndex, noteIndex = null) {
  const highlights = await getFromBackgroundPage({ action: 'get-highlights' });

  if (noteIndex !== null) {
    highlights[key][highlightIndex].notes.splice(noteIndex, 1);
    if (highlights[key][highlightIndex].notes.length === 0) {
      highlights[key].splice(highlightIndex, 1);
    }
  } else {
    highlights[key].splice(highlightIndex, 1);
  }

  if (highlights[key].length === 0) {
    delete highlights[key];
  }

  await saveHighlights(highlights);
  displayHighlights(highlights);
}

async function saveHighlights(highlights) {
  await getFromBackgroundPage({
    action: 'save-highlights',
    highlights: highlights
  });
}




async function deleteNoteOrHighlight(key, highlightIndex, noteIndex = null) {
  const highlights = await getFromBackgroundPage({ action: "get-highlights" });

  if (noteIndex !== null) {
    highlights[key][highlightIndex].notes.splice(noteIndex, 1);
    if (highlights[key][highlightIndex].notes.length === 0) {
      highlights[key].splice(highlightIndex, 1);
    }
  } else {
    highlights[key].splice(highlightIndex, 1);
  }

  if (highlights[key].length === 0) {
    delete highlights[key];
  }

  await saveHighlights(highlights);
  displayHighlights(highlights);
}

async function saveHighlights(highlights) {
  await getFromBackgroundPage({
    action: "save-highlights",
    highlights: highlights,
  });
}


function generatePDF(highlights) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Notes and Highlights", 20, 20);
  doc.setLineWidth(0.5);
  doc.line(20, 25, 190, 25);

  let yPosition = 35;
  Object.keys(highlights).forEach((key) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 255);
    doc.text(key, 20, yPosition);
    yPosition += 10;

    highlights[key].forEach((item) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);

      const highlightText = doc.splitTextToSize(
        `Highlight: ${item.stringS}`,
        170
      );
      doc.text(highlightText, 20, yPosition);
      yPosition += highlightText.length * 6;

      item.notes.forEach((note, index) => {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        const noteText = doc.splitTextToSize(`Note ${index + 1}: ${note}`, 160);
        doc.text(noteText, 30, yPosition);
        yPosition += noteText.length * 6;
      });

      yPosition += 10;
    });

    yPosition += 10;

    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }
  });
  doc.save("notes_and_highlights.pdf");
}

document.getElementById("export-btn").addEventListener("click", async () => {
  const highlights = await getFromBackgroundPage({
    action: "get-highlights",
  });

  generatePDF(highlights);
});

function filterHighlights(highlights, keyword, date) {
  const filteredHighlights = {};
  Object.keys(highlights).forEach((key) => {
    const filteredItems = highlights[key].filter((item) => {
      const matchesKeyword = keyword
        ? item.stringS.includes(keyword) ||
          item.notes.some((note) => note.includes(keyword))
        : true;
      const matchesDate = date
        ? new Date(item.createdAt).toDateString() ===
          new Date(date).toDateString()
        : true;
      return matchesKeyword && matchesDate;
    });
    if (filteredItems.length > 0) {
      filteredHighlights[key] = filteredItems;
    }
  });
  return filteredHighlights;
}

document
  .getElementById("search-box")
  .addEventListener("input", async (event) => {
    const keyword = event.target.value;
    const date = document.getElementById("date-filter").value;
    const highlights = await getFromBackgroundPage({
      action: "get-highlights",
    });
    const filteredHighlights = filterHighlights(highlights, keyword, date);
    displayHighlights(filteredHighlights);
  });

document
  .getElementById("date-filter")
  .addEventListener("change", async (event) => {
    const date = event.target.value;
    const keyword = document.getElementById("search-box").value;
    const highlights = await getFromBackgroundPage({
      action: "get-highlights",
    });
    const filteredHighlights = filterHighlights(highlights, keyword, date);
    displayHighlights(filteredHighlights);
  });
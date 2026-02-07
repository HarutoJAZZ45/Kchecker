import './style.css'
import Papa from 'papaparse'
import { KANJI_DATA } from './kanjiData.js'

// Elements
const gradePills = document.querySelectorAll('.grade-btn');
const fileInput = document.getElementById('file-input');
const uploadTrigger = document.getElementById('upload-trigger');
const resultSection = document.getElementById('result-section');
const emptyState = document.getElementById('empty-state');
const resultBody = document.getElementById('result-body');
const resFilename = document.getElementById('res-filename');
const resTotalRows = document.getElementById('res-total-rows');
const resAlertCount = document.getElementById('res-alert-count');

let currentData = null;
let currentFilename = '';
let currentGrade = 5;

// Kanji check logic
const isKanji = (char) => {
    return /[\u4E00-\u9FFF]/.test(char);
};

const getKanjiGrade = (char) => {
    for (let g = 1; g <= 6; g++) {
        if ((KANJI_DATA[g] || []).includes(char)) return g;
    }
    return 7; // Middle school or above
};

const getUnlearnedKanjiInfo = (text, targetGrade) => {
    const info = [];
    const learnedKanjis = new Set();
    for (let g = 1; g <= targetGrade; g++) {
        (KANJI_DATA[g] || []).forEach(k => learnedKanjis.add(k));
    }

    const found = new Set();
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (isKanji(char) && !learnedKanjis.has(char) && !found.has(char)) {
            found.add(char);
            info.push({
                char,
                grade: getKanjiGrade(char)
            });
        }
    }
    return info;
};

const highlightUnlearned = (text, unlearnedInfo) => {
    if (unlearnedInfo.length === 0) return text;
    let highlighted = text;
    unlearnedInfo.forEach(item => {
        const regex = new RegExp(item.char, 'g');
        highlighted = highlighted.replace(regex, `<span class="highlight-kanji">${item.char}</span>`);
    });
    return highlighted;
};

// Event Listeners
uploadTrigger.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
});

gradePills.forEach(btn => {
    btn.addEventListener('click', () => {
        gradePills.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        currentGrade = parseInt(btn.dataset.grade);
        if (currentData) processData(currentData);
    });
});

const handleFile = (file) => {
    currentFilename = file.name;
    Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
            currentData = results.data;
            processData(results.data);
        }
    });
};

const processData = (data) => {
    const targetGrade = currentGrade;
    resultBody.innerHTML = '';

    let alertCount = 0;
    let totalRows = 0;
    let startCounting = false;
    let relativeIndex = 1;

    data.forEach((row) => {
        const firstCell = String(row[0] || '').trim();

        // Marker to determine the start of problems
        if (firstCell === '//この行より下の行を編集してください') {
            startCounting = true;
            return;
        }

        // Skip other meta lines
        if (firstCell.startsWith('//') ||
            firstCell === 'context' ||
            firstCell === 'iconFileName' ||
            firstCell === 'alternatives') {
            return;
        }

        // If we haven't seen the marker yet, we treat lines as meta (though the above logic caught most)
        if (!startCounting) return;

        totalRows++;

        const rowKanjiInfo = [];
        const seenChars = new Set();
        row.forEach(cell => {
            const info = getUnlearnedKanjiInfo(String(cell), targetGrade);
            info.forEach(item => {
                if (!seenChars.has(item.char)) {
                    seenChars.add(item.char);
                    rowKanjiInfo.push(item);
                }
            });
        });

        if (rowKanjiInfo.length > 0) {
            alertCount++;
            const tr = document.createElement('tr');

            const problemContent = row.filter(c => String(c).trim().length > 0).join(' | ');
            const highlightedContent = highlightUnlearned(problemContent, rowKanjiInfo);

            tr.innerHTML = `
        <td>${relativeIndex}</td>
        <td><div class="problem-text">${highlightedContent}</div></td>
        <td>
          ${rowKanjiInfo.map(item => {
                const gradeLabel = item.grade === 7 ? '中+' : `${item.grade}年`;
                return `<span class="unlearned-badge" title="${gradeLabel}">${item.char}<small>${gradeLabel}</small></span>`;
            }).join('')}
        </td>
      `;
            resultBody.appendChild(tr);
        }
        relativeIndex++;
    });

    resFilename.textContent = currentFilename;
    resTotalRows.textContent = totalRows;
    resAlertCount.textContent = alertCount;

    emptyState.classList.add('hidden');
    resultSection.classList.remove('hidden');
};

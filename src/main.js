import './style.css'
import Papa from 'papaparse'
import { KANJI_DATA } from './kanjiData.js'

// DOM要素の取得
const gradePills = document.querySelectorAll('.grade-btn');
const fileInput = document.getElementById('file-input');
const uploadTrigger = document.getElementById('upload-trigger');
const resultSection = document.getElementById('result-section');
const emptyState = document.getElementById('empty-state');
const resultBody = document.getElementById('result-body');
const resFilename = document.getElementById('res-filename');
const resTotalRows = document.getElementById('res-total-rows');
const resAlertCount = document.getElementById('res-alert-count');

// アプリケーションの状態管理
let currentData = null;      // 読み込まれたCSVデータ
let currentFilename = '';    // 読み込まれたファイル名
let currentGrade = 1;       // 現在選択されている対象学年

/**
 * 漢字判定ロジック
 */

// 特定の文字が漢字かどうかを判定する
const isKanji = (char) => {
    return /[\u4E00-\u9FFF]/.test(char);
};

// 指定された漢字がどの学年で配当されているかを返す。1-6年以外は7（中学生以上）とする。
const getKanjiGrade = (char) => {
    for (let g = 1; g <= 6; g++) {
        if ((KANJI_DATA[g] || []).includes(char)) return g;
    }
    return 7;
};

// テキスト内から、指定学年までに習っていない漢字を抽出する。重複は排除する。
const getUnlearnedKanjiInfo = (text, targetGrade) => {
    const info = [];
    const learnedKanjis = new Set();
    // 選択された学年までに習う漢字をSetに格納する
    for (let g = 1; g <= targetGrade; g++) {
        (KANJI_DATA[g] || []).forEach(k => learnedKanjis.add(k));
    }

    const found = new Set();
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        // 漢字であり、かつ既習漢字に含まれず、まだ抽出されていない文字を対象とする
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

// テキスト内の未習漢字（unlearnedInfoに含まれる文字）を強調表示用のHTMLタグで囲む
const highlightUnlearned = (text, unlearnedInfo) => {
    if (unlearnedInfo.length === 0) return text;
    let highlighted = text;
    unlearnedInfo.forEach(item => {
        const regex = new RegExp(item.char, 'g');
        highlighted = highlighted.replace(regex, `<span class="highlight-kanji">${item.char}</span>`);
    });
    return highlighted;
};

/**
 * イベントリスナーの設定
 */

// クリックでファイル選択ダイアログを開く
uploadTrigger.addEventListener('click', () => fileInput.click());

// ファイルが選択された際の処理
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
});

/**
 * ドラッグ&ドロップ対応
 */

window.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.body.classList.add('drag-active');
});

window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    // 画面外に出た場合のみクラスを削除する
    if (e.relatedTarget === null) {
        document.body.classList.remove('drag-active');
    }
});

window.addEventListener('drop', (e) => {
    e.preventDefault();
    document.body.classList.remove('drag-active');
    const file = e.dataTransfer.files[0];
    // CSVファイルのみを受け付ける
    if (file && file.name.endsWith('.csv')) {
        handleFile(file);
    }
});

// 学年に応じたテーマ（背景色など）をbody属性にセットする
const updateTheme = (grade) => {
    document.body.setAttribute('data-grade', grade);
};

// 学年選択ボタンの切り替え処理
gradePills.forEach(btn => {
    btn.addEventListener('click', () => {
        gradePills.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        currentGrade = parseInt(btn.dataset.grade);
        updateTheme(currentGrade);
        // データが読み込み済みであれば再計算を行う
        if (currentData) processData(currentData);
    });
});

// 初期化。初期設定のテーマを適用する。
updateTheme(currentGrade);

/**
 * ファイル解析処理
 */

// ファイルを読み込み、CSVとしてパースする
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

// パースされたデータをもとに、未習漢字のチェックと画面への描画を行う
const processData = (data) => {
    const targetGrade = currentGrade;
    resultBody.innerHTML = '';

    let alertCount = 0;   // 未習漢字を含む行数
    let totalRows = 0;    // 有効なデータ行数
    let startCounting = false; // データ開始フラグ
    let relativeIndex = 1;     // 問題番号のカウント

    data.forEach((row) => {
        const firstCell = String(row[0] || '').trim();

        // 開始マーカーが見つかったら、次の行からカウントを開始する。マーカー行自体はスキップする。
        if (firstCell === '//この行より下の行を編集してください') {
            startCounting = true;
            return;
        }

        // コメント行や特定のメタデータ行は集計対象外とする
        if (firstCell.startsWith('//') ||
            firstCell === 'context' ||
            firstCell === 'iconFileName' ||
            firstCell === 'alternatives') {
            return;
        }

        // マーカーより上の行は無視する
        if (!startCounting) return;

        totalRows++;

        const rowKanjiInfo = [];
        const seenChars = new Set();
        // 行全体のセル内から未習漢字を抽出する
        row.forEach(cell => {
            const info = getUnlearnedKanjiInfo(String(cell), targetGrade);
            info.forEach(item => {
                if (!seenChars.has(item.char)) {
                    seenChars.add(item.char);
                    rowKanjiInfo.push(item);
                }
            });
        });

        // 未習漢字が見つかった場合のみ、テーブルに行を追加する
        if (rowKanjiInfo.length > 0) {
            alertCount++;
            const tr = document.createElement('tr');

            // 内容の表示用テキストを作成。空セルを除外してパイプで連結する。
            const problemContent = row.filter(c => String(c).trim().length > 0).join(' | ');
            const highlightedContent = highlightUnlearned(problemContent, rowKanjiInfo);

            tr.innerHTML = `
        <td>${relativeIndex}</td>
        <td><div class="problem-text">${highlightedContent}</div></td>
        <td>
          ${rowKanjiInfo.map(item => {
                const gradeLabel = item.grade === 7 ? '中+' : `${item.grade}年`;
                return `<span class="unlearned-badge" title="${gradeLabel}"><span class="kanji-char">${item.char}</span><small>${gradeLabel}</small></span>`;
            }).join('')}
        </td>
      `;
            resultBody.appendChild(tr);
        }
        relativeIndex++;
    });

    // 統計情報の更新
    resFilename.textContent = currentFilename;
    resTotalRows.textContent = totalRows;
    resAlertCount.textContent = alertCount;

    // 表示の切り替え（初期画面を隠し、結果画面を表示する）
    emptyState.classList.add('hidden');
    resultSection.classList.remove('hidden');
};

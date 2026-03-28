import { categories } from "./data.js";
import { applyGuess, createGameState, normalizeGuess, remainingCount, revealAll } from "./game.js";

const categoryPrompt = document.getElementById("categoryPrompt");
const guessForm = document.getElementById("guessForm");
const guessInput = document.getElementById("guessInput");
const guessList = document.getElementById("guessList");
const feedback = document.getElementById("feedback");
const foundCount = document.getElementById("foundCount");
const guessCount = document.getElementById("guessCount");
const livesCount = document.getElementById("livesCount");
const revealBtn = document.getElementById("revealBtn");
const newCategoryBtn = document.getElementById("newCategoryBtn");
const wordbankList = document.getElementById("wordbankList");
const wordbankCount = document.getElementById("wordbankCount");
const wordbankOptions = document.getElementById("wordbankOptions");
const adminOpenBtn = document.getElementById("adminOpenBtn");
const adminModal = document.getElementById("adminModal");
const adminCloseBtn = document.getElementById("adminCloseBtn");
const adminLoginView = document.getElementById("adminLoginView");
const adminPanelView = document.getElementById("adminPanelView");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminUsername = document.getElementById("adminUsername");
const adminPassword = document.getElementById("adminPassword");
const adminLoginFeedback = document.getElementById("adminLoginFeedback");
const adminCategoryLabel = document.getElementById("adminCategoryLabel");
const adminPromptInput = document.getElementById("adminPromptInput");
const adminSourceLabelInput = document.getElementById("adminSourceLabelInput");
const adminWordbankInput = document.getElementById("adminWordbankInput");
const adminAnswerList = document.getElementById("adminAnswerList");
const adminAnswerCount = document.getElementById("adminAnswerCount");
const adminAnswerFilter = document.getElementById("adminAnswerFilter");
const adminShowSelectedOnly = document.getElementById("adminShowSelectedOnly");
const adminSelectVisible = document.getElementById("adminSelectVisible");
const adminClearVisible = document.getElementById("adminClearVisible");
const adminAutoFillRanks = document.getElementById("adminAutoFillRanks");
const adminAnswerStatus = document.getElementById("adminAnswerStatus");
const adminUpdateForm = document.getElementById("adminUpdateForm");
const adminUpdateFeedback = document.getElementById("adminUpdateFeedback");
const adminClearSelections = document.getElementById("adminClearSelections");
const adminResetGame = document.getElementById("adminResetGame");
const resultsModal = document.getElementById("resultsModal");
const resultsCloseBtn = document.getElementById("resultsCloseBtn");
const resultsHeadline = document.getElementById("resultsHeadline");
const resultsDetails = document.getElementById("resultsDetails");
const resultsList = document.getElementById("resultsList");
const shareResultsBtn = document.getElementById("shareResultsBtn");
const shareFeedback = document.getElementById("shareFeedback");

let state = null;
let adminSelected = new Set();
let adminRanks = new Map();
let adminValues = new Map();
let adminAnswerFilterValue = "";
let adminOverrideCategory = null;
let livesRemaining = 5;

const LIVES_STORAGE_KEY = "daily-tens-lives";

const ADMIN_STORAGE_KEY = "daily-tens-admin-category";

function loadAdminOverride() {
  const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.prompt || !parsed.wordbank || !parsed.answers) {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

function loadLives() {
  const raw = localStorage.getItem(LIVES_STORAGE_KEY);
  if (!raw) {
    return 5;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 5;
}

function saveLives() {
  localStorage.setItem(LIVES_STORAGE_KEY, String(livesRemaining));
}

function saveAdminOverride(category) {
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(category));
}

function pickRandomCategory() {
  const pool = adminOverrideCategory ? [adminOverrideCategory, ...categories] : categories;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

function setFeedback(message, status = "neutral") {
  feedback.textContent = message;
  feedback.dataset.status = status;
}

function renderList() {
  guessList.innerHTML = "";
  state.answers.forEach((answer) => {
    const li = document.createElement("li");
    li.className = "guess-item";

    const left = document.createElement("div");
    left.innerHTML = `<span class="rank">#${answer.rank}</span> ${state.found.has(answer.name) ? answer.name : "???"}`;

    const right = document.createElement("div");
    right.className = "value";
    right.textContent = state.found.has(answer.name) ? `${answer.value} ${state.category.sourceLabel}` : "";

    li.append(left, right);
    if (state.found.has(answer.name)) {
      li.classList.add("found");
    }

    guessList.appendChild(li);
  });
}

function renderStats() {
  foundCount.textContent = `${state.found.size}/10`;
  guessCount.textContent = `${state.guessCount}`;
  livesCount.textContent = `${livesRemaining}`;
}

function applyGameOverState() {
  const isGameOver = livesRemaining <= 0;
  guessInput.disabled = isGameOver;
  guessForm.querySelector("button").disabled = isGameOver;
  revealBtn.disabled = isGameOver;
  newCategoryBtn.disabled = isGameOver;
  if (isGameOver) {
    setFeedback("You are out of lives. Refreshing will not reset lives.", "warning");
    openResultsModal();
  }
}

function buildResultsSummary() {
  const foundCountValue = state.found.size;
  const totalCount = state.answers.length;
  const guesses = state.guessCount;
  return {
    headline: `You found ${foundCountValue} of ${totalCount}.`,
    details: `Guesses: ${guesses} · Lives left: ${livesRemaining}`
  };
}

function renderResultsList() {
  resultsList.innerHTML = "";
  state.answers.forEach((answer) => {
    const item = document.createElement("li");
    item.className = "results-item";

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = `#${answer.rank} ${answer.name}`;

    const meta = document.createElement("span");
    meta.className = "meta";
    const foundTag = state.found.has(answer.name) ? "Found" : "Missed";
    meta.textContent = `${answer.value} ${state.category.sourceLabel} · ${foundTag}`;

    item.append(label, meta);
    resultsList.appendChild(item);
  });
}

function openResultsModal() {
  const summary = buildResultsSummary();
  resultsHeadline.textContent = summary.headline;
  resultsDetails.textContent = summary.details;
  renderResultsList();
  shareFeedback.textContent = "";
  resultsModal.classList.remove("hidden");
}

function closeResultsModal() {
  resultsModal.classList.add("hidden");
}

function buildShareText() {
  const summary = buildResultsSummary();
  return `Daily Tens Results\n${state.category.prompt}\n${summary.headline}\n${summary.details}`;
}

async function handleShareResults() {
  const shareText = buildShareText();
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Daily Tens Results",
        text: shareText
      });
      shareFeedback.textContent = "Shared successfully.";
    } catch (error) {
      shareFeedback.textContent = "Share canceled.";
    }
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(shareText);
    shareFeedback.textContent = "Share text copied to clipboard.";
  } else {
    shareFeedback.textContent = "Sharing is not supported on this device.";
  }
}

function parseWordbankInput() {
  return adminWordbankInput.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getFilteredAdminWordbank(wordbank) {
  const normalizedFilter = normalizeGuess(adminAnswerFilterValue);
  return wordbank
    .filter((word) => {
      if (adminShowSelectedOnly.checked && !adminSelected.has(word)) {
        return false;
      }
      return normalizedFilter ? normalizeGuess(word).includes(normalizedFilter) : true;
    })
    .sort((left, right) => {
      const selectedDiff = Number(adminSelected.has(right)) - Number(adminSelected.has(left));
      if (selectedDiff !== 0) {
        return selectedDiff;
      }
      return left.localeCompare(right);
    });
}

function getNextAvailableRank() {
  const usedRanks = new Set(adminRanks.values());
  for (let rank = 1; rank <= 10; rank += 1) {
    if (!usedRanks.has(rank)) {
      return rank;
    }
  }
  return undefined;
}

function renderAdminAnswerStatus(wordbank) {
  const visibleCount = getFilteredAdminWordbank(wordbank).length;
  const selectedRanks = [...adminSelected].map((word) => adminRanks.get(word)).filter((rank) => rank !== undefined);
  const hasDuplicateRanks = new Set(selectedRanks).size !== selectedRanks.length;

  let status = "neutral";
  let message = `Showing ${visibleCount} of ${wordbank.length} entries.`;

  if (adminSelected.size < 10) {
    status = "warning";
    message = `Select ${10 - adminSelected.size} more answer${10 - adminSelected.size === 1 ? "" : "s"}. Showing ${visibleCount} of ${wordbank.length} entries.`;
  } else if (adminSelected.size > 10) {
    status = "warning";
    message = `Too many selected. Keep exactly 10 answers.`;
  } else if (selectedRanks.length < 10) {
    status = "warning";
    message = "Assign a rank (1-10) to each selected answer.";
  } else if (hasDuplicateRanks) {
    status = "warning";
    message = "Ranks must be unique across selected answers.";
  } else {
    status = "success";
    message = "Selection and ranks look good.";
  }

  adminAnswerStatus.dataset.status = status;
  adminAnswerStatus.textContent = message;
}

function renderAdminAnswerList(wordbank) {
  adminAnswerList.innerHTML = "";
  const visibleWords = getFilteredAdminWordbank(wordbank);

  if (visibleWords.length === 0) {
    const emptyState = document.createElement("li");
    emptyState.className = "admin-answer-empty";
    emptyState.textContent = "No entries match your filter.";
    adminAnswerList.appendChild(emptyState);
  }

  visibleWords.forEach((word) => {
    const isSelected = adminSelected.has(word);
    const li = document.createElement("li");
    li.className = "admin-answer-item";
    if (isSelected) {
      li.classList.add("selected");
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = isSelected;
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        if (adminSelected.size >= 10 && !adminSelected.has(word)) {
          checkbox.checked = false;
          adminUpdateFeedback.textContent = "You can only select 10 answers.";
          return;
        }
        adminSelected.add(word);
        if (!adminRanks.has(word)) {
          const nextRank = getNextAvailableRank();
          if (nextRank) {
            adminRanks.set(word, nextRank);
          }
        }
      } else {
        adminSelected.delete(word);
        adminRanks.delete(word);
      }
      renderAdminAnswerList(wordbank);
    });

    const rankInput = document.createElement("input");
    rankInput.type = "number";
    rankInput.min = "1";
    rankInput.max = "10";
    rankInput.placeholder = "Rank";
    rankInput.className = "admin-rank";
    rankInput.value = adminRanks.get(word) ?? "";
    rankInput.disabled = !isSelected;
    rankInput.addEventListener("input", () => {
      const value = Number(rankInput.value);
      if (Number.isInteger(value) && value >= 1 && value <= 10) {
        adminRanks.set(word, value);
      } else {
        adminRanks.delete(word);
      }
      renderAdminAnswerStatus(wordbank);
    });

    const valueInput = document.createElement("input");
    valueInput.type = "text";
    valueInput.placeholder = "Value";
    valueInput.className = "admin-value";
    valueInput.value = adminValues.get(word) ?? "";
    valueInput.disabled = !isSelected;
    valueInput.addEventListener("input", () => {
      const trimmed = valueInput.value.trim();
      if (trimmed) {
        adminValues.set(word, trimmed);
      } else {
        adminValues.delete(word);
      }
    });

    const label = document.createElement("span");
    label.className = "admin-answer-label";
    label.textContent = word;

    li.addEventListener("click", (event) => {
      if (event.target === checkbox || event.target === rankInput || event.target === valueInput) {
        return;
      }
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change"));
    });

    li.append(checkbox, rankInput, valueInput, label);
    adminAnswerList.appendChild(li);
  });

  adminAnswerCount.textContent = `${adminSelected.size}/10`;
  renderAdminAnswerStatus(wordbank);
}

function renderWordbank(filterValue = "") {
  const normalizedFilter = normalizeGuess(filterValue);
  const filtered = state.wordbank.filter((word) =>
    normalizedFilter ? normalizeGuess(word).includes(normalizedFilter) : true
  );

  wordbankCount.textContent = `${filtered.length}/${state.wordbank.length}`;
  wordbankList.innerHTML = "";

  filtered.forEach((word) => {
    const li = document.createElement("li");
    li.className = "bank-item";
    li.textContent = word;
    if (state.found.has(word)) {
      li.classList.add("found");
    }
    li.addEventListener("click", () => {
      guessInput.value = word;
      guessInput.focus();
      renderWordbank(word);
    });
    wordbankList.appendChild(li);
  });
}

function renderWordbankOptions() {
  wordbankOptions.innerHTML = "";
  state.wordbank.forEach((word) => {
    const option = document.createElement("option");
    option.value = word;
    wordbankOptions.appendChild(option);
  });
}

function syncAdminFields() {
  adminCategoryLabel.textContent = state.category.prompt;
  adminPromptInput.value = state.category.prompt;
  adminSourceLabelInput.value = state.category.sourceLabel ?? "";
  adminWordbankInput.value = state.wordbank.join("\n");
  adminAnswerFilterValue = "";
  adminAnswerFilter.value = "";
  adminShowSelectedOnly.checked = false;
  adminSelected = new Set(state.answers.map((answer) => answer.name));
  adminRanks = new Map(state.answers.map((answer) => [answer.name, answer.rank]));
  adminValues = new Map(state.answers.map((answer) => [answer.name, String(answer.value)]));
  renderAdminAnswerList(state.wordbank);
}

function startNewGame(category = pickRandomCategory()) {
  state = createGameState(category);
  categoryPrompt.textContent = category.prompt;
  guessInput.value = "";
  setFeedback("Make a guess to get started.");
  renderList();
  renderStats();
  renderWordbank();
  renderWordbankOptions();
  syncAdminFields();
  applyGameOverState();
}

function handleGuessSubmit(event) {
  event.preventDefault();
  if (livesRemaining <= 0) {
    applyGameOverState();
    return;
  }
  const result = applyGuess(state, guessInput.value);

  if (result.status === "hit") {
    setFeedback(result.message, "success");
  } else if (result.status === "duplicate") {
    setFeedback(result.message, "warning");
  } else if (result.status === "empty") {
    setFeedback(result.message, "warning");
  } else {
    livesRemaining = Math.max(0, livesRemaining - 1);
    saveLives();
    setFeedback(result.message, "miss");
  }

  guessInput.value = "";
  renderList();
  renderStats();
  renderWordbank();
  applyGameOverState();

  if (remainingCount(state) === 0) {
    setFeedback("You found all 10! Try another category.", "success");
  }
}

function handleRevealAll() {
  revealAll(state);
  renderList();
  renderStats();
  setFeedback("All answers revealed. Want a new category?", "warning");
}

function handleNewCategory() {
  startNewGame();
}

function openAdminModal() {
  adminModal.classList.remove("hidden");
  adminLoginView.classList.remove("hidden");
  adminPanelView.classList.add("hidden");
  adminUsername.value = "";
  adminPassword.value = "";
  adminLoginFeedback.textContent = "";
  adminUpdateFeedback.textContent = "";
}

function closeAdminModal() {
  adminModal.classList.add("hidden");
}

function handleAdminLogin(event) {
  event.preventDefault();
  const username = adminUsername.value.trim();
  const password = adminPassword.value.trim();

  if (username === "admin" && password === "password") {
    adminLoginView.classList.add("hidden");
    adminPanelView.classList.remove("hidden");
    adminLoginFeedback.textContent = "";
    syncAdminFields();
  } else {
    adminLoginFeedback.textContent = "Invalid credentials. Try admin/password.";
  }
}

function handleAdminUpdate(event) {
  event.preventDefault();
  const newPrompt = adminPromptInput.value.trim();
  const newSourceLabel = adminSourceLabelInput.value.trim();
  const newWordbank = parseWordbankInput();

  if (!newPrompt) {
    adminUpdateFeedback.textContent = "Prompt cannot be empty.";
    return;
  }

  if (!newSourceLabel) {
    adminUpdateFeedback.textContent = "Stats label cannot be empty.";
    return;
  }

  if (newWordbank.length === 0) {
    adminUpdateFeedback.textContent = "Wordbank cannot be empty.";
    return;
  }

  if (adminSelected.size !== 10) {
    adminUpdateFeedback.textContent = "Select exactly 10 correct answers.";
    return;
  }

  const selectedRanks = [...adminSelected].map((word) => adminRanks.get(word));
  if (selectedRanks.some((rank) => rank === undefined)) {
    adminUpdateFeedback.textContent = "Assign a rank (1-10) to each selected answer.";
    return;
  }

  const uniqueRanks = new Set(selectedRanks);
  if (uniqueRanks.size !== 10) {
    adminUpdateFeedback.textContent = "Each selected answer must have a unique rank.";
    return;
  }

  const selectedValues = [...adminSelected].map((word) => adminValues.get(word));
  if (selectedValues.some((value) => value === undefined || value.trim() === "")) {
    adminUpdateFeedback.textContent = "Enter a stat value for each selected answer.";
    return;
  }

  state.category.prompt = newPrompt;
  state.category.sourceLabel = newSourceLabel;
  state.category.wordbank = newWordbank;
  const selectedAnswers = newWordbank.filter((word) => adminSelected.has(word));
  state.category.answers = selectedAnswers
    .map((name) => ({
      name,
      rank: adminRanks.get(name),
      value: adminValues.get(name)
    }))
    .sort((a, b) => a.rank - b.rank)
    .map((answer) => ({ name: answer.name, value: answer.value }));
  adminOverrideCategory = {
    id: "admin-custom",
    prompt: state.category.prompt,
    sourceLabel: state.category.sourceLabel,
    wordbank: state.category.wordbank,
    answers: state.category.answers
  };
  saveAdminOverride(adminOverrideCategory);
  startNewGame(adminOverrideCategory);
  adminUpdateFeedback.textContent = "Category updated for this session.";
  setFeedback("Admin updated the category prompt, wordbank, and answers.", "success");
}

function handleClearSelections() {
  adminSelected = new Set();
  adminRanks = new Map();
  adminValues = new Map();
  renderAdminAnswerList(parseWordbankInput());
}

function handleSelectVisible() {
  const wordbank = parseWordbankInput();
  const visibleWords = getFilteredAdminWordbank(wordbank);
  let added = 0;
  visibleWords.forEach((word) => {
    if (adminSelected.size >= 10 || adminSelected.has(word)) {
      return;
    }
    adminSelected.add(word);
    const nextRank = getNextAvailableRank();
    if (nextRank) {
      adminRanks.set(word, nextRank);
    }
    added += 1;
  });
  if (added === 0 && adminSelected.size >= 10) {
    adminUpdateFeedback.textContent = "Already at 10 selected answers.";
  }
  renderAdminAnswerList(wordbank);
}

function handleClearVisible() {
  const wordbank = parseWordbankInput();
  const visibleWords = new Set(getFilteredAdminWordbank(wordbank));
  adminSelected = new Set([...adminSelected].filter((word) => !visibleWords.has(word)));
  adminRanks = new Map([...adminRanks.entries()].filter(([word]) => !visibleWords.has(word)));
  renderAdminAnswerList(wordbank);
}

function handleAutoFillRanks() {
  const wordbank = parseWordbankInput();
  const selectedWords = wordbank.filter((word) => adminSelected.has(word));
  adminRanks = new Map(selectedWords.slice(0, 10).map((word, index) => [word, index + 1]));
  renderAdminAnswerList(wordbank);
}

function handleAdminReset() {
  livesRemaining = 5;
  saveLives();
  startNewGame(state.category);
  adminUpdateFeedback.textContent = "Game reset and lives restored.";
}

guessForm.addEventListener("submit", handleGuessSubmit);
revealBtn.addEventListener("click", handleRevealAll);
newCategoryBtn.addEventListener("click", handleNewCategory);
guessInput.addEventListener("input", () => renderWordbank(guessInput.value));
adminOpenBtn.addEventListener("click", openAdminModal);
adminCloseBtn.addEventListener("click", closeAdminModal);
adminLoginForm.addEventListener("submit", handleAdminLogin);
adminUpdateForm.addEventListener("submit", handleAdminUpdate);
adminClearSelections.addEventListener("click", handleClearSelections);
adminResetGame.addEventListener("click", handleAdminReset);
adminSelectVisible.addEventListener("click", handleSelectVisible);
adminClearVisible.addEventListener("click", handleClearVisible);
adminAutoFillRanks.addEventListener("click", handleAutoFillRanks);
adminAnswerFilter.addEventListener("input", () => {
  adminAnswerFilterValue = adminAnswerFilter.value;
  renderAdminAnswerList(parseWordbankInput());
});
adminShowSelectedOnly.addEventListener("change", () => {
  renderAdminAnswerList(parseWordbankInput());
});
resultsCloseBtn.addEventListener("click", closeResultsModal);
shareResultsBtn.addEventListener("click", handleShareResults);
adminWordbankInput.addEventListener("input", () => {
  const updatedWordbank = parseWordbankInput();
  adminSelected = new Set([...adminSelected].filter((word) => updatedWordbank.includes(word)));
  adminRanks = new Map([...adminRanks.entries()].filter(([word]) => updatedWordbank.includes(word)));
  adminValues = new Map([...adminValues.entries()].filter(([word]) => updatedWordbank.includes(word)));
  renderAdminAnswerList(updatedWordbank);
});

adminOverrideCategory = loadAdminOverride();
livesRemaining = loadLives();
startNewGame(adminOverrideCategory ?? pickRandomCategory());
guessInput.focus();

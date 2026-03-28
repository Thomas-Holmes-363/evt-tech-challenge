export function normalizeGuess(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function createGameState(category) {
  const answers = [...category.answers]
    .sort((a, b) => b.value - a.value)
    .map((answer, index) => ({ ...answer, rank: index + 1 }));
  const normalizedMap = new Map(
    answers.map((answer, index) => [normalizeGuess(answer.name), { ...answer, rank: index + 1 }])
  );
  const wordbank = Array.from(
    new Set((category.wordbank && category.wordbank.length > 0 ? category.wordbank : answers.map((answer) => answer.name)).map((word) => word.trim()).filter(Boolean))
  );

  return {
    category,
    answers,
    wordbank,
    normalizedMap,
    found: new Set(),
    guesses: new Set(),
    guessCount: 0
  };
}

export function applyGuess(state, rawGuess) {
  const guess = normalizeGuess(rawGuess);
  if (!guess) {
    return { status: "empty", message: "Type a guess to continue." };
  }

  if (state.guesses.has(guess)) {
    return { status: "duplicate", message: "You already tried that guess." };
  }

  state.guesses.add(guess);
  state.guessCount += 1;

  const match = state.normalizedMap.get(guess);
  if (!match) {
    return { status: "miss", message: "Not in the top 10. Try again!" };
  }

  state.found.add(match.name);
  return {
    status: "hit",
    message: `Nice! ${match.name} is #${match.rank}.`,
    match
  };
}

export function revealAll(state) {
  state.found = new Set(state.answers.map((answer) => answer.name));
}

export function remainingCount(state) {
  return state.answers.length - state.found.size;
}

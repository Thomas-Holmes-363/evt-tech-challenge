import assert from "node:assert/strict";
import { categories } from "./src/data.js";
import { applyGuess, createGameState } from "./src/game.js";

const category = categories[0];
const state = createGameState(category);

assert.equal(state.answers.length, 10, "Category should include 10 answers.");
assert.ok(state.wordbank.length > 0, "Wordbank should be populated.");
assert.ok(state.wordbank.includes(category.answers[0].name), "Wordbank should include answer options.");

const result = applyGuess(state, category.answers[0].name);
assert.equal(result.status, "hit", "Exact match should be a hit.");
assert.equal(state.found.size, 1, "State should track found answers.");

const duplicate = applyGuess(state, category.answers[0].name);
assert.equal(duplicate.status, "duplicate", "Duplicate guesses should be flagged.");

console.log("All tests passed.");

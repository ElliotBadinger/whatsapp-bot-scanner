const CONFUSABLE_MAP = new Map([
  // Cyrillic
  ["а", ["a"]],
  ["А", ["A"]],
  ["е", ["e"]],
  ["Е", ["E"]],
  ["о", ["o"]],
  ["О", ["O"]],
  ["р", ["p"]],
  ["Р", ["P"]],
  ["с", ["c"]],
  ["С", ["C"]],
  ["х", ["x"]],
  ["Х", ["X"]],
  ["у", ["y"]],
  ["У", ["Y"]],
  ["к", ["k"]],
  ["К", ["K"]],
  ["м", ["m"]],
  ["М", ["M"]],
  ["т", ["t"]],
  ["Т", ["T"]],
  ["в", ["b"]],
  ["В", ["B"]],
  ["н", ["h"]],
  ["Н", ["H"]],
  ["ѕ", ["s"]],
  ["Ѕ", ["S"]],
  ["і", ["i"]],
  ["І", ["I"]],
  ["ј", ["j"]],
  ["Ј", ["J"]],
  // Greek
  ["ο", ["o"]],
  ["Ο", ["O"]],
  ["α", ["a"]],
  ["Α", ["A"]],
  ["β", ["b"]],
  ["Β", ["B"]],
  ["ε", ["e"]],
  ["Ε", ["E"]],
  ["ι", ["i"]],
  ["Ι", ["I"]],
  ["κ", ["k"]],
  ["Κ", ["K"]],
  ["μ", ["m"]],
  ["Μ", ["M"]],
  ["ν", ["v"]],
  ["Ν", ["N"]],
  ["ρ", ["p"]],
  ["Ρ", ["P"]],
  ["τ", ["t"]],
  ["Τ", ["T"]],
  ["χ", ["x"]],
  ["Χ", ["X"]],
  ["υ", ["y"]],
  ["Υ", ["Y"]],
  ["η", ["n"]],
  ["Η", ["H"]],
]);

function getConfusableCharacters(char) {
  if (typeof char !== "string" || char.length === 0) {
    return [];
  }
  const entry = CONFUSABLE_MAP.get(char[0]);
  return entry ? [...entry] : [];
}

function hasConfusable(char) {
  if (typeof char !== "string" || char.length === 0) {
    return false;
  }
  return CONFUSABLE_MAP.has(char[0]);
}

module.exports = {
  getConfusableCharacters,
  hasConfusable,
};

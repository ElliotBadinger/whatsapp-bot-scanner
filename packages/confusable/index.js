const confusables = require('confusables.js');

function toStringValue(entry) {
  if (typeof entry === 'string') {
    return entry;
  }
  if (Array.isArray(entry)) {
    return entry.join('');
  }
  return '';
}

function getConfusableCharacters(char) {
  if (typeof char !== 'string' || char.length === 0) {
    return [];
  }
  try {
    const result = confusables.getConfusableCharacters(char[0]);
    if (!Array.isArray(result)) {
      return [];
    }
    return result.map(toStringValue).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function hasConfusable(char) {
  if (typeof char !== 'string' || char.length === 0) {
    return false;
  }
  try {
    confusables.getConfusableCharacters(char[0]);
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  getConfusableCharacters,
  hasConfusable,
};

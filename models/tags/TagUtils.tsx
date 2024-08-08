const tagRegex = new RegExp('^([a-zäöüß]+)$');

export function updateTags(localTags: string[], setTagValidation: (validation: string | null) => void): string[] {
  const newTags = localTags.map((tag) => tag.trim());
  newTags.forEach((tag) => {
    validateTag(tag, setTagValidation);
  });
  return newTags;
}

export function validateTag(tag: string, setTagValidation: (validation: string | null) => void) {
  const valid = tagRegex.test(tag);
  if (!valid) {
    setTagValidation('Tag darf nur Kleinbuchstaben haben und keine Leerzeichen (z.B. "sour")');
  } else {
    setTagValidation(null);
  }
  return valid;
}

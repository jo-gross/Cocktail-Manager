const tagRegex = new RegExp('^([a-zäöüß0-9]+)$');

export function updateTags(localTags: string[], setTagValidation: (validation: string | null) => void): string[] {
  const newTags = localTags.map((tag) => tag.trim().toLowerCase());
  newTags.forEach((tag) => {
    validateTag(tag, setTagValidation);
  });
  return newTags;
}

export function validateTag(tag: string, setTagValidation: (validation: string | null) => void) {
  const valid = tagRegex.test(tag.toLowerCase());
  if (!valid) {
    setTagValidation('Der Tag darf nur Kleinbuchstaben, keine Leerzeichen und keine Sonderzeichen enthalten (z.B. "sour")');
  } else {
    setTagValidation(null);
  }
  return valid;
}

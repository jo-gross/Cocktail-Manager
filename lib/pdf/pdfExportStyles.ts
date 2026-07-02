export const pdfExportThemeStyles = `
:root {
  --cm-base-100: #faf8f5;
  --cm-base-200: #f0ebe3;
  --cm-base-300: #e4dcd0;
  --cm-base-content: #291334;
  --cm-primary: #8d0801;
  --cm-primary-content: #ffffff;
  --cm-secondary: #708d81;
  --cm-secondary-content: #ffffff;
  --cm-accent: #d97706;
  --cm-accent-content: #ffffff;
  --cm-neutral: #44403c;
  --cm-neutral-content: #faf8f5;
  --cm-info: #0284c7;
  --cm-info-content: #ffffff;
  --cm-success: #65a30d;
  --cm-success-content: #ffffff;
  --cm-warning: #ca8a04;
  --cm-warning-content: #ffffff;
  --cm-error: #b60000;
  --cm-error-content: #ffffff;
  --radius-field: 0.5rem;
}

.long-text-format {
  white-space: pre-line;
  text-wrap: pretty;
  overflow-wrap: normal;
  text-align: justify;
}
`;

export const pdfExportTailwindConfigScript = `
tailwind.config = {
  theme: {
    extend: {
      colors: {
        'base-100': '#faf8f5',
        'base-200': '#f0ebe3',
        'base-300': '#e4dcd0',
        'base-content': '#291334',
        primary: '#8d0801',
        'primary-content': '#ffffff',
        secondary: '#708d81',
        'secondary-content': '#ffffff',
        accent: '#d97706',
        'accent-content': '#ffffff',
        neutral: '#44403c',
        'neutral-content': '#faf8f5',
        info: '#0284c7',
        'info-content': '#ffffff',
        success: '#65a30d',
        'success-content': '#ffffff',
        warning: '#ca8a04',
        'warning-content': '#ffffff',
        error: '#b60000',
        'error-content': '#ffffff',
      },
      borderRadius: {
        field: '0.5rem',
        box: '1rem',
      },
    },
  },
};
`;

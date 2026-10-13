// הפיכת שם למזהה לכתובת.

// הופך טקסט למזהה: "Nimbus Digital" נהיה "nimbus-digital".
export function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

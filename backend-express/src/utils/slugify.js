// תפקיד הקובץ: הופך שם למזהה לכתובת (אותיות קטנות ומקפים).
// משתמשים בו: auth.service.js

// "Nimbus Digital!" -> "nimbus-digital"
// הופך טקסט למזהה: "Nimbus Digital" נהיה "nimbus-digital".
// נקרא מ: auth.service.js
export function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

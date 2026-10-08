# FlowBoard – צד הלקוח

אפליקציית ה-React של FlowBoard (JavaScript, Vite, MUI, TanStack Query). היא מדברת עם שרת
ה-Express שבתיקייה `../backend-express` דרך REST (הכתובת ב-`VITE_API_URL`, ברירת מחדל
`http://localhost:3000/api`), ומקבלת התראות בזמן אמת דרך Socket.IO.

```bash
npm install
npm run dev          # http://localhost:5173
npm run lint         # בדיקת איכות קוד
npm test             # בדיקות יחידה (Vitest)
npm run test:e2e     # Playwright – מפעיל שרת ומסד נתונים משלו (flowboard_e2e)
npm run build        # בנייה לגרסת הפצה
```

## מבנה התיקיות

| תיקייה | מה יש בה |
| --- | --- |
| `src/api` | הקריאות לשרת (HTTP), צירוף האסימון לכל בקשה וחידוש שלו |
| `src/lib` | hooks לשליפת נתונים (TanStack Query), בדיקת הרשאות, חיבור Socket.IO |
| `src/auth` | המשתמש המחובר (session) ומסכי ההתחברות וההרשמה |
| `src/features/*` | המסכים – תיקייה לכל אזור (פרויקטים, לוח, משימות, ניהול ועוד) |
| `src/components` | רכיבים משותפים שחוזרים בהרבה מסכים |
| `src/layout` | המסגרת הקבועה: תפריט הצד, הסרגל העליון והניווט |

**מצב הדגמה:** כש-`VITE_DEMO_MODE=true` (בקובץ `.env.development`), מסך ההתחברות מציג את
חשבונות הדמו להתחברות בלחיצה. בגרסת הפצה הם לא נכללים.

להרצת הפרויקט כולו – ראו את ה-[README הראשי](../README.md).

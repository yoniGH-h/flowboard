# FlowBoard API — Node.js + Express

ה-REST API של FlowBoard, כתוב ב-**Node.js + Express** (JavaScript, בלי שלב בנייה), עם
**Prisma** לעבודה מול PostgreSQL ו-**Socket.IO** להתראות בזמן אמת. אפליקציית ה-React שבתיקייה
`../frontend` מדברת איתו דרך REST (`/api/*`) ודרך Socket.IO.

## הרצה

הדרך הקלה (מתוך התיקייה `flowboard` – מפעיל את PostgreSQL, את השרת ואת האתר):

```powershell
.\start-dev.ps1          # עם -Seed: טעינה מחדש של נתוני הדמו
.\stop-dev.ps1
```

הרצה ידנית:

```bash
cd backend-express
cp .env.example .env
npm install                 # מריץ גם prisma generate
npm run prisma:migrate      # יצירת הטבלאות במסד flowboard_express
npm run prisma:seed         # נתוני דמו (מוחק את הנתונים הקיימים!)
npm start                   # http://localhost:3000/api   (npm run dev = הפעלה מחדש בכל שינוי)

cd ../frontend
npm run dev                 # אפליקציית ה-React, מחוברת לשרת הזה
```

התחברות לדמו: `daniel.cho@nimbusdigital.io` / `password123` (לכל משתמשי הדמו אותה סיסמה).

## מבנה התיקיות

```
backend-express/
  prisma/
    schema.prisma        מבנה מסד הנתונים
    migrations/          קובצי SQL שבונים את המסד (prisma migrate deploy)
    seed.js              נתוני דמו
  test/                  בדיקות הרשאות ומרכז ההחלטות מול שרת פועל
  src/
    server.js            נקודת הכניסה: שרת HTTP + Socket.IO + משימות רקע
                         (סריקת אוטומציה כל 15 דקות, שמירת ציון סיכון כל שעה)
    app.js               אפליקציית Express: middleware גלובלי וכל נתיבי /api
    config.js            ההגדרות מקובץ .env
    db.js                ה-Prisma client המשותף
    middleware/
      auth.js            requireAuth (בדיקת JWT), requirePermission, requireRole
      errorHandler.js    כל שגיאה ← { statusCode, path, timestamp, message }
    permissions/
      catalog.js         כל ההרשאות, ברירת המחדל לכל תפקיד וההיקף של כל הרשאה
      effective.js       חישוב ההרשאות בפועל (3 שכבות)
    realtime/socket.js   Socket.IO: אימות חיבורים, emitToUser()
    utils/               שגיאות HTTP, בדיקת קלט עם zod, רמות תפקידים, slugify
    modules/             תיקייה לכל נושא
      auth/              הרשמה, הצטרפות, התחברות, רענון אסימונים, איפוס סיסמה
      users/             פרופיל, ניהול משתמשים בארגון
      organizations/     הגדרות ארגון; רשימת ארגונים והשעיה למנהל מערכת
      roles/  labels/    רשימות לקריאה בלבד
      projects/          פרויקטים, חברי צוות, לוח ועמודות, risk.js (ציון הסיכון)
      tasks/             משימות, הזזה בלוח (WIP), תלויות, tasks.reports.js (דשבורדים)
      comments/  attachments/  notifications/  audit-log/
      automation-rules/  מנוע "כאשר X – בצע Y"
      permissions/       עריכת מטריצת ההרשאות וחריגים לעובד
      insights/          תובנות ומסקנות
      planning/          מרכז ההחלטות: מודל, סימולציה, המלצות, יומן
      meetings/          שיחות קוליות / Zoom
```

בכל מודול יש קובץ `*.routes.js` (כתובות, בדיקת קלט והרשאה), ובמודולים הגדולים גם קובץ
`*.service.js` (הלוגיקה העסקית והשאילתות למסד הנתונים).

## איך בקשה עוברת במערכת

לדוגמה, `PATCH /api/tasks/:id/move` (הזזת משימה בלוח):

1. **`app.js`** – middleware גלובלי: כותרות אבטחה (helmet), CORS, קריאת גוף ה-JSON והגבלת קצב.
2. **`requireAuth`** – בודק את אסימון ה-JWT שבכותרת `Authorization: Bearer <token>`, מוודא
   שהמשתמש עדיין פעיל, ושם ב-`req.user` את `{ userId, organizationId, email, roles, permissions }`.
3. **`tasks.routes.js`** – בודק את גוף הבקשה עם zod.
4. **`tasks.service.js` – `move()`** – בודק גישה לארגון ולפרויקט, שעובד מזיז רק משימה שלו,
   את מגבלת ה-WIP של העמודה (שגיאה 409) ומשימות חוסמות; אחר כך מעדכן את המשימה, רושם
   היסטוריה ויומן ביקורת, שולח התראה לאחראי ומריץ את חוקי האוטומציה.
5. כל `throw notFound(...)` או `conflict(...)` בדרך הופך לתשובת שגיאה ב-JSON בעזרת
   `errorHandler.js` (Express 5 מעביר אוטומטית שגיאות מפונקציות async).

## הרשאות: ברירת מחדל לתפקיד + שינויי הארגון + חריגים אישיים

כל בדיקה נעשית לפי מפתח הרשאה (`tasks.manage`, `audit.view` וכו'), ולא לפי תפקיד. מה שמשתמש
רשאי לעשות מחושב בכל בקשה בשלוש שכבות (`src/permissions/effective.js`):

```
ההרשאות בפועל = ברירת המחדל של התפקידים של המשתמש        (src/permissions/catalog.js)
              + השינויים של הארגון בתפקידים האלה         (OrganizationRolePermission)
              + חריגים אישיים: הוספה / שלילה, עם תוקף אופציונלי
                                                         (UserPermissionOverride)
```

- **הקטלוג** (`catalog.js`): כל הרשאה, ברירת המחדל שלה לכל תפקיד, וה**היקף** שלה –
  `organization` (כל הארגון), `member-project` (פרויקטים שהמשתמש חבר בהם), `managed-project`
  (רק פרויקטים שהוא מנהל), או `system` (פלטפורמה, אי אפשר לשנות).
- **אכיפה**: `requirePermission('audit.view')` בנתיבים להרשאות ברמת הארגון;
  `assertProjectPermission(actor, projectId, 'tasks.manage')` בשירותים להרשאות ברמת פרויקט –
  כך הרשאה אף פעם לא עוקפת את הבעלות על הפרויקט.
- **עריכה** (`/api/permissions/*`, דורש `permissions.manage`): מטריצת התפקידים וההרשאות, וחריגים
  לעובד מתוך ניהול משתמשים ← Permissions. הגנות: אי אפשר לשנות הרשאות פלטפורמה; אפשר לתת רק
  הרשאה שיש לך; אי אפשר לשנות לעצמך או למי שבתפקיד גבוה ממך; אי אפשר להסיר ממנהלי הארגון את
  `users.manage` / `permissions.manage` (כדי שאף אחד לא יינעל בחוץ); הרשאות ניהול פרויקט רק
  למנהלי פרויקטים; כל שינוי נרשם ביומן הביקורת.
- כל פרויקט בתשובה של השרת כולל `can` (עדכון, ניהול משימות, יצירת משימות, תגובה, העלאה...),
  ו-`/users/me` כולל `permissions` – כך האתר מציג רק מה שמותר.
- `npm run test:permissions` מריץ 34 בדיקות מול שרת פועל עם נתוני דמו טריים.

## מי שולט באיזה פרויקט

| תפקיד | שולט ב- |
| --- | --- |
| מנהל ארגון / מנהל מערכת | כל הפרויקטים בארגון |
| מנהל פרויקט | רק בפרויקטים שהוא מנהל (`project.managerId`, או חבר צוות עם `roleOnProject = MANAGER`) |
| מנהל פרויקט בפרויקט של מישהו אחר | כמו עובד: רואה אותו רק אם הוא חבר בו, ומזיז רק את המשימות שלו |

- הכלל נמצא במקום אחד: `managesProject()` / `managedProjectsWhere()` בקובץ
  `modules/projects/projects.service.js`. כל פעולה ניהולית עוברת דרך
  `assertAccessible(actor, projectId, { requireManager: true })`.
- מנהל פרויקט יוצר פרויקט רק כשהוא עצמו המנהל. מינוי מנהל אחר או מנהל-שותף (חבר צוות
  `MANAGER`) שמור למנהלי ארגון.
- הדשבורד הניהולי, עומס הצוות והדוחות מכסים רק את הפרויקטים שהמשתמש מנהל.
- כל פרויקט בתשובה כולל `canManage`, והאתר משתמש בו כדי להציג או להסתיר פעולות ניהול (השרת
  אוכף את הכלל בכל מקרה).

## תובנות (דוחות ותובנות ← "Key conclusions")

`GET /api/insights?projectId=` (דורש `reports.view`, ומכסה רק פרויקטים שהמשתמש מנהל) הופך
נתונים ש-FlowBoard כבר אוספת למסקנות שמנהל יכול לפעול לפיהן
(`modules/insights/insights.service.js`):

| תובנה | מחושבת מתוך | דוגמה למסקנה |
| --- | --- | --- |
| צפי סיום | משימות פתוחות ÷ משימות שהושלמו ב-4 השבועות האחרונים | "Atlas יסתיים בערך ב-23 בנובמבר – 26 ימים אחרי היעד." (לא מוצג תאריך כשהושלמו פחות מ-3 משימות) |
| דיוק הערכות | `actualHours` מול `estimatedHours` של משימות שהושלמו | "הצוות מעריך בחסר: משימות לוקחות 30% יותר מההערכה." |
| איפה העבודה ממתינה | `TaskStatusChange` – כל עמודה שמשימה נכנסה אליה, ומתי | "העבודה ממתינה הכי הרבה ב-In Review: 7.4 ימים בממוצע." + המשימות שתקועות הכי הרבה זמן |
| מגמת סיכון | `ProjectRiskSnapshot` – ציון סיכון אחד לכל פרויקט לכל יום, נשמר כל שעה ב-`server.js` | "הסיכון של Nimbus Mobile Revamp עלה מ-30 ל-52 בשבועיים." |

`GET /api/projects/:id/risk-history?days=30` מזין את גרף הסיכון בדף הפרויקט. נתוני הדמו בונים
היסטוריה של 30 יום על ידי הרצת התאריכים של משימות הדמו דרך אותה נוסחת סיכון.

## מרכז ההחלטות (Management ← Decision Center)

סוגר את המעגל מתובנה לפעולה: **זיהוי ← המלצה ← סימולציה ← ביצוע ← מדידה**. הכל רץ על מודל
אחד, קטן ושקוף (`modules/planning/model.js`), שהופך את מצב הפרויקט לצפי סיום, לציון סיכון
ולעומס של כל אחד, ומחיל שינויי "מה אם" על עותק של המצב.

| חלק | כתובת | מה הוא עושה |
| --- | --- | --- |
| סימולטור "מה אם" | `POST /api/planning/projects/:id/simulate` | בודק שינויים – העברת משימות, דחיית משימות, הוספת אנשים, הסרת חסימות, הזזת תאריך היעד – **בלי לשמור כלום**, ומחזיר לפני / אחרי (צפי, ימי איחור, הסיכון וכל אחד מגורמיו, עומס) ואת ההנחות שבחישוב. |
| המלצות | `GET /api/planning/projects/:id/recommendations` | כללים שאפשר להסביר: *איזון עומס* – העברת משימה תקועה או משימה של עובד עמוס לחבר צוות פנוי בבירור; *דחייה* – משימות בעדיפות נמוכה שלא התחילו, כשהפרויקט באיחור; *הוספה* – עובד פנוי, כשהפרויקט באיחור. כל המלצה עוברת סימולציה, ונשארת רק אם היא משפרת משהו. |
| ביצוע | `POST /api/planning/projects/:id/decisions` | מבצע את השינויים דרך השירותים הרגילים של משימות ופרויקטים (אותן בדיקות הרשאה, התראות ורישום ביומן כמו בביצוע ידני), ושומר `Decision` עם הסיכון והצפי באותו רגע ומה שהמודל חזה. |
| יומן החלטות | `GET /api/planning/decisions` | כל החלטה עם *אז ← נחזה ← עכשיו* לסיכון ולימי האיחור – האם היא באמת עזרה? |

היקף: דורש `reports.view`, וגם `tasks.manage` בפרויקט (כך מנהל פרויקט מתכנן רק את הפרויקטים
שלו); בביצוע נבדקות גם `members.manage` / `projects.update` כשצריך. `npm run test:planning`
בודק את כל התהליך מול שרת פועל עם נתוני דמו טריים.

## שיחות קוליות / Zoom

`POST /api/meetings` `{ inviteeId, mode: 'voice' | 'video', projectId?, taskId? }` יוצר פגישת Zoom
מיידית (`voice` = מצלמות כבויות). המתקשר מקבל `startUrl` ונכנס כמארח; הנמען מקבל בזמן אמת
התראה מסוג `MEETING_INVITE` עם כפתור "Join call".

הגדרה: באתר https://marketplace.zoom.us יוצרים אפליקציה מסוג **Server-to-Server OAuth** עם
ההרשאה `meeting:write`, מפעילים אותה, וממלאים בקובץ `.env` את `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`
ו-`ZOOM_CLIENT_SECRET`. עד אז השרת מחזיר 503 עם הסבר, והכפתורים מציגים את ההודעה הזו.

## הערות

- מסד הנתונים: `flowboard_express` ב-PostgreSQL המקומי (פורט 5433).
- קבצים מצורפים נשמרים בדיסק המקומי בתיקייה `uploads/`.
- אין דף Swagger – כל כתובת מוגדרת בקובץ `*.routes.js` של המודול שלה.

# ASU–Newport Culinary Arts Companion App

Companion web application for the **Arkansas State University – Newport Culinary Department**, customized for **Chef Joseph Jones**.

---

## 🍳 Included Courses
1. **Culinary 2: Cooking Techniques** (`/culinary2/`)
   - Daily lessons, station mise en place, knife skills, grilling, roasting, sautéing, braising, poaching, mother sauces, critique guidelines, recipes, tools, and study cards.
2. **Foundations of Baking & Pastry** (`/baking/`)
   - Scaling drill, baker's math & percentages calculator, hydration, doughs, custards, laminated doughs, cakes, and study cards.
3. **Bar and Beverage** (`/bar/`)
   - Alcohol-free beverage specs, syrups, bar equipment, glassware, wine/beer service, inventory, and study cards.
4. **Master Weekly Schedule & PDF Generator** (`/schedule.html`)
   - Unified weekly schedule with an instant printable/PDF exporter ready for the kitchen noticeboard.

---

## ⚙️ Instructor Admin Panel & Canvas Importer

The app includes an **Instructor Admin Panel** built directly into the header bar.

### Accessing Admin:
- Click the **`Admin`** button in the top navigation bar of `index.html`.
- Or press the keyboard shortcut **`Shift + A`**.

### Features:
1. **Course & Instructor Settings**:
   - Update Instructor Name, School, Department, Course Title, Room number, Meeting Times, Term dates, Textbooks, and Grading weights.
2. **Canvas LMS Importer**:
   - **Canvas Course Export (`.imscc` / `.zip`)**: Upload an export file from Canvas (*Settings > Export Course Content > Course*). The app automatically extracts the course syllabus, module weeks, assignments, rubrics, and dates using client-side unzipping.
   - **Canvas Calendar Feed (`.ics`)**: Upload an exported Canvas Calendar iCal file (*Canvas Calendar > Calendar Feed*). The app extracts all class sessions, dates, lab tasks, and recipe names.
   - **Canvas CSV / Spreadsheets**: Import assignment schedules and syllabus spreadsheets.
   - **Live Preview & Merge**: Preview detected class sessions and choose to either merge into the current schedule or replace it cleanly.
3. **Sessions & Daily Labs Editor**:
   - Add, edit, or delete any class session, lecture notes, lab tasks, or recipe assignments.
4. **Lab Recipes Editor**:
   - Search, add, and modify ingredients and methods for any recipe in the courses.
5. **Export & Publishing**:
   - **Live Browser Persistence**: Changes save immediately to `localStorage` and refresh the live course view instantly.
   - **Download `data.js`**: Export the updated data file to drop directly into `culinary2/data.js`, `baking/data.js`, or `bar/data.js`.
   - **Download `schedule-data.js`**: Automatically compiles all sessions across courses for the weekly schedule and printable PDF noticeboard.
   - **Complete App Backup**: Export and restore your complete setup in a single `.json` file.

---

## 🚀 Running the App Locally

Because this application is built with standard web technologies (HTML5, CSS3, modern Vanilla JavaScript), no build tools or package managers are required.

To run locally:
```bash
# In the project directory:
python3 -m http.server 8080
```
Then open:
[http://localhost:8080](http://localhost:8080)

---

## 🌐 Free Hosting Options for Students

To host this for your students at ASU–Newport with zero hosting costs:
- **GitHub Pages**: Push this Git repository to GitHub and enable GitHub Pages in repository settings.
- **Vercel / Netlify / Cloudflare Pages**: Connect the repository for instant, automated free deployments.

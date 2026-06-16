# AquaSense — Technical Architecture & Specifications

This document defines the complete system architecture, file structure, styling system, states, interactive components, and API integration contract of the **AquaSense** application. 

---

## 1. System Overview & Technology Stack
AquaSense is a client-side Single Page Application (SPA) with a secure serverless backend proxy, designed to analyze household water footprints and suggest a 7-day conservation checklist.

- **Frontend**: Standard semantic HTML5, Vanilla CSS3 (custom variables), and Modern vanilla ES6 JavaScript.
- **Backend/Hosting**: Deployed on Vercel. Requests are securely proxied via a Node.js Serverless API Route.
- **Branding/Aesthetics**: Organic, minimalist editorial layout. Warm ivory canvas background, deep forest-green typography and branding accents, champagne gold details, and soft sage highlights.
- **Typography**:
  - Headings: `Fraunces` (warm, high-contrast serif).
  - Body Text: `Plus Jakarta Sans` (geometric, highly readable sans-serif).
  - Monospace (Stats, Codes, Badges): `Fira Code`.

---

## 2. File Directory Structure
The repository consists of four core files:
```text
/
├── api/
│   └── gemini.js     # Vercel Serverless Function (Node.js API Route)
├── index.html        # Main HTML Markup & DOM Layout
├── style.css         # Styling System (Variables, Components, Themes)
└── app.js            # Frontend State, Interactive Logic, & API Connector
```

---

## 3. UI Views & Layout Structure
`index.html` divides the application into three main display views controlled by CSS `display: block/none` states:

1. **Hero Section (`#hero`)**: Introduces AquaSense, displays target statistics (BIS 135L standard, SDG 6.4 targets), and has a call-to-action button (`#startFootprintBtn`).
2. **Calculator Section (`#calculator-section`)**:
   - Houses the **Wizard Card (`#calculator-card`)** which contains:
     - Progress Bar (`#wizardProgressBar`)
     - Step Indicator (`#wizardStepIndicator`)
     - Form wizard step panels (`.wizard-step` 1 to 5)
     - Wizard control buttons (`#prevBtn`, `#nextBtn`)
   - Houses the **Loader Panel (`#loaderPanel`)**: Shown during API execution. Contains a custom Glass Beaker (Flask) SVG and a carousel (`#factCarousel`) showing water-saving facts.
3. **Results Dashboard (`#resultsSection`)**: Displayed after calculation. Organised in a **Bento Grid (`.bento-grid`)** containing:
   - **Risk Score Card**: Holds a circular SVG progress gauge (`#gaugeFill`), numeric score (`#scoreVal`), risk badge (`#riskBadge`), and text explanation (`#scoreExplanation`).
   - **Savings Card**: Displays water savings in liters (`#litersSavedVal`) and monetary savings in INR (`#inrSavedVal`).
   - **Action Plan Card**: Hosts the interactive 7-Day Checklist timeline (`#timelineContainer`).
   - **Action Tips Card**: Holds the list of 5 personalized recommendations (`#tipsListContainer`).
   - **Recalculate Button (`#recalculateBtn`)**: Swaps panels back to wizard mode.

---

## 4. Application State & Storage Contracts
`app.js` maintains the following runtime variables:

- `currentStep` (Integer, 1 to 5): Tracks the active form card step.
- `totalSteps` (Integer, 5): Total steps in the calculator.
- `activeTimelineChecklist` (Array of 7 Booleans): Tracks checkbox checked states (`true`/`false`) for the 7-day action checklist.
- `cachedResponseData` (Object): Caches parsed JSON data returned by the Gemini API.

### LocalStorage Mappings:
- `aquasense_last_result`: Caches the full JSON analysis response.
- `aquasense_checklist`: Caches the `activeTimelineChecklist` boolean array.
- `gemini_api_key`: (Local Dev only) Optional local API key fallback.

---

## 5. Form Wizard Elements & Input Bindings
The 5 steps collect inputs that are mapped to API payload fields:

### Step 1: Demographics
- Range slider input (`#household_count` [1-15]): Mapped to `householdCount`. Mapped value display indicator: `#householdVal`.
- Text input (`#location`): Mapped to `location` (e.g. Bangalore, Delhi).

### Step 2: Personal Habits
- Range slider input (`#shower_duration` [0-30]): Mapped to `showerDurationMinutesPerPerson`. Mapped value display: `#showerVal`.
- Choice button grid (`[data-name="tap_running"]`): YES/NO option that toggles a hidden input (`#tap_running`). Mapped to `tapsLeftRunningDuringBrushing`.

### Step 3: Appliances
- Range slider input (`#washing_machine` [0-15]): Mapped to `washingMachineUsesPerWeek`. Mapped value display: `#washingVal`.
- Choice button grid (`[data-name="dishwashing_method"]`): HAND/MACHINE option that toggles hidden input (`#dishwashing_method`). Mapped to `dishwashingMethod`.

### Step 4: Outdoors
- Choice button grid (`[data-name="garden_watering"]`): YES/NO option that toggles hidden input (`#garden_watering`). Mapped to `watersGarden`.
- Conditional input container (`#gardenTimeContainer`): active only if `garden_watering` is "yes". Number input (`#garden_minutes` [1-120]): Mapped to `gardenWateringMinutesPerDay`.
- Range slider input (`#car_washing` [0-7]): Mapped to `carWashTimesPerWeek`. Mapped value display: `#carVal`.

### Step 5: Billing & Storage
- Choice button grid (`[data-name="tank_overflow"]`): YES/NO option that toggles hidden input (`#tank_overflow`). Mapped to `waterTankOverflowAwareness`.
- Number input (`#monthly_bill`): Mapped to `monthlyWaterBillINR`.

---

## 6. CSS System & Variables
`style.css` defines the typography, animations, colors, and responsive layouts.

### Theme Variables (`:root`):
- `--color-primary` (`#1e352f`): Forest Green.
- `--color-secondary` (`#7c8d85`): Mineral Sage Green.
- `--color-accent` (`#c5a880`): Champagne Gold.
- `--color-background` (`#faf8f5`): Soothing Warm Ivory canvas.
- `--color-card-bg` (`#ffffff`): Card background.
- `--color-border` (`#e2e7e4`): Outline boundary lines.
- `--color-risk-low` (`#4a7c59`), `--color-risk-moderate` (`#d08c60`), `--color-risk-high` (`#b84a39`).

### Key Animation Rules:
- `.animate-float`: Simple `translateY(-6px)` float animation for hero title.
- `.brand-ripple`: Floating SVG ripples in headers.
- `.flask-water`: Handled in `app.js` by editing `d` attribute coordinates of `<path id="liquidRect">` to animate a rising fluid level up to `y=20` (from `y=120`).

---

## 7. API Integration & Serverless Proxy Contract
Calculations are processed via the Vercel Serverless Function `/api/gemini`.

### Client Side Fetch:
`app.js` POSTs the accumulated user data context:
```javascript
const userData = {
  location,
  householdCount,
  showerDurationMinutesPerPerson,
  tapsLeftRunningDuringBrushing,
  washingMachineUsesPerWeek,
  dishwashingMethod,
  watersGarden,
  gardenWateringMinutesPerDay,
  carWashTimesPerWeek,
  waterTankOverflowAwareness,
  monthlyWaterBillINR
};
```
Along with the `systemPrompt` (Grounding instructions on WHO standards, UN SDG 6, and BIS IS 1172 standards), sent to the serverless function handler.

### Serverless Proxy (`api/gemini.js`):
- Checks for the secure environment variable `process.env.GEMINI_API_KEY`.
- Forwards the request payload to the Gemini API endpoint:
  `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`
- Returns the generated content directly to the client.

### Expected JSON Schema Output:
Gemini is instructed to output a JSON object satisfying:
```json
{
  "type": "OBJECT",
  "properties": {
    "risk_level": { "type": "STRING", "enum": ["LOW", "MODERATE", "HIGH"] },
    "risk_score": { "type": "INTEGER" },
    "score_explanation": { "type": "STRING" },
    "tips": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "title": { "type": "STRING" },
          "description": { "type": "STRING" },
          "impact": { "type": "STRING" }
        },
        "required": ["title", "description", "impact"]
      }
    },
    "weekly_plan": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "day": { "type": "STRING" },
          "task": { "type": "STRING" }
        },
        "required": ["day", "task"]
      }
    },
    "estimated_daily_savings_liters": { "type": "INTEGER" },
    "estimated_monthly_bill_savings_inr": { "type": "INTEGER" }
  },
  "required": [
    "risk_level",
    "risk_score",
    "score_explanation",
    "tips",
    "weekly_plan",
    "estimated_daily_savings_liters",
    "estimated_monthly_bill_savings_inr"
  ]
}
```

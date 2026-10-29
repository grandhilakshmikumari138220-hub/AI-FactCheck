# AI FactCheck — Smart Information Verification Platform

A modern, responsive, and zero-dependency web application built for the **Introduction to Prompt Engineering (IPE)** college curriculum.

**AI FactCheck** equips students, educators, and researchers with tools to audit AI-generated content (from ChatGPT, Gemini, Claude, Llama, etc.), identify claims susceptible to hallucinations, learn how prompt constraints mitigate falsehoods, and conduct structured human-in-the-loop source verification.

---

## 🌟 Key Features

1. **Automated Claim Extraction Engine**:
   - Parses pasted AI text into individual sentences and assertions.
   - Identifies high-risk categories:
     - **Statistical & Numerical Claims**: Exact percentages, sample sizes, dollar values, and durations often fabricated by LLMs.
     - **Absolute & Hyperbolic Language**: Phrases like *"permanently cures"*, *"guaranteed zero risk"*, *"100% proven"*.
     - **Academic & Source Attributions**: References to universities, professors, patents, and journals.
     - **Causal Assertions**: Direct causal claims that conflate correlation with causation.
   - Assigns priority ratings (**High**, **Medium**, **Low**) and calculates an **Automated Risk Index**.

2. **Interactive Document Heatmap**:
   - Visual colored text markup synchronized with detailed claim cards.
   - Clicking any highlighted sentence jumps directly to its corresponding verification card.

3. **Prompt Engineering Lab (IPE Core Feature)**:
   - Side-by-side comparison of naive vs. prompt-engineered queries across multiple real-world domains (Medical/Health, Historical Events, Financial/Macroeconomics).
   - Explains how techniques like **Chain-of-Verification (CoVe)**, **Epistemic Modesty ("State when inconclusive")**, and **Constraint Enforcement** dramatically reduce model hallucinations.
   - Interactive **Student Prompt Sandbox** to score custom prompts on hallucination resistance.

4. **Source Verification Checklist (CRAAP & SIFT Framework)**:
   - Interactive verification rubric evaluating **Currency, Authority, Accuracy, and Purpose**.
   - Calculates a live **Evidence Credibility Score (0–100%)** as students audit each criterion.
   - Persisted across sessions via browser `localStorage`.

5. **Audit History & Report Export**:
   - Locally stored audit logs with one-click re-loading and snippet deletion.
   - Generates comprehensive markdown audit reports suitable for college assignments.
   - Supports markdown copy to clipboard, `.md` file download, and clean browser printing (`Ctrl+P` / `Cmd+P`).

6. **Responsible AI & Epistemic Ethics**:
   - Explicitly clarifies that heuristic linguistic analysis is an evaluation aid, not an authoritative real-world truth database.
   - Promotes human-in-the-loop research with pre-populated search queries to Google and academic registries.

---

## 📁 Project Structure

```text
ai-factcheck/
├── index.html        # Semantic HTML5 layout, accessible navigation, and modal dialogues
├── style.css         # Clean, responsive CSS with modern variables, grid/flex, and print styles
├── script.js         # Vanilla JavaScript parsing engine, state management, and toast notifications
├── vercel.json       # Zero-build static configuration for seamless Vercel deployment
└── README.md         # Documentation, usage guide, and deployment instructions
```

> **Zero Dependencies:** This application relies purely on native HTML, CSS, and vanilla JavaScript. It requires no npm installations, Node.js packages, or build compilation steps.

---

## 🚀 How to Run Locally

You can run this project locally using any of the following standard methods:

### Method 1: Direct File Opening
Double-click `index.html` or right-click and choose **Open With > Google Chrome / Firefox / Safari / Edge**.

### Method 2: VS Code Live Server
1. Open the project folder in **Visual Studio Code**.
2. Install the **Live Server** extension (by Ritwick Dey).
3. Right-click `index.html` and click **"Open with Live Server"**.

### Method 3: Python Built-In HTTP Server
Open your terminal in the project directory and run:
```bash
# Python 3.x
python3 -m http.server 3000
```
Then navigate to `http://localhost:3000` in your browser.

### Method 4: Node `npx serve` (Optional)
```bash
npx serve .
```

---

## ☁️ Step-by-Step Vercel Deployment Instructions

This project is pre-configured with a `vercel.json` file to ensure seamless, error-free deployment on Vercel without triggering build errors.

### Option A: Deploy via Vercel Web Dashboard (Recommended)

1. **Push your code to GitHub / GitLab / Bitbucket**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of AI FactCheck platform"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```

2. **Log into Vercel**:
   - Go to [vercel.com](https://vercel.com) and log in with your GitHub account.

3. **Import Project**:
   - Click **"Add New..."** > **"Project"**.
   - Select your `AI FactCheck` repository and click **"Import"**.

4. **Configure Project Settings (Zero Build)**:
   - **Framework Preset**: Select **"Other"**.
   - **Root Directory**: `./` (leave default).
   - **Build and Output Settings**:
     - *Build Command*: Leave toggled **OFF** or empty (no build needed).
     - *Output Directory*: Leave toggled **OFF** or empty (`.` root).
     - *Install Command*: Leave toggled **OFF** or empty (no `npm install`).
   
   *(Note: The included `vercel.json` automatically sets `buildCommand: null` and `outputDirectory: "."`, preventing Vercel from failing on npm scripts).*

5. **Deploy**:
   - Click **"Deploy"**.
   - In less than 10 seconds, Vercel will provide your live production URL (e.g., `https://ai-factcheck.vercel.app`).

---

### Option B: Deploy via Vercel CLI

If you have the Vercel CLI installed:

```bash
# 1. Install Vercel CLI globally (if not already installed)
npm install -g vercel

# 2. Login to your account
vercel login

# 3. Deploy to production from project root
vercel --prod
```

When prompted:
- Set up and deploy? **Y**
- Which scope? Select your personal account
- Link to existing project? **N**
- What's your project's name? `ai-factcheck`
- In which directory is your code located? `./`
- Want to modify these settings? **N**

Vercel will output your live URL immediately.

---

## 🎓 IPE Academic Context: Hallucination Mitigation Cheat Sheet

When presenting this project for your **Introduction to Prompt Engineering (IPE)** class, highlight these core takeaways:

| Failure Mode | Naive Prompt Pattern | Prompt Engineering Defense |
| :--- | :--- | :--- |
| **Sycophancy & Bias** | *"Tell me why X is 100% true and cite stats"* | Explicitly instruct the model to provide counter-arguments and acknowledge gaps in consensus. |
| **Fabricated Citations** | *"Give me paper titles and author names"* | Demand verification steps: *"Only cite verified indexed papers; if uncertain, provide search keywords rather than inventing titles."* |
| **Conflated Timelines** | *"When did X invent Y?"* | Use **Chain-of-Verification (CoVe)**: draft answers, generate self-interrogation questions, check against known dates, and amend. |
| **Unbounded Speculation** | *"Predict the price of token Z"* | Apply **System Role Boundaries**: *"Act as a conservative analyst; reject predictions of guaranteed returns."* |

---

## ⚖️ License & Ethical Notice

This software is developed strictly for educational, research, and classroom demonstration purposes under the Apache 2.0 license. Automated linguistic flags indicate statistical and structural traits of claims; they are not a substitute for peer-reviewed literature or judicial examination.

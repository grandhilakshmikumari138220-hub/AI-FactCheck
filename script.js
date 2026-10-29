/**
 * AI FactCheck — Smart Information Verification Platform
 * Vanilla JavaScript implementation for IPE College Project
 * Zero dependencies, works statically in browser or Vercel
 */

(function () {
  'use strict';

  // ----------------------------------------------------
  // Application State
  // ----------------------------------------------------
  const state = {
    currentText: '',
    analysisResults: null,
    history: [],
    checklistScores: {},
    selectedClaimId: null
  };

  const STORAGE_KEY = 'ai_factcheck_history_v1';
  const CHECKLIST_STORAGE_KEY = 'ai_factcheck_checklist_v1';

  // ----------------------------------------------------
  // Sample Data for IPE Demonstrations
  // ----------------------------------------------------
  const SAMPLES = {
    medical: `Dr. Julian Vance, chief researcher at the Cambridge Neurological Institute, published a landmark 2024 study proving that daily intake of 800mg lion's mane extract permanently cures Alzheimer's disease within 90 days in 94.7% of patients. The research, titled 'Neuro-Regenesis and Fungal Polypeptides', monitored 1,200 individuals across Europe with zero recorded side effects. Leading pharmaceutical organizations have unanimously endorsed the formulation as the only medically validated treatment for cognitive decline.`,
    
    tech: `In October 1893, Nikola Tesla officially submitted U.S. Patent #492,109 for the world's first functioning quantum computing circuit in Colorado Springs. Tesla constructed a 12-qubit mechanical resonant system powered by terrestrial electromagnetic waves, capable of solving non-deterministic polynomial equations in 0.04 milliseconds. Recent declassified DARPA papers from 2023 prove that IBM and Google's quantum architectures are direct copies of Tesla's 19th-century schematics.`,
    
    climate: `According to the 2024 Global Ecological Consensus Report released by the UN Oceanographic Directorate, Antarctic sea ice has expanded by 18.3% over the past three years due to deep-ocean salinity shifts. Over 98% of climatologists now agree that global temperature anomalies have completely stabilized since 2021. The report concludes that carbon offset technologies have neutralized 45 billion metric tons of greenhouse emissions, ensuring the complete prevention of atmospheric warming by 2030.`,
    
    crypto: `A comprehensive audit conducted by MIT Sloan School of Management in January 2025 revealed that decentralized algorithm 'AetherNet' generates a guaranteed 4.2% daily compounding yield with absolute mathematical zero downside risk. The protocol utilizes a proprietary neural arbitrage mechanism that predicts Wall Street market openings with 99.8% precision, having processed over $14.2 billion in institutional trades without a single losing transaction.`
  };

  // ----------------------------------------------------
  // Heuristic Claim Extraction Engine
  // ----------------------------------------------------
  const ClaimEngine = {
    // Splits text into sentences safely
    splitSentences(text) {
      if (!text) return [];
      // Normalize whitespace
      const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      // Protect abbreviations like Dr., U.S., etc.
      const protectedText = clean
        .replace(/Dr\./g, 'Dr<<DOT>>')
        .replace(/Mr\./g, 'Mr<<DOT>>')
        .replace(/Ms\./g, 'Ms<<DOT>>')
        .replace(/Prof\./g, 'Prof<<DOT>>')
        .replace(/U\.S\./g, 'US<<DOT>>')
        .replace(/e\.g\./g, 'eg<<DOT>>')
        .replace(/i\.e\./g, 'ie<<DOT>>')
        .replace(/(\d+)\.(\d+)/g, '$1<<DEC>>$2');

      const rawSentences = protectedText.match(/[^.!?]+[.!?]+/g) || [protectedText];

      return rawSentences.map((s, index) => {
        const restored = s
          .replace(/<<DOT>>/g, '.')
          .replace(/<<DEC>>/g, '.')
          .trim();
        return {
          id: `sentence-${index}`,
          index,
          text: restored
        };
      }).filter(s => s.text.length > 5);
    },

    // Evaluates a single sentence for fact-check flags
    evaluateSentence(sentence) {
      const text = sentence.text;
      const lower = text.toLowerCase();

      let priority = 'low';
      let claimType = 'Contextual Statement';
      let reasons = [];
      let keywords = [];

      // 1. Numerical & Statistical Claims
      const hasPercent = /\b\d+(\.\d+)?%\b/.test(text);
      const hasSpecificNumber = /\b(\$?\d+[\d,]*(\.\d+)?\s*(billion|million|thousand|individuals|patients|years|mg|days|metric tons)?)\b/i.test(text);
      
      if (hasPercent || hasSpecificNumber) {
        priority = 'high';
        claimType = 'Statistical / Quantitative Claim';
        reasons.push('Contains precise statistical or numerical figures. LLMs frequently invent statistics and sample sizes to provide pseudo-authoritative answers.');
        const matches = text.match(/\b\d+(\.\d+)?%|\b\$?\d[\d,.]*\b/g);
        if (matches) keywords.push(...matches.slice(0, 3));
      }

      // 2. Absolute & Hyperbolic Assertions
      const absoluteTerms = [
        'permanently cures', 'cures completely', '100%', 'zero recorded side effects',
        'zero downside risk', 'absolute', 'unanimously endorsed', 'the only', 'completely stabilized',
        'guaranteed', 'proven', 'proves', 'universally', 'impossible', 'always', 'never'
      ];
      
      const foundAbsolutes = absoluteTerms.filter(term => lower.includes(term));
      if (foundAbsolutes.length > 0) {
        priority = 'high';
        claimType = 'Absolute / Universal Assertion';
        reasons.push(`Uses definitive absolutist language ("${foundAbsolutes.join('", "')}"). Scientific and empirical consensus rarely speaks in absolutes; such terms often signify hallucination or bias.`);
        keywords.push(...foundAbsolutes);
      }

      // 3. Attribution & Citation Claims
      const attributionTerms = [
        'dr.', 'professor', 'study', 'published', 'researchers at', 'mit', 'cambridge',
        'institute', 'darpa', 'patent', 'report released by', 'un oceanographic', 'harvard', 'stanford'
      ];
      const foundAttribution = attributionTerms.filter(term => lower.includes(term));
      if (foundAttribution.length > 0) {
        if (priority !== 'high') priority = 'medium';
        if (claimType === 'Contextual Statement') claimType = 'Source Attribution Claim';
        reasons.push('Attributes findings to specific named researchers, institutions, or patents. AI models frequently fabricate academic titles, journal names, and patent numbers.');
        keywords.push(...foundAttribution);
      }

      // 4. Causal & Definitive Action
      const causalTerms = ['causes', 'caused by', 'leads inevitably', 'direct copies of', 'neutralized', 'resulted directly'];
      const foundCausal = causalTerms.filter(term => lower.includes(term));
      if (foundCausal.length > 0) {
        if (priority === 'low') priority = 'medium';
        if (claimType === 'Contextual Statement') claimType = 'Causal Relationship';
        reasons.push('Claims direct causality or definitive linkage between distinct events or mechanisms.');
        keywords.push(...foundCausal);
      }

      // If nothing triggered priority change but sentence looks like an assertion
      if (reasons.length === 0) {
        if (text.length > 30) {
          claimType = 'Descriptive Background';
          priority = 'low';
          reasons.push('General descriptive narrative. Poses lower factual risk, but context should still be cross-referenced.');
        } else {
          return null; // Skip non-substantive sentences
        }
      }

      // Build suggested Google verification search query
      const searchQuery = encodeURIComponent(
        text.replace(/["']/g, '')
          .split(' ')
          .slice(0, 8)
          .join(' ')
      );

      return {
        id: sentence.id,
        text: sentence.text,
        claimType,
        priority, // 'high', 'medium', 'low'
        reasons,
        keywords: Array.from(new Set(keywords)),
        searchUrl: `https://www.google.com/search?q=${searchQuery}`,
        status: 'Unchecked' // 'Unchecked', 'Verified', 'Debunked', 'Questionable'
      };
    },

    // Analyze entire document
    analyze(text) {
      const sentences = this.splitSentences(text);
      const claims = [];

      sentences.forEach(s => {
        const claim = this.evaluateSentence(s);
        if (claim) claims.push(claim);
      });

      const highRiskCount = claims.filter(c => c.priority === 'high').length;
      const mediumRiskCount = claims.filter(c => c.priority === 'medium').length;
      const lowRiskCount = claims.filter(c => c.priority === 'low').length;

      // Calculate automated Risk Index (0-100%)
      const totalSentences = Math.max(sentences.length, 1);
      const weightedScore = (highRiskCount * 3 + mediumRiskCount * 1.5) / (totalSentences * 3);
      const riskIndex = Math.min(Math.round(weightedScore * 100), 100);

      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const readingTimeSec = Math.ceil(words / 3.5);

      return {
        text,
        sentences,
        claims,
        metrics: {
          words,
          sentencesCount: sentences.length,
          totalClaims: claims.length,
          highRiskCount,
          mediumRiskCount,
          lowRiskCount,
          riskIndex,
          readingTimeSec
        },
        timestamp: new Date().toISOString()
      };
    }
  };

  // ----------------------------------------------------
  // Prompt Comparison Case Studies (IPE Project)
  // ----------------------------------------------------
  const PROMPT_CASE_STUDIES = [
    {
      id: 'medical-cancer',
      title: 'Health Research: Coffee and Cellular Longevity',
      description: 'Demonstrating how unconstrained prompts incentivize AI to fabricate curative claims and nonexistent clinical trials.',
      naive: {
        title: 'Naive / Open-Ended Prompt',
        tag: 'High Hallucination Vulnerability',
        pillClass: 'pill-poor',
        prompt: `Tell me how drinking coffee cures cellular damage and cite statistics from medical universities proving it extends lifespan by 15 years.`,
        output: `Drinking coffee completely reverses cellular aging! A 2023 Johns Hopkins study conducted on 4,500 adults demonstrated that 4 cups daily increases telomere length by 28.4%, extending human lifespan by exactly 15.2 years. Researchers concluded coffee is the single most potent neuroprotective cure discovered this decade.`,
        verdictClass: 'verdict-poor',
        verdict: `⚠️ <strong>Flaw Identified:</strong> The user prompt contains strong confirmation bias and implicitly demands specific fabricated numbers ("proving it extends lifespan by 15 years"). The AI complied by inventing fake percentages and false hospital endorsements.`
      },
      improved: {
        title: 'IPE Optimized: Grounded & Constrained Prompt',
        tag: 'Reliable & Hallucination-Resistant',
        pillClass: 'pill-good',
        prompt: `Provide an objective, evidence-based summary of scientific consensus regarding coffee consumption and cellular health.
Requirements:
1. Distinguish between observational correlation and clinical causation.
2. If citing statistics or studies, only reference established meta-analyses; do not fabricate numbers.
3. Explicitly state limitations, unknown variables, and potential health trade-offs.
4. If certainty is low, state "Evidence is inconclusive".`,
        output: `Scientific consensus indicates coffee contains polyphenols and antioxidants which may mitigate oxidative stress in cells. Observational cohort studies (such as the UK Biobank dataset) show modest associations between moderate intake (2-3 cups/day) and reduced all-cause mortality risk.
Limitations & Nuance:
• Causation is not established; lifestyle confounders exist.
• High caffeine intake poses risks for individuals with hypertension or sleep disturbances.
• Evidence regarding direct telomere restoration remains inconclusive.`,
        verdictClass: 'verdict-good',
        verdict: `✅ <strong>IPE Best Practice:</strong> Applying epistemic boundaries, demanding distinction between correlation vs causation, and explicitly authorizing uncertainty ("Evidence is inconclusive") drastically suppresses hallucinations.`
      }
    },
    {
      id: 'historical-event',
      title: 'Historical Fact Retrieval: Inventions & Patents',
      description: 'How Chain-of-Verification (CoVe) prompting eliminates conflated timeline errors and false historical attributions.',
      naive: {
        title: 'Zero-Shot Historical Query',
        tag: 'Prone to Timeline Conflation',
        pillClass: 'pill-poor',
        prompt: `Who invented wireless internet and when did they patent the first Wi-Fi router?`,
        output: `Nikola Tesla invented wireless internet in 1898 when he patented the radio-controlled boat and wireless router transmitter at Madison Square Garden. His router operated on a primitive 2.4 GHz frequency that laid the direct blueprint for modern 802.11 Wi-Fi.`,
        verdictClass: 'verdict-poor',
        verdict: `⚠️ <strong>Flaw Identified:</strong> The LLM conflated Tesla's 1898 radio patent with 1990s Wi-Fi protocol (invented by CSIRO / John O'Sullivan). Zero-shot queries lack self-correction checkpoints.`
      },
      improved: {
        title: 'IPE Optimized: Chain-of-Verification (CoVe)',
        tag: 'Self-Verified & Historically Accurate',
        pillClass: 'pill-cove',
        prompt: `Task: Identify the technological origins of Wi-Fi.
Execute using Chain-of-Verification:
Step 1: Draft initial answer of key contributors.
Step 2: Generate 3 independent fact-check questions:
  a. When was the term 'Wi-Fi' coined?
  b. What patent was awarded to Australia's CSIRO team led by Dr. John O'Sullivan?
  c. Did Nikola Tesla ever build or conceive microwave wireless computer networking?
Step 3: Answer fact-check questions truthfully based on verifiable history.
Step 4: Output synthesized final answer correcting any draft inaccuracies.`,
        output: `Final Verified Synthesis:
Wi-Fi technology stems primarily from research in the 1990s by Australian radio astronomers at CSIRO, spearheaded by Dr. John O'Sullivan, who patented multipath-resistant indoor radio signals in 1996 (US Patent 5,487,069).
Verification Corrections:
• Nikola Tesla pioneered radio frequency transmission in the 1890s, but did not invent digital wireless networking or routers.
• The IEEE 802.11 standard was first adopted in 1997; the commercial trademark 'Wi-Fi' was created by the Wireless Ethernet Compatibility Alliance in 1999.`,
        verdictClass: 'verdict-good',
        verdict: `✅ <strong>IPE Best Practice:</strong> Chain-of-Verification forces the language model to create and answer its own adversarial verification queries before finalizing the output, isolating hallucinated myths.`
      }
    },
    {
      id: 'financial-market',
      title: 'Economic Forecast & Investment Claims',
      description: 'Enforcing role constraints, disclaimers, and banning speculative certainty.',
      naive: {
        title: 'Unbounded Market Prediction',
        tag: 'Dangerous Speculation',
        pillClass: 'pill-poor',
        prompt: `Give me a crypto token that is 100% guaranteed to 10x before Q4 with no financial risk.`,
        output: `You should invest in SafeYield Token! Their automated neural network guarantees a 1,000% return by October 2026 due to locked institutional liquidity on Binance. It has zero market risk and backed by Stanford blockchain lab audits.`,
        verdictClass: 'verdict-poor',
        verdict: `⚠️ <strong>Flaw Identified:</strong> The LLM echoes the user's impossible premise ("100% guaranteed return with zero risk") and fabricates nonexistent institutional endorsements.`
      },
      improved: {
        title: 'IPE Optimized: Fiduciary Framing & Uncertainty Bounding',
        tag: 'Prudent & Grounded',
        pillClass: 'pill-good',
        prompt: `Act as a senior macroeconomic analyst.
Explain the theoretical relationship between high expected returns and capital risk in financial assets.
Rules:
1. Explicitly reject any claim of guaranteed risk-free returns.
2. Explain the Efficient Market Hypothesis and risk-return trade-off.
3. State why automated algorithmic trading cannot eliminate systematic volatility.`,
        output: `In financial economics, no asset class can provide guaranteed returns above the risk-free rate (e.g., short-term US Treasury bills) without bearing risk of capital loss.
Core Principles:
1. Risk-Return Trade-Off: High potential yields are mathematical compensation for commensurate volatility and default probability.
2. Systemic Volatility: Algorithmic or neural trading bots cannot eliminate systemic macroeconomic shocks or liquidity freezes.
Any claim of guaranteed high-yield multipliers represents deceptive marketing or structural unsustainability.`,
        verdictClass: 'verdict-good',
        verdict: `✅ <strong>IPE Best Practice:</strong> System role constraints and strict guardrail instructions prevent the model from roleplaying as a reckless predictor.`
      }
    }
  ];

  // ----------------------------------------------------
  // Source Verification Checklist Items (CRAAP / SIFT)
  // ----------------------------------------------------
  const CHECKLIST_DATA = [
    {
      category: 'Currency & Timeline Verification',
      items: [
        { id: 'curr-1', text: 'Publication Date Verification', desc: 'Is the referenced research or article dated within an appropriate recency window for this scientific or technical field?' },
        { id: 'curr-2', text: 'Post-Cutoff / Historical Drifts', desc: 'Does the claim describe ongoing world events that may have evolved or been superseded by recent real-world developments?' }
      ]
    },
    {
      category: 'Authority & Researcher Credibility',
      items: [
        { id: 'auth-1', text: 'Verifiable Authorship & Affiliation', desc: 'Can the named author, university department, or institute be confirmed via official institutional directories (.edu, .gov, or verified registry)?' },
        { id: 'auth-2', text: 'Peer-Reviewed Publication Presence', desc: 'Is the cited paper indexed in reputable scientific repositories (PubMed, IEEE Xplore, Google Scholar, arXiv, JSTOR)?' }
      ]
    },
    {
      category: 'Accuracy & Evidence Rigor',
      items: [
        { id: 'acc-1', text: 'Cross-Source Independent Corroboration', desc: 'Can this exact statistic or assertion be corroborated by at least two independent, unrelated journalistic or academic sources?' },
        { id: 'acc-2', text: 'Detection of Fabricated Specifics', desc: 'Do specific percentage values (e.g. 94.7%) and sample sizes align with original source data, rather than being rounded or created by the LLM?' },
        { id: 'acc-3', text: 'Absence of Causal Exaggeration', desc: 'Does the underlying study claim true causal efficacy, or was it merely an exploratory correlation or in-vitro animal study?' }
      ]
    },
    {
      category: 'Purpose & Epistemic Objectivity',
      items: [
        { id: 'purp-1', text: 'Commercial & Conflict of Interest Review', desc: 'Is the information free of hidden sponsorship, affiliate marketing, or commercial sales intent?' },
        { id: 'purp-2', text: 'Balanced Acknowledgment of Limitations', desc: 'Does the text openly disclose study constraints, sample boundaries, adverse reactions, or conflicting counter-theories?' }
      ]
    }
  ];

  // ----------------------------------------------------
  // DOM Elements
  // ----------------------------------------------------
  const elements = {
    // Nav
    navItems: document.querySelectorAll('.nav-item'),
    sections: document.querySelectorAll('.view-section'),
    mobileMenuBtn: document.getElementById('mobileMenuBtn'),
    sidebar: document.getElementById('sidebar'),
    pageTitle: document.getElementById('pageTitle'),

    // Input & Actions
    textInput: document.getElementById('textInput'),
    charCount: document.getElementById('charCount'),
    wordCount: document.getElementById('wordCount'),
    readTime: document.getElementById('readTime'),
    btnAnalyze: document.getElementById('btnAnalyze'),
    btnClear: document.getElementById('btnClear'),
    sampleChips: document.querySelectorAll('.sample-chip'),

    // Results Dashboard
    resultsContainer: document.getElementById('resultsContainer'),
    statTotalClaims: document.getElementById('statTotalClaims'),
    statHighRisk: document.getElementById('statHighRisk'),
    statMediumRisk: document.getElementById('statMediumRisk'),
    statRiskIndex: document.getElementById('statRiskIndex'),
    highlightedTextContainer: document.getElementById('highlightedTextContainer'),
    claimsListContainer: document.getElementById('claimsListContainer'),
    btnExportReport: document.getElementById('btnExportReport'),

    // Prompt Lab
    caseStudySelect: document.getElementById('caseStudySelect'),
    promptLabContainer: document.getElementById('promptLabContainer'),
    customPromptA: document.getElementById('customPromptA'),
    customPromptB: document.getElementById('customPromptB'),
    btnCompareCustom: document.getElementById('btnCompareCustom'),
    customCompareResult: document.getElementById('customCompareResult'),

    // Checklist
    checklistItemsContainer: document.getElementById('checklistItemsContainer'),
    checklistScorePercent: document.getElementById('checklistScorePercent'),
    checklistProgressFill: document.getElementById('checklistProgressFill'),
    btnResetChecklist: document.getElementById('btnResetChecklist'),

    // History
    historyList: document.getElementById('historyList'),
    btnClearHistory: document.getElementById('btnClearHistory'),

    // Modal
    reportModal: document.getElementById('reportModal'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalDoneBtn: document.getElementById('modalDoneBtn'),
    btnCopyReport: document.getElementById('btnCopyReport'),
    btnDownloadReport: document.getElementById('btnDownloadReport'),
    btnPrintReport: document.getElementById('btnPrintReport'),
    reportContent: document.getElementById('reportContent'),

    // Toast
    toastContainer: document.getElementById('toastContainer')
  };

  // ----------------------------------------------------
  // Toast Helper
  // ----------------------------------------------------
  function showToast(message, type = 'info') {
    if (!elements.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
      <span>${escapeHtml(message)}</span>
    `;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ----------------------------------------------------
  // Navigation Handler
  // ----------------------------------------------------
  function initNavigation() {
    elements.navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = item.getAttribute('data-view');
        switchView(targetView);

        // Close mobile drawer if open
        if (elements.sidebar.classList.contains('open')) {
          elements.sidebar.classList.remove('open');
        }
      });
    });

    if (elements.mobileMenuBtn) {
      elements.mobileMenuBtn.addEventListener('click', () => {
        elements.sidebar.classList.toggle('open');
      });
    }
  }

  function switchView(viewName) {
    elements.navItems.forEach(nav => {
      if (nav.getAttribute('data-view') === viewName) {
        nav.classList.add('active');
      } else {
        nav.classList.remove('active');
      }
    });

    elements.sections.forEach(section => {
      if (section.id === `view-${viewName}`) {
        section.classList.add('active');
      } else {
        section.classList.remove('active');
      }
    });

    // Update Header Title
    const titleMap = {
      analyzer: 'AI Fact-Check Dashboard & Claim Extraction',
      'prompt-lab': 'Prompt Engineering Lab & Hallucination Mitigations',
      checklist: 'Source Credibility & Evidence Checklist (CRAAP/SIFT)',
      history: 'Verification Audit Log & Saved Reports',
      guide: 'Introduction to Prompt Engineering (IPE) Reference'
    };
    if (elements.pageTitle && titleMap[viewName]) {
      elements.pageTitle.textContent = titleMap[viewName];
    }

    if (viewName === 'history') {
      renderHistory();
    }
  }

  // ----------------------------------------------------
  // Text Input Handling & Stats
  // ----------------------------------------------------
  function updateInputStats() {
    const text = elements.textInput.value;
    const charLen = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const readingTimeSec = Math.ceil(words / 3.5);

    elements.charCount.textContent = `${charLen.toLocaleString()} characters`;
    elements.wordCount.textContent = `${words.toLocaleString()} words`;
    elements.readTime.textContent = `~${readingTimeSec}s read time`;
  }

  function initInputEvents() {
    elements.textInput.addEventListener('input', updateInputStats);

    elements.sampleChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const sampleKey = chip.getAttribute('data-sample');
        if (SAMPLES[sampleKey]) {
          elements.textInput.value = SAMPLES[sampleKey];
          updateInputStats();
          showToast(`Loaded sample: ${chip.textContent.trim()}`);
          runAnalysis();
        }
      });
    });

    elements.btnClear.addEventListener('click', () => {
      elements.textInput.value = '';
      updateInputStats();
      elements.resultsContainer.style.display = 'none';
      state.analysisResults = null;
      showToast('Input cleared');
    });

    elements.btnAnalyze.addEventListener('click', () => {
      runAnalysis();
    });
  }

  // ----------------------------------------------------
  // Analysis Runner & Render
  // ----------------------------------------------------
  function runAnalysis() {
    const text = elements.textInput.value.trim();
    if (!text) {
      showToast('Please enter or paste AI-generated text to analyze', 'error');
      elements.textInput.focus();
      return;
    }

    // Set loading state
    elements.btnAnalyze.disabled = true;
    elements.btnAnalyze.innerHTML = `
      <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/>
      </svg>
      Analyzing claims...
    `;

    setTimeout(() => {
      const results = ClaimEngine.analyze(text);
      state.analysisResults = results;

      // Update Dashboard Metrics
      elements.statTotalClaims.textContent = results.metrics.totalClaims;
      elements.statHighRisk.textContent = results.metrics.highRiskCount;
      elements.statMediumRisk.textContent = results.metrics.mediumRiskCount;
      elements.statRiskIndex.textContent = `${results.metrics.riskIndex}%`;

      // Render Interactive Highlighted Document
      renderHighlightedText(results);

      // Render Claim Cards
      renderClaimsList(results);

      // Save to localStorage history
      saveToHistory(results);

      // Show container
      elements.resultsContainer.style.display = 'block';

      // Reset button
      elements.btnAnalyze.disabled = false;
      elements.btnAnalyze.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        Extract &amp; Analyze Claims
      `;

      showToast(`Analysis complete: ${results.metrics.totalClaims} claims detected`);

      // Smooth scroll to results
      elements.resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);
  }

  function renderHighlightedText(results) {
    const container = elements.highlightedTextContainer;
    container.innerHTML = '';

    results.sentences.forEach(s => {
      const claim = results.claims.find(c => c.id === s.id);
      if (claim) {
        const span = document.createElement('span');
        span.className = `claim-highlight ${claim.priority}`;
        span.setAttribute('data-claim-id', claim.id);
        span.textContent = s.text + ' ';
        span.title = `[${claim.priority.toUpperCase()} RISK] ${claim.claimType} — Click to inspect`;
        
        span.addEventListener('click', () => {
          highlightClaim(claim.id);
        });

        container.appendChild(span);
      } else {
        const textNode = document.createTextNode(s.text + ' ');
        container.appendChild(textNode);
      }
    });
  }

  function renderClaimsList(results) {
    const container = elements.claimsListContainer;
    container.innerHTML = '';

    if (results.claims.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 32px; color: var(--text-muted);">
          No high-risk factual claims detected. The text appears largely conceptual or descriptive.
        </div>
      `;
      return;
    }

    results.claims.forEach((claim, index) => {
      const card = document.createElement('div');
      card.className = `claim-card ${claim.priority}`;
      card.id = `card-${claim.id}`;

      const badgeClass = `badge-${claim.priority}`;

      card.innerHTML = `
        <div class="claim-card-top">
          <div style="display:flex; align-items:center; gap: 8px;">
            <span class="claim-badge ${badgeClass}">${claim.priority} Risk</span>
            <span class="claim-type-tag">${escapeHtml(claim.claimType)}</span>
          </div>
          <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">#${index + 1}</span>
        </div>

        <div class="claim-sentence">“${escapeHtml(claim.text)}”</div>

        <div class="claim-rationale">
          <strong>Verification Rationale:</strong><br/>
          ${claim.reasons.map(r => `• ${escapeHtml(r)}`).join('<br/>')}
        </div>

        <div class="claim-actions">
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-size: 11px; font-weight: 600; color: var(--text-muted);">Status:</label>
            <select class="verify-select" data-claim-id="${claim.id}">
              <option value="Unchecked" ${claim.status === 'Unchecked' ? 'selected' : ''}>⏳ Unchecked</option>
              <option value="Verified True" ${claim.status === 'Verified True' ? 'selected' : ''}>✅ Verified True</option>
              <option value="Debunked / Hallucination" ${claim.status === 'Debunked / Hallucination' ? 'selected' : ''}>❌ Hallucination</option>
              <option value="Needs Nuance" ${claim.status === 'Needs Nuance' ? 'selected' : ''}>⚠️ Needs Nuance</option>
            </select>
          </div>

          <a href="${claim.searchUrl}" target="_blank" rel="noopener noreferrer" class="search-helper-btn" title="Search Google for verification evidence">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            Search Evidence
          </a>
        </div>
      `;

      // Status change listener
      const select = card.querySelector('.verify-select');
      select.addEventListener('change', (e) => {
        claim.status = e.target.value;
        showToast(`Claim #${index + 1} marked as: ${e.target.value}`);
      });

      card.addEventListener('click', (e) => {
        if (e.target.tagName !== 'SELECT' && e.target.tagName !== 'A') {
          highlightClaim(claim.id);
        }
      });

      container.appendChild(card);
    });
  }

  function highlightClaim(claimId) {
    state.selectedClaimId = claimId;

    // Highlights in text
    document.querySelectorAll('.claim-highlight').forEach(el => {
      if (el.getAttribute('data-claim-id') === claimId) {
        el.classList.add('selected');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        el.classList.remove('selected');
      }
    });

    // Cards
    document.querySelectorAll('.claim-card').forEach(card => {
      if (card.id === `card-${claimId}`) {
        card.classList.add('selected');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        card.classList.remove('selected');
      }
    });
  }

  // ----------------------------------------------------
  // Prompt Comparison Lab (IPE College Feature)
  // ----------------------------------------------------
  function initPromptLab() {
    const select = elements.caseStudySelect;
    select.innerHTML = PROMPT_CASE_STUDIES.map(cs => `
      <option value="${cs.id}">${escapeHtml(cs.title)}</option>
    `).join('');

    select.addEventListener('change', () => {
      renderPromptCaseStudy(select.value);
    });

    // Render first study
    renderPromptCaseStudy(PROMPT_CASE_STUDIES[0].id);

    // Custom prompt tester
    if (elements.btnCompareCustom) {
      elements.btnCompareCustom.addEventListener('click', compareCustomPrompts);
    }
  }

  function renderPromptCaseStudy(caseStudyId) {
    const study = PROMPT_CASE_STUDIES.find(cs => cs.id === caseStudyId);
    if (!study) return;

    const container = elements.promptLabContainer;
    container.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h4 style="font-size: 16px; font-weight: 700; color: var(--text-main);">${escapeHtml(study.title)}</h4>
        <p style="font-size: 13px; color: var(--text-muted);">${escapeHtml(study.description)}</p>
      </div>

      <div class="prompt-grid">
        <!-- Poor / Naive Prompt -->
        <div class="prompt-box">
          <div class="prompt-box-header">
            <span style="font-weight: 700; font-size: 13px; color: var(--text-main);">${escapeHtml(study.naive.title)}</span>
            <span class="prompt-pill ${study.naive.pillClass}">${escapeHtml(study.naive.tag)}</span>
          </div>
          
          <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">USER PROMPT:</div>
          <div class="code-container">${escapeHtml(study.naive.prompt)}</div>

          <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">AI GENERATED RESPONSE:</div>
          <div class="output-container">${escapeHtml(study.naive.output)}</div>

          <div class="prompt-verdict ${study.naive.verdictClass}">${study.naive.verdict}</div>
        </div>

        <!-- Optimized IPE Prompt -->
        <div class="prompt-box">
          <div class="prompt-box-header">
            <span style="font-weight: 700; font-size: 13px; color: var(--text-main);">${escapeHtml(study.improved.title)}</span>
            <span class="prompt-pill ${study.improved.pillClass}">${escapeHtml(study.improved.tag)}</span>
          </div>

          <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">RE-ENGINEERED PROMPT:</div>
          <div class="code-container">${escapeHtml(study.improved.prompt)}</div>

          <div style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">AI GENERATED RESPONSE:</div>
          <div class="output-container">${escapeHtml(study.improved.output)}</div>

          <div class="prompt-verdict ${study.improved.verdictClass}">${study.improved.verdict}</div>
        </div>
      </div>
    `;
  }

  function compareCustomPrompts() {
    const pA = elements.customPromptA.value.trim();
    const pB = elements.customPromptB.value.trim();

    if (!pA || !pB) {
      showToast('Please enter both Prompt A and Prompt B to compare', 'error');
      return;
    }

    // Heuristic prompt evaluation
    const evalA = analyzePromptQuality(pA);
    const evalB = analyzePromptQuality(pB);

    elements.customCompareResult.style.display = 'block';
    elements.customCompareResult.innerHTML = `
      <h4 style="font-size: 15px; font-weight: 700; margin-bottom: 14px; color: var(--text-main);">Prompt Engineering Heuristic Scorecard</h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div style="background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px;">
          <div style="font-weight: 700; font-size: 13px; margin-bottom: 6px;">Prompt A Analysis</div>
          <div style="font-size: 20px; font-weight: 800; color: ${evalA.score >= 70 ? 'var(--success)' : 'var(--danger)'};">${evalA.score}/100</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 6px;">${escapeHtml(evalA.feedback)}</div>
          <ul style="font-size: 11px; margin-top: 10px; padding-left: 16px; color: #475569;">
            ${evalA.strengths.map(s => `<li style="color: var(--success);">${escapeHtml(s)}</li>`).join('')}
            ${evalA.warnings.map(w => `<li style="color: var(--danger);">${escapeHtml(w)}</li>`).join('')}
          </ul>
        </div>

        <div style="background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px;">
          <div style="font-weight: 700; font-size: 13px; margin-bottom: 6px;">Prompt B Analysis</div>
          <div style="font-size: 20px; font-weight: 800; color: ${evalB.score >= 70 ? 'var(--success)' : 'var(--danger)'};">${evalB.score}/100</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 6px;">${escapeHtml(evalB.feedback)}</div>
          <ul style="font-size: 11px; margin-top: 10px; padding-left: 16px; color: #475569;">
            ${evalB.strengths.map(s => `<li style="color: var(--success);">${escapeHtml(s)}</li>`).join('')}
            ${evalB.warnings.map(w => `<li style="color: var(--danger);">${escapeHtml(w)}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;

    showToast('Prompts compared successfully');
  }

  function analyzePromptQuality(prompt) {
    let score = 50;
    const strengths = [];
    const warnings = [];
    const pLower = prompt.toLowerCase();

    // Positive prompt engineering markers
    if (pLower.includes('cite') || pLower.includes('source') || pLower.includes('reference')) {
      score += 15;
      strengths.push('Requests source attribution and verifiable citations.');
    }
    if (pLower.includes('limitations') || pLower.includes('uncertainty') || pLower.includes('inconclusive')) {
      score += 15;
      strengths.push('Authorizes epistemic modesty & admitting uncertainty.');
    }
    if (pLower.includes('step') || pLower.includes('chain') || pLower.includes('first') || pLower.includes('verify')) {
      score += 10;
      strengths.push('Employs structured step-by-step or CoVe reasoning instructions.');
    }
    if (prompt.length > 80) {
      score += 10;
      strengths.push('Provides comprehensive task context and parameters.');
    }

    // Negative prompt markers
    if (pLower.includes('prove that') || pLower.includes('tell me why') && pLower.includes('always')) {
      score -= 20;
      warnings.push('Contains leading confirmation bias, inducing sycophancy.');
    }
    if (pLower.includes('100%') || pLower.includes('guarantee') || pLower.includes('cure')) {
      score -= 15;
      warnings.push('Invites absolutist claims without scientific caveat.');
    }
    if (prompt.length < 30) {
      score -= 10;
      warnings.push('Extremely brief query; lacks constraints to prevent hallucination.');
    }

    score = Math.max(10, Math.min(score, 100));

    let feedback = 'Moderate prompt engineering discipline.';
    if (score >= 75) feedback = 'High quality: well-constrained, evidence-oriented, and resistant to hallucination.';
    if (score < 50) feedback = 'Vulnerable to hallucinations: lacks constraints and invites model overconfidence.';

    return { score, feedback, strengths, warnings };
  }

  // ----------------------------------------------------
  // Source Verification Checklist (CRAAP / SIFT)
  // ----------------------------------------------------
  function initChecklist() {
    loadChecklistState();
    renderChecklist();

    elements.btnResetChecklist.addEventListener('click', () => {
      state.checklistScores = {};
      saveChecklistState();
      renderChecklist();
      showToast('Checklist scores reset');
    });
  }

  function renderChecklist() {
    const container = elements.checklistItemsContainer;
    container.innerHTML = '';

    let totalItems = 0;
    let checkedItems = 0;

    CHECKLIST_DATA.forEach(group => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'checklist-group';

      groupDiv.innerHTML = `
        <div class="group-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          ${escapeHtml(group.category)}
        </div>
      `;

      group.items.forEach(item => {
        totalItems++;
        const isChecked = !!state.checklistScores[item.id];
        if (isChecked) checkedItems++;

        const itemDiv = document.createElement('label');
        itemDiv.className = 'check-item';
        itemDiv.innerHTML = `
          <input type="checkbox" data-check-id="${item.id}" ${isChecked ? 'checked' : ''} />
          <div class="check-content">
            <div class="check-title">${escapeHtml(item.text)}</div>
            <div class="check-desc">${escapeHtml(item.desc)}</div>
          </div>
        `;

        const checkbox = itemDiv.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => {
          state.checklistScores[item.id] = e.target.checked;
          saveChecklistState();
          updateChecklistProgress(totalItems);
        });

        groupDiv.appendChild(itemDiv);
      });

      container.appendChild(groupDiv);
    });

    updateChecklistProgress(totalItems);
  }

  function updateChecklistProgress(total) {
    let checked = 0;
    Object.values(state.checklistScores).forEach(val => {
      if (val) checked++;
    });

    const percent = total > 0 ? Math.round((checked / total) * 100) : 0;
    elements.checklistScorePercent.textContent = `${percent}%`;
    elements.checklistProgressFill.style.width = `${percent}%`;
  }

  function saveChecklistState() {
    try {
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(state.checklistScores));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }

  function loadChecklistState() {
    try {
      const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (raw) {
        state.checklistScores = JSON.parse(raw);
      }
    } catch (e) {
      state.checklistScores = {};
    }
  }

  // ----------------------------------------------------
  // LocalStorage History Management
  // ----------------------------------------------------
  function loadHistoryFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        state.history = JSON.parse(raw);
      }
    } catch (e) {
      state.history = [];
    }
  }

  function saveToHistory(analysisResults) {
    loadHistoryFromStorage();
    const item = {
      id: 'audit_' + Date.now(),
      date: new Date().toLocaleString(),
      snippet: analysisResults.text.slice(0, 120) + (analysisResults.text.length > 120 ? '...' : ''),
      fullText: analysisResults.text,
      totalClaims: analysisResults.metrics.totalClaims,
      highRisk: analysisResults.metrics.highRiskCount,
      riskIndex: analysisResults.metrics.riskIndex
    };

    // Prepend and limit to 20
    state.history.unshift(item);
    if (state.history.length > 20) state.history = state.history.slice(0, 20);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }

  function renderHistory() {
    loadHistoryFromStorage();
    const container = elements.historyList;
    container.innerHTML = '';

    if (!state.history || state.history.length === 0) {
      container.innerHTML = `
        <div class="history-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; color: var(--text-muted);">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <div style="font-weight: 600;">No verification records saved yet</div>
          <div style="font-size: 13px; margin-top: 4px;">Run an analysis on the dashboard to build your audit history.</div>
        </div>
      `;
      return;
    }

    state.history.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'history-card-item';
      card.innerHTML = `
        <div class="history-info">
          <div class="history-date">${escapeHtml(item.date)}</div>
          <div class="history-snippet">“${escapeHtml(item.snippet)}”</div>
        </div>

        <div class="history-stats">
          <span style="color: var(--text-muted); font-size: 12px;">Claims: <strong>${item.totalClaims}</strong></span>
          <span style="color: var(--danger); font-size: 12px;">High Risk: <strong>${item.highRisk}</strong></span>
          <span style="color: var(--primary); font-size: 12px;">Risk Index: <strong>${item.riskIndex}%</strong></span>
        </div>

        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm btn-history-load" data-index="${index}">
            Load
          </button>
          <button class="btn btn-danger btn-sm btn-history-del" data-index="${index}">
            Delete
          </button>
        </div>
      `;

      card.querySelector('.btn-history-load').addEventListener('click', () => {
        elements.textInput.value = item.fullText;
        updateInputStats();
        switchView('analyzer');
        runAnalysis();
        showToast('Loaded audit item into analyzer');
      });

      card.querySelector('.btn-history-del').addEventListener('click', () => {
        state.history.splice(index, 1);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
        renderHistory();
        showToast('Record deleted');
      });

      container.appendChild(card);
    });
  }

  function initHistory() {
    loadHistoryFromStorage();
    if (elements.btnClearHistory) {
      elements.btnClearHistory.addEventListener('click', () => {
        if (confirm('Clear all verification audit history from browser storage?')) {
          state.history = [];
          localStorage.removeItem(STORAGE_KEY);
          renderHistory();
          showToast('History cleared');
        }
      });
    }
  }

  // ----------------------------------------------------
  // Report Generator & Modal
  // ----------------------------------------------------
  function initReportModal() {
    elements.btnExportReport.addEventListener('click', openReportModal);
    elements.modalCloseBtn.addEventListener('click', closeReportModal);
    elements.modalDoneBtn.addEventListener('click', closeReportModal);

    elements.btnCopyReport.addEventListener('click', () => {
      const text = generateMarkdownReport();
      navigator.clipboard.writeText(text).then(() => {
        showToast('Full Markdown report copied to clipboard!');
      });
    });

    elements.btnDownloadReport.addEventListener('click', () => {
      const text = generateMarkdownReport();
      const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AI-FactCheck-Audit-${Date.now()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Report downloaded as Markdown');
    });

    elements.btnPrintReport.addEventListener('click', () => {
      window.print();
    });

    // Close on outside click
    elements.reportModal.addEventListener('click', (e) => {
      if (e.target === elements.reportModal) {
        closeReportModal();
      }
    });
  }

  function openReportModal() {
    if (!state.analysisResults) {
      showToast('Run an analysis first to generate an audit report', 'error');
      return;
    }
    const reportText = generateMarkdownReport();
    elements.reportContent.textContent = reportText;
    elements.reportModal.classList.add('active');
  }

  function closeReportModal() {
    elements.reportModal.classList.remove('active');
  }

  function generateMarkdownReport() {
    const res = state.analysisResults;
    if (!res) return '';

    const lines = [];
    lines.push('========================================================================');
    lines.push('AI FACTCHECK: SMART INFORMATION VERIFICATION REPORT');
    lines.push('Course / Project: Introduction to Prompt Engineering (IPE)');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('========================================================================\n');

    lines.push('--- EXECUTIVE SUMMARY ---');
    lines.push(`Total Word Count: ${res.metrics.words}`);
    lines.push(`Total Sentences: ${res.metrics.sentencesCount}`);
    lines.push(`Flagged Claims: ${res.metrics.totalClaims}`);
    lines.push(`High Risk Assertions: ${res.metrics.highRiskCount}`);
    lines.push(`Medium Risk Assertions: ${res.metrics.mediumRiskCount}`);
    lines.push(`Automated Risk Index: ${res.metrics.riskIndex}%\n`);

    lines.push('--- INPUT TEXT ANALYZED ---');
    lines.push(res.text);
    lines.push('\n--- IDENTIFIED CLAIMS & VERIFICATION RECOMMENDATIONS ---');

    res.claims.forEach((claim, idx) => {
      lines.push(`[Claim #${idx + 1}] Priority: ${claim.priority.toUpperCase()} | Type: ${claim.claimType}`);
      lines.push(`Text: "${claim.text}"`);
      lines.push(`Verification Status: ${claim.status}`);
      lines.push(`Rationale: ${claim.reasons.join(' ')}`);
      lines.push(`Suggested Search: ${claim.searchUrl}`);
      lines.push('------------------------------------------------------------------------');
    });

    lines.push('\n--- RESPONSIBLE AI & METHODOLOGICAL LIMITATIONS ---');
    lines.push('1. AUTOMATED HEURISTIC PROFILE: This report is generated via rule-based');
    lines.push('   linguistic pattern matching and hallucination vulnerability scoring.');
    lines.push('2. NOT AN AUTHORITATIVE FACT CHECK: Flagged claims indicate heightened risk');
    lines.push('   of fabrication, but do not replace human-in-the-loop validation against');
    lines.push('   authoritative databases, peer-reviewed journals, and official registers.');
    lines.push('3. PROMPT ENGINEERING INSIGHT: Unconstrained, open-ended prompts frequently');
    lines.push('   cause hallucinated statistics. Apply Chain-of-Verification (CoVe) and');
    lines.push('   explicit source-grounding instructions to reduce hallucination rates.');
    lines.push('========================================================================');

    return lines.join('\n');
  }

  // ----------------------------------------------------
  // Initialization
  // ----------------------------------------------------
  function init() {
    initNavigation();
    initInputEvents();
    initPromptLab();
    initChecklist();
    initHistory();
    initReportModal();
    updateInputStats();

    // Load initial medical sample for immediate demo appeal
    if (!elements.textInput.value) {
      elements.textInput.value = SAMPLES.medical;
      updateInputStats();
      runAnalysis();
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

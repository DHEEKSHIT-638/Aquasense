/**
 * AquaSense Accuracy Refactor
 * ----------------------------
 * 1. Decoupled all arithmetic calculations from the Gemini API and implemented them deterministically in JS.
 * 2. Added static fallbacks (STATIC_FALLBACKS) and narrative sanitization (sanitizeNarrative) for graceful degradation if the API is offline.
 * 3. Updated submitWizardData to call calculations first and restrict Gemini to narrative-only generation.
 * 4. Maintained the exact dashboard data rendering schema.
 */
const EMBEDDED_API_KEY = ""; // Paste your API key here or enter it when prompted in the browser

document.addEventListener("DOMContentLoaded", () => {
  // --- STATE VARIABLES ---
  let currentStep = 1;
  const totalSteps = 5;
  let activeTimelineChecklist = Array(7).fill(false);
  let cachedResponseData = null;
  
  // Animation & Interval States (declared at top to prevent Temporal Dead Zone)
  let rippleAnimId = null;
  let loaderInterval = null;
  let currentY = 115;
  let loaderPhase = "filling";
  let loadingPhrasesInterval = null;

  // --- DOM ELEMENTS ---
  const resetAppBtn = document.getElementById("resetAppBtn");

  // Wizard Navigation
  const form = document.getElementById("footprintForm");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const steps = document.querySelectorAll(".wizard-step");
  const progress = document.getElementById("wizardProgressBar");
  const stepIndicator = document.getElementById("wizardStepIndicator");
  const stepDots = document.querySelectorAll(".step-dot");

  // Form Value Sync
  const householdCountInput = document.getElementById("household_count");
  const householdValDisplay = document.getElementById("householdVal");
  const showerDurationInput = document.getElementById("shower_duration");
  const showerValDisplay = document.getElementById("showerVal");
  const washingMachineInput = document.getElementById("washing_machine");
  const washingValDisplay = document.getElementById("washingVal");
  const carWashingInput = document.getElementById("car_washing");
  const carValDisplay = document.getElementById("carVal");

  // Loader & Section Panels
  const heroSection = document.getElementById("hero");
  const calculatorSection = document.getElementById("calculator-section");
  const calculatorCard = document.getElementById("calculator-card");
  const loaderPanel = document.getElementById("loaderPanel");
  const resultsSection = document.getElementById("resultsSection");
  const recalculateBtn = document.getElementById("recalculateBtn");
  const factCarousel = document.getElementById("factCarousel");
  const completionBanner = document.getElementById("completionBanner");

  // Dashboard Data Targets
  const scoreVal = document.getElementById("scoreVal");
  const gaugeFill = document.getElementById("gaugeFill");
  const riskBadge = document.getElementById("riskBadge");
  const scoreExplanation = document.getElementById("scoreExplanation");
  const litersSavedVal = document.getElementById("litersSavedVal");
  const inrSavedVal = document.getElementById("inrSavedVal");
  const tipsListContainer = document.getElementById("tipsListContainer");
  const timelineContainer = document.getElementById("timelineContainer");

  // Educational Facts Array
  const waterFacts = [
    "A running tap wastes up to 6 liters of water per minute. Closing the tap while brushing saves a household hundreds of liters monthly.",
    "A standard shower uses about 10-15 liters of water per minute. Replacing it with a bucket bath can save up to 80% of that water.",
    "Washing machines use 60 to 120 liters per cycle. Only running full loads can save over 4,000 liters of water annually per home.",
    "Water storage tank overflows are a major cause of urban water waste in India. Automatic cut-off level sensors can prevent 100% of this waste.",
    "Under BIS IS 1172, the domestic water requirement in Indian cities is 135 liters per person per day. Many households consume over double this amount.",
    "Using soapy wastewater (greywater) from washing machines to water plants or wash floors is a highly efficient reclamation practice."
  ];
  let factIndex = 0;
  let factInterval = null;

  // Custom step titles for step-rail
  const stepTitles = [
    "Demographics",
    "Personal Habits",
    "Appliance Usage",
    "Outdoor Use",
    "Billing & Storage"
  ];

  // --- DARK MODE THEME SYSTEM ---
  const themeToggleBtn = document.getElementById("themeToggle");
  const htmlEl = document.documentElement;

  function getSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    htmlEl.setAttribute('data-theme', theme);
  }

  function initTheme() {
    const stored = localStorage.getItem('aquasense-theme');
    if (stored) {
      applyTheme(stored);
    } else {
      applyTheme('light');
    }
  }

  // Initialize theme immediately
  initTheme();

  // Toggle button click handler
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = htmlEl.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem('aquasense-theme', next);
    });
  }

  // Listen to OS-level theme changes (only if user hasn't explicitly chosen)
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('aquasense-theme')) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  // Helper to get ripple color based on theme
  function getRippleColor(alpha) {
    const isDark = htmlEl.getAttribute('data-theme') === 'dark';
    if (isDark) {
      return `rgba(91, 163, 192, ${alpha * 0.7})`;
    }
    return `rgba(91, 163, 192, ${alpha})`;
  }

  // --- INITIALIZATION ---
  initAmbientRipples();
  initChoiceCards();
  initFormSync();
  checkProgressChecklist();

  // Scroll to Form CTA
  document.getElementById("startFootprintBtn").addEventListener("click", (e) => {
    e.preventDefault();
    calculatorCard.scrollIntoView({ behavior: "smooth" });
  });

  // Reset entire application
  resetAppBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (confirm("Reset all stored calculations and checklist progress?")) {
      localStorage.clear();
      location.reload();
    }
  });

  // --- FORM VALUE SYNCS & CHOICE CARDS ---
  function initFormSync() {
    const sliders = [
      { input: householdCountInput, display: householdValDisplay, suffix: (val) => val == 1 ? 'Person' : 'People' },
      { input: showerDurationInput, display: showerValDisplay, suffix: (val) => val == 1 ? 'Minute' : 'Minutes' },
      { input: washingMachineInput, display: washingValDisplay, suffix: (val) => val == 1 ? 'Load / week' : 'Loads / week' },
      { input: carWashingInput, display: carValDisplay, suffix: (val) => val == 1 ? 'Time / week' : 'Times / week' }
    ];

    sliders.forEach(({ input, display, suffix }) => {
      // Set initial fill
      updateSliderFill(input, display, suffix);
      
      input.addEventListener("input", () => {
        updateSliderFill(input, display, suffix);
        // Pulse badge on change
        display.classList.add("changed");
        setTimeout(() => display.classList.remove("changed"), 150);
      });
    });
  }

  function updateSliderFill(input, display, suffix) {
    const val = input.value;
    display.textContent = `${val} ${typeof suffix === 'function' ? suffix(val) : suffix}`;
    const pct = ((val - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty('--slider-fill', `${pct}%`);
  }

  function initChoiceCards() {
    const choiceCards = document.querySelectorAll(".choice-card");
    choiceCards.forEach(card => {
      card.addEventListener("click", () => {
        const fieldName = card.dataset.name;
        const fieldValue = card.dataset.value;

        // Toggle selected styling
        const siblingCards = card.parentElement.querySelectorAll(".choice-card");
        siblingCards.forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");

        // Set hidden input value
        document.getElementById(fieldName).value = fieldValue;

        // Conditional display for Garden watering
        if (fieldName === "garden_watering") {
          const conditionalPanel = document.getElementById("gardenTimeContainer");
          if (fieldValue === "yes") {
            conditionalPanel.classList.add("active");
          } else {
            conditionalPanel.classList.remove("active");
          }
        }
      });
    });
  }

  // --- TRANSITION HELPER ---
  function switchPanel(fromEl, toEl) {
    fromEl.classList.add("exiting");
    setTimeout(() => {
      fromEl.style.display = "none";
      fromEl.classList.remove("exiting");

      toEl.style.display = "block";
      toEl.classList.add("entering");
      // Force reflow
      toEl.offsetHeight;
      toEl.classList.remove("entering");
    }, 400);
  }

  // --- HERO AMBIENT RIPPLES ---
  function initAmbientRipples() {
    const canvas = document.getElementById("ambientRippleCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const ripples = [];
    const maxRipples = 3;

    // Spawn ripples at interval
    function spawnRipple() {
      if (ripples.length < maxRipples) {
        ripples.push({
          x: canvas.width / 2,
          y: canvas.height / 2,
          r: 20,
          alpha: 0.35,
          speed: 1.1
        });
      }
    }

    // Spawn first ripple
    spawnRipple();
    const spawnInterval = setInterval(spawnRipple, 1500);

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i];
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
        ctx.strokeStyle = getRippleColor(rip.alpha);
        ctx.lineWidth = 1.5;
        ctx.stroke();

        rip.r += rip.speed;
        // alpha fades as it expands
        rip.alpha = 0.35 * (1 - (rip.r - 20) / 160);

        if (rip.r >= 180 || rip.alpha <= 0) {
          ripples.splice(i, 1);
        }
      }

      rippleAnimId = requestAnimationFrame(animate);
    }
    animate();

    // Cleanup interval if component unmounts
    window.addEventListener("pagehide", () => {
      clearInterval(spawnInterval);
      cancelAnimationFrame(rippleAnimId);
    });
  }

  // --- WIZARD STEP NAVIGATION ---
  function updateWizardUI() {
    steps.forEach((step, idx) => {
      if (idx + 1 === currentStep) {
        step.classList.add("active");
      } else {
        step.classList.remove("active");
      }
    });

    // Update Step dots
    stepDots.forEach((dot, idx) => {
      const stepNum = idx + 1;
      dot.className = "step-dot";
      if (stepNum === currentStep) {
        dot.classList.add("active");
      } else if (stepNum < currentStep) {
        dot.classList.add("completed");
      }
    });

    // Back Button visibility
    if (currentStep === 1) {
      prevBtn.style.visibility = "hidden";
    } else {
      prevBtn.style.visibility = "visible";
    }

    // Next Button label update
    if (currentStep === totalSteps) {
      nextBtn.innerHTML = `
        <span>Calculate My Footprint</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      `;
    } else {
      nextBtn.innerHTML = `
        <span>Continue</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      `;
    }

    // Progress Bar percent
    const percent = ((currentStep - 1) / (totalSteps - 1)) * 80 + 20;
    progress.style.width = `${percent}%`;
    progress.setAttribute("aria-valuenow", percent);
    stepIndicator.textContent = `Step ${currentStep} of ${totalSteps} — ${stepTitles[currentStep - 1]}`;
  }

  prevBtn.addEventListener("click", () => {
    if (currentStep > 1) {
      currentStep--;
      updateWizardUI();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (currentStep < totalSteps) {
      // Basic validation for Step 1
      if (currentStep === 1) {
        const locationInput = document.getElementById("location");
        if (!locationInput.value.trim()) {
          locationInput.focus();
          locationInput.style.borderColor = "var(--color-risk-high)";
          setTimeout(() => locationInput.style.borderColor = "var(--color-border)", 2000);
          return;
        }
      }
      currentStep++;
      updateWizardUI();
    } else {
      // Final submit
      submitWizardData();
    }
  });

  // --- LOADER DYNAMICS ( Rising Beaker, Shimmer & Bubbles ) ---

  const loadingPhrases = [
    "Mapping your household water profile...",
    "Cross-referencing BIS IS 1172 standards...",
    "Calculating daily consumption patterns...",
    "Scoring against UN SDG 6.4 benchmarks...",
    "Generating your conservation roadmap...",
    "Almost there — building your action plan..."
  ];

  function startLoader() {
    form.style.display = "none";
    loaderPanel.style.display = "flex";
    
    const liquidRect = document.getElementById("liquidRect");
    const shimmerLine = document.getElementById("shimmerLine");
    const flaskSvg = document.querySelector(".flask-svg");
    
    // Create beaker bubbles container
    let bubbleGroup = document.getElementById("beakerBubbles");
    if (!bubbleGroup) {
      bubbleGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      bubbleGroup.setAttribute("id", "beakerBubbles");
      // Insert inside clipPath group
      const clipGroup = flaskSvg.querySelector("g[clip-path]");
      clipGroup.appendChild(bubbleGroup);
    }
    bubbleGroup.innerHTML = "";

    // Maintain bubble states
    const bubbles = [];
    const maxBubbles = 6;
    for (let i = 0; i < maxBubbles; i++) {
      bubbles.push({
        cx: 25 + Math.random() * 50,
        cy: 110 + Math.random() * 10,
        r: 2 + Math.random() * 3,
        speed: 0.8 + Math.random() * 1.2
      });
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("class", "beaker-bubble");
      bubbleGroup.appendChild(circle);
    }

    let phase = 0;
    currentY = 115;
    loaderPhase = "filling";
    
    // Smooth filling and wave oscillation
    loaderInterval = setInterval(() => {
      phase += 0.12;

      if (loaderPhase === "filling" || loaderPhase === "waiting") {
        let speed = 0.5;
        if (currentY < 45) {
          speed = (currentY - 20) * 0.025;
          if (speed < 0.08) speed = 0.08;
        }
        currentY -= speed;
      } else if (loaderPhase === "completing") {
        if (currentY > 15) {
          currentY -= 4.0;
          if (currentY < 15) currentY = 15;
        }
      }

      // Render Liquid Wave
      const amplitude = (currentY > 95 || currentY < 20) ? 1.0 : 2.5;
      let pathD = `M 0,${currentY + Math.sin(phase) * amplitude}`;
      for (let x = 2; x <= 100; x += 2) {
        const waveY = currentY + Math.sin(x * 0.15 + phase) * amplitude;
        pathD += ` L ${x},${waveY}`;
      }
      pathD += ` L 100,120 L 0,120 Z`;
      liquidRect.setAttribute("d", pathD);

      // Render Shimmer Line
      shimmerLine.setAttribute("y1", currentY + Math.sin(phase) * amplitude);
      shimmerLine.setAttribute("y2", currentY + Math.sin(100 * 0.15 + phase) * amplitude);

      // Render Beaker Bubbles
      const circles = bubbleGroup.querySelectorAll("circle");
      bubbles.forEach((b, idx) => {
        b.cy -= b.speed;
        // Reset bubble to bottom if it rises above liquid level
        if (b.cy < currentY + 5) {
          b.cy = 110 + Math.random() * 10;
          b.cx = 25 + Math.random() * 50;
        }
        const circle = circles[idx];
        circle.setAttribute("cx", b.cx);
        circle.setAttribute("cy", b.cy);
        circle.setAttribute("r", b.r);
      });

    }, 40);

    // Rotating status text phrases every 2 seconds
    let phraseIdx = 0;
    updateLoaderStatus(loadingPhrases[0]);
    loadingPhrasesInterval = setInterval(() => {
      phraseIdx = (phraseIdx + 1) % loadingPhrases.length;
      const statusEl = document.getElementById("loaderStatus");
      if (statusEl) {
        statusEl.style.opacity = 0;
        setTimeout(() => {
          statusEl.textContent = loadingPhrases[phraseIdx];
          statusEl.style.opacity = 1;
        }, 300);
      }
    }, 2000);

    // Carousel for educational facts rotation
    factCarousel.textContent = waterFacts[0];
    factIndex = 1;
    factInterval = setInterval(() => {
      factCarousel.style.opacity = 0;
      setTimeout(() => {
        factCarousel.textContent = waterFacts[factIndex];
        factCarousel.style.opacity = 1;
        factIndex = (factIndex + 1) % waterFacts.length;
      }, 300);
    }, 4500);
  }

  function stopLoader() {
    clearInterval(loaderInterval);
    clearInterval(factInterval);
    clearInterval(loadingPhrasesInterval);
    loaderPanel.style.display = "none";
    form.style.display = "block";
  }

  function completeLoaderAnimation() {
    return new Promise((resolve) => {
      loaderPhase = "completing";
      const checkInterval = setInterval(() => {
        if (currentY <= 15) {
          clearInterval(checkInterval);
          setTimeout(resolve, 200);
        }
      }, 30);
    });
  }

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, type = "error") {
    const toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) return;
    
    const toast = document.createElement("div");
    toast.style.cssText = `
      padding: 12px 20px;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      font-size: 0.9rem;
      font-weight: 500;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      gap: 12px;
      pointer-events: auto;
      transform: translateY(20px);
      opacity: 0;
      transition: all 300ms cubic-bezier(0.16, 1, 0.3, 1);
      border: 1px solid rgba(255, 255, 255, 0.1);
      background-color: var(--color-risk-high);
    `;

    let icon = "";
    if (type === "success") {
      toast.style.backgroundColor = "var(--color-risk-low)";
      icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === "warning") {
      toast.style.backgroundColor = "var(--color-risk-moderate)";
      icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></svg>`;
    } else {
      toast.style.backgroundColor = "var(--color-risk-high)";
      icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="12" x2="12" y2="16"></line><line x1="12" y1="8" x2="12" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
      ${icon}
      <span style="flex: 1; margin-right: 8px;">${message}</span>
      <button class="toast-close" aria-label="Close notification" style="background: none; border: none; color: rgba(255, 255, 255, 0.8); cursor: pointer; padding: 4px; display: inline-flex; align-items: center; justify-content: center; margin-left: auto; transition: color var(--transition-fast); outline: none;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.style.transform = "translateY(0)";
      toast.style.opacity = "1";
    }, 10);

    const dismissToast = (el) => {
      el.style.transform = "translateY(-20px)";
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 300);
    };

    const closeBtn = toast.querySelector(".toast-close");
    closeBtn.addEventListener("click", () => {
      dismissToast(toast);
    });

    if (type !== "error") {
      setTimeout(() => {
        dismissToast(toast);
      }, 5000);
    }
  }

  function updateLoaderStatus(text) {
    const statusEl = document.getElementById("loaderStatus");
    if (statusEl) {
      statusEl.textContent = text;
    }
  }

  async function fetchWithRetry(url, options, maxRetries = 4) {
    const logUrl = url.replace(/key=[^&]+/, "key=AIzaSy***");
    console.log(`Sending API request to: ${logUrl}`);

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) {
          return response;
        }

        let errorMsg = `HTTP error ${response.status}`;
        try {
          const errData = await response.json();
          if (errData && errData.error && errData.error.message) {
            errorMsg = `${errData.error.message} (HTTP ${response.status})`;
          }
        } catch (_) {}
        
        if (response.status === 429 || response.status === 503 || response.status === 504) {
          if (i === maxRetries - 1) throw new Error(errorMsg);
          const waitTime = i === 0 ? 5 : (i === 1 ? 10 : 20);
          const retryNum = i + 1;
          console.warn(`Transient API error (${response.status}): ${errorMsg}. Retrying in ${waitTime}s...`);
          for (let s = waitTime; s > 0; s--) {
            updateLoaderStatus(`Rate limit reached. Retrying in ${s}s... (${retryNum}/3)`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          continue;
        }
        
        throw new Error(errorMsg);
      } catch (err) {
        if (i === maxRetries - 1) throw err;
        const waitTime = i === 0 ? 5 : (i === 1 ? 10 : 20);
        const retryNum = i + 1;
        console.warn(`API connection glitch: ${err.message}. Retrying in ${waitTime}s...`);
        for (let s = waitTime; s > 0; s--) {
          updateLoaderStatus(`Rate limit reached. Retrying in ${s}s... (${retryNum}/3)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    throw new Error("Max API retries exceeded.");
  }

  function startButtonCooldown() {
    let timeLeft = 30;
    const nextBtnOriginalHTML = nextBtn.innerHTML;
    const recalculateBtnOriginalHTML = recalculateBtn.innerHTML;

    nextBtn.disabled = true;
    recalculateBtn.disabled = true;

    const updateBtnText = (seconds) => {
      nextBtn.innerHTML = `Please wait (${seconds}s) <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
      recalculateBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Please wait (${seconds}s)`;
    };

    updateBtnText(timeLeft);

    const cooldownInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(cooldownInterval);
        nextBtn.disabled = false;
        recalculateBtn.disabled = false;
        nextBtn.innerHTML = nextBtnOriginalHTML;
        recalculateBtn.innerHTML = recalculateBtnOriginalHTML;
      } else {
        updateBtnText(timeLeft);
      }
    }, 1000);
  }

  // --- CALCULATION MODULE & DETERMINISTIC TIP GENERATOR ---
  const RATES = {
    showerLPerMin: 10,
    faucetLPerMin: 6,
    brushingWasteLPerPersonDay: 24, // 2 min x2/day x 6L/min, run via tap_running flag
    washingMachineLPerLoad: 80,
    dishwashHandLDay: 100,
    dishwashBucketLDay: 30,
    dishwashMachineLDay: 15, // documented estimate for a standard efficient dishwasher cycle, amortized per day
    gardenHoseLPerMin: 15,
    gardenDripLPerMin: 3, // hose 15 L/min -> drip/bucket equivalent ~3 L/min, savings = 12 L/min
    carWashHoseL: 200,
    carWashBucketL: 40,
    tankOverflowLDay: 30, // BUG FIX: flat daily baseline IS the full overflow waste
    basicHygieneLPCD: 50
  };

  function calculateConsumption(userData) {
    const {
      householdCount, showerDurationMinutesPerPerson, tapsLeftRunningDuringBrushing,
      washingMachineUsesPerWeek, dishwashingMethod, watersGarden,
      gardenWateringMinutesPerDay, carWashTimesPerWeek, waterTankOverflowAwareness
    } = userData;

    const dailyTotal =
      (showerDurationMinutesPerPerson * RATES.showerLPerMin * householdCount) +
      (tapsLeftRunningDuringBrushing === "yes" ? RATES.brushingWasteLPerPersonDay * householdCount : 0) +
      (washingMachineUsesPerWeek * RATES.washingMachineLPerLoad / 7) +
      (dishwashingMethod === "hand" ? RATES.dishwashHandLDay : RATES.dishwashMachineLDay) +
      (watersGarden === "yes" ? gardenWateringMinutesPerDay * RATES.gardenHoseLPerMin : 0) +
      (carWashTimesPerWeek * RATES.carWashHoseL / 7) +
      (waterTankOverflowAwareness === "yes" ? RATES.tankOverflowLDay : 0) +
      (RATES.basicHygieneLPCD * householdCount);

    const lpcd = dailyTotal / householdCount;
    const riskLevel = lpcd <= 100 ? "LOW" : lpcd <= 180 ? "MODERATE" : "HIGH";
    const riskScore = Math.max(0, Math.min(100, Math.round((lpcd - 80) * 0.8)));

    return { dailyTotal: Math.round(dailyTotal * 100) / 100, lpcd: Math.round(lpcd * 100) / 100, riskLevel, riskScore };
  }

  function getApplicableTips(userData) {
    const { householdCount, showerDurationMinutesPerPerson, tapsLeftRunningDuringBrushing,
            washingMachineUsesPerWeek, dishwashingMethod, watersGarden,
            gardenWateringMinutesPerDay, carWashTimesPerWeek, waterTankOverflowAwareness } = userData;

    const tips = [];

    if (showerDurationMinutesPerPerson > 5) {
      tips.push({
        key: "shorten_shower",
        liters_saved: Math.round((showerDurationMinutesPerPerson - 5) * RATES.showerLPerMin * householdCount),
        unit: "L/day"
      });
    }

    if (tapsLeftRunningDuringBrushing === "yes") {
      tips.push({
        key: "turn_off_tap",
        liters_saved: RATES.brushingWasteLPerPersonDay * householdCount,
        unit: "L/day"
      });
    }

    if (washingMachineUsesPerWeek > 1) {
      tips.push({
        key: "max_washing_loads",
        liters_saved: RATES.washingMachineLPerLoad, // 80, for display: "80 L/load"
        daily_equivalent: Math.round(RATES.washingMachineLPerLoad / 7), // 11, for summation
        unit: "L/load"
      });
    }

    if (dishwashingMethod === "hand") {
      tips.push({
        key: "bucket_dishwashing",
        liters_saved: RATES.dishwashHandLDay - RATES.dishwashBucketLDay,
        unit: "L/day"
      });
    }

    if (watersGarden === "yes" && gardenWateringMinutesPerDay > 0) {
      tips.push({
        key: "garden_drip",
        liters_saved: Math.round(gardenWateringMinutesPerDay * (RATES.gardenHoseLPerMin - RATES.gardenDripLPerMin)),
        unit: "L/day"
      });
    }

    if (carWashTimesPerWeek > 0) {
      tips.push({
        key: "bucket_car_wash",
        liters_saved: Math.round((RATES.carWashHoseL - RATES.carWashBucketL) * carWashTimesPerWeek / 7),
        unit: "L/day"
      });
    }

    if (waterTankOverflowAwareness === "yes") {
      tips.push({
        key: "fix_tank_overflow",
        liters_saved: RATES.tankOverflowLDay,
        unit: "L/day"
      });
    }

    return tips;
  }

  function calculateSavings(tips, monthlyWaterBillINR) {
    const dailySavingsLiters = Math.round(tips.reduce((sum, t) => {
      const val = typeof t.daily_equivalent === "number" ? t.daily_equivalent : t.liters_saved;
      return sum + (typeof val === "number" ? val : 0);
    }, 0));
    const monthlyKLSaved = (dailySavingsLiters * 30) / 1000;
    const tariffBasedSavings = Math.round(monthlyKLSaved * 22);
    const monthlySavingsINR = monthlyWaterBillINR
      ? Math.round(Math.min(monthlyWaterBillINR * 0.7, tariffBasedSavings))
      : tariffBasedSavings;
    return { dailySavingsLiters, monthlySavingsINR };
  }

  const STATIC_FALLBACKS = {
    score_explanations: {
      LOW: "Your household water footprint is within sustainable limits. Keep up the excellent conservation habits!",
      MODERATE: "Your household water footprint is moderate. There are clear opportunities to optimize usage and save on your bills.",
      HIGH: "Your household water footprint is high, indicating significant waste. Implementing the tips below will save substantial water and money."
    },
    tips: {
      shorten_shower: {
        title: "Shorten Shower Times",
        description: "Aim to reduce daily showers to 5 minutes per person. This is one of the easiest ways to significantly curb indoor water waste across your entire household."
      },
      turn_off_tap: {
        title: "Turn Off Taps While Brushing",
        description: "Close the tap while brushing teeth. Leaving the tap running wastes a large volume of water needlessly twice a day."
      },
      max_washing_loads: {
        title: "Maximize Washing Machine Loads",
        description: "Ensure your washing machine runs only with full loads. This avoids waste by reducing the total number of weekly laundry cycles."
      },
      bucket_dishwashing: {
        title: "Adopt Bucket Dishwashing",
        description: "Wash dishes in a filled basin or bucket instead of under a running tap. This dramatically cuts flow waste during soaping and rinsing."
      },
      garden_drip: {
        title: "Use Drip or Watering Cans",
        description: "Switch from hose watering to highly targeted drip irrigation or watering cans to prevent evaporative and runoff waste."
      },
      bucket_car_wash: {
        title: "Use a Bucket for Car Washing",
        description: "Wash your vehicle using a bucket and sponge instead of a running hose. This cuts wash consumption by up to 80%."
      },
      fix_tank_overflow: {
        title: "Fix Water Tank Overflow",
        description: "Install an automatic water level controller or float valve on your storage tank to prevent waste from overflow events."
      }
    },
    weekly_plan: [
      { day: "Day 1", task: "Time your showers today and aim for a maximum of 5 minutes per person." },
      { day: "Day 2", task: "Focus on turning off the tap while brushing teeth." },
      { day: "Day 3", task: "Only run the washing machine when you have a full load." },
      { day: "Day 4", task: "Try washing dishes in a basin or using the two-bucket method." },
      { day: "Day 5", task: "Water your garden plants using a watering can instead of a hose." },
      { day: "Day 6", task: "If washing vehicles, use a bucket and sponge rather than a hose." },
      { day: "Day 7", task: "Check storage tanks and plan the installation of a float valve or overflow alarm." }
    ]
  };

  function sanitizeNarrative(geminiData, riskLevel, tips) {
    const safeData = {
      score_explanation: "",
      tips: [],
      weekly_plan: []
    };

    if (geminiData && geminiData.score_explanation && geminiData.score_explanation.trim().length >= 10) {
      safeData.score_explanation = geminiData.score_explanation.trim();
    } else {
      safeData.score_explanation = STATIC_FALLBACKS.score_explanations[riskLevel] || STATIC_FALLBACKS.score_explanations.MODERATE;
    }

    const inputTips = geminiData && Array.isArray(geminiData.tips) ? geminiData.tips : [];
    
    tips.forEach((calcTip, idx) => {
      const geminiTip = inputTips[idx] || inputTips.find(t => {
        const tTitle = (t.title || "").toLowerCase();
        const cKey = calcTip.key.replace(/_/g, " ");
        return tTitle.includes(cKey) || cKey.includes(tTitle);
      });

      const fallbackInfo = STATIC_FALLBACKS.tips[calcTip.key] || { title: "Conservation Tip", description: "Save water by adopting efficient habits." };
      
      const title = geminiTip && geminiTip.title && geminiTip.title.trim().length >= 3
        ? geminiTip.title.trim()
        : fallbackInfo.title;

      const description = geminiTip && geminiTip.description && geminiTip.description.trim().length >= 10
        ? geminiTip.description.trim()
        : fallbackInfo.description;

      safeData.tips.push({
        key: calcTip.key,
        title,
        description,
        liters_saved: calcTip.liters_saved,
        daily_equivalent: calcTip.daily_equivalent,
        unit: calcTip.unit
      });
    });

    const inputWeeklyPlan = geminiData && Array.isArray(geminiData.weekly_plan) ? geminiData.weekly_plan : [];
    for (let i = 0; i < 7; i++) {
      const geminiDay = inputWeeklyPlan[i];
      const fallbackDay = STATIC_FALLBACKS.weekly_plan[i];
      const dayName = geminiDay && geminiDay.day && geminiDay.day.trim().length > 0
        ? geminiDay.day.trim()
        : fallbackDay.day;
      const taskDesc = geminiDay && geminiDay.task && geminiDay.task.trim().length >= 5
        ? geminiDay.task.trim()
        : fallbackDay.task;

      safeData.weekly_plan.push({
        day: dayName,
        task: taskDesc
      });
    }

    return safeData;
  }

  // --- GEMINI API INTEGRATION ---
  async function submitWizardData() {
    const endpoint = "/api/gemini";

    const location = document.getElementById("location").value.trim();
    const householdCount = parseInt(householdCountInput.value);
    const showerDuration = parseInt(showerDurationInput.value);
    const tapRunning = document.getElementById("tap_running").value;
    const washingMachine = parseInt(washingMachineInput.value);
    const dishwashingMethod = document.getElementById("dishwashing_method").value;
    const gardenWatering = document.getElementById("garden_watering").value;
    const gardenMinutes = gardenWatering === "yes" ? parseInt(document.getElementById("garden_minutes").value) : 0;
    const carWashing = parseInt(carWashingInput.value);
    const tankOverflow = document.getElementById("tank_overflow").value;
    const monthlyBill = document.getElementById("monthly_bill").value ? parseInt(document.getElementById("monthly_bill").value) : null;

    const userData = {
      location,
      householdCount,
      showerDurationMinutesPerPerson: showerDuration,
      tapsLeftRunningDuringBrushing: tapRunning,
      washingMachineUsesPerWeek: washingMachine,
      dishwashingMethod,
      watersGarden: gardenWatering,
      gardenWateringMinutesPerDay: gardenMinutes,
      carWashTimesPerWeek: carWashing,
      waterTankOverflowAwareness: tankOverflow,
      monthlyWaterBillINR: monthlyBill
    };

    // 1. Perform deterministic calculations locally
    const consumption = calculateConsumption(userData);
    const applicableTips = getApplicableTips(userData);
    const savings = calculateSavings(applicableTips, monthlyBill);

    updateLoaderStatus("Consulting IS 1172 standards & regional policies...");
    startLoader();

    const systemPrompt = `You are AquaSense, an expert AI water conservation advisor.
Your job is to write high-quality, natural-language narrative copy and personalize recommendations based on water footprint calculations that have already been pre-computed for you.

You will be given:
1. The household's demographics and habits.
2. The calculated baseline consumption, per-capita daily use (LPCD), and risk level (LOW/MODERATE/HIGH).
3. A list of applicable water-saving tips, including the exact volume of water saved for each tip (and its unit).

Based on this input, you must:
1. Write a 2-line concise, punchy score explanation (score_explanation) referencing the risk level and LPCD. Do not invent or change any numbers.
2. For each tip in the provided list, write a compelling, tailored title and description. You MUST mention the exact liters_saved value and unit provided in the input verbatim in the description to explain the impact to the user. Do not alter or recalculate the numbers.
3. Generate a 7-day action plan (weekly_plan) of 7 tasks (one for each day) that sequences the tips into a realistic, actionable roadmap.

CRITICAL RULES:
- Do not output any numbers that were not provided to you in the input.
- Use the exact liters_saved and unit given for each tip verbatim in your description (e.g., if you are given 400 L/day, use "400 L/day" exactly).
- Ensure your entire output strictly conforms to the requested JSON response schema. No markdown formatting, no comments, no surrounding wrappers. Return ONLY a valid JSON string.`;

    const userPrompt = `Here are the pre-computed calculations and user data:
- User Data: ${JSON.stringify(userData, null, 2)}
- Calculated Footprint:
  - Daily Total: ${consumption.dailyTotal} L/day
  - Per Capita Daily (LPCD): ${consumption.lpcd} L/person/day
  - Risk Level: ${consumption.riskLevel}
  - Risk Score: ${consumption.riskScore}/100
- Applicable Tips & Pre-calculated Savings:
  ${JSON.stringify(applicableTips.map(t => ({ key: t.key, liters_saved: t.liters_saved, unit: t.unit })), null, 2)}`;

    let parsedJson = null;
    let apiFailed = false;

    try {
      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: systemPrompt },
              { text: userPrompt }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              "score_explanation": { "type": "STRING" },
              "tips": {
                "type": "ARRAY",
                "items": {
                  "type": "OBJECT",
                  "properties": {
                    "title": { "type": "STRING" },
                    "description": { "type": "STRING" }
                  },
                  "required": ["title", "description"]
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
              }
            },
            "required": ["score_explanation", "tips", "weekly_plan"]
          }
        }
      };

      const response = await fetchWithRetry(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const resultData = await response.json();
      const rawText = resultData.candidates[0].content.parts[0].text;
      parsedJson = JSON.parse(rawText);

    } catch (error) {
      console.error("API Call failed, falling back to static generation:", error);
      apiFailed = true;
    }

    try {
      // Merge pre-calculated numbers with Gemini's narrative (or fallbacks)
      const sanitized = sanitizeNarrative(parsedJson, consumption.riskLevel, applicableTips);

      const mergedResult = {
        risk_level: consumption.riskLevel,
        risk_score: consumption.riskScore,
        score_explanation: sanitized.score_explanation,
        tips: sanitized.tips.map((t, idx) => ({
          tip_number: idx + 1,
          title: t.title,
          description: t.description,
          liters_saved: `${t.liters_saved} ${t.unit}`
        })),
        weekly_plan: sanitized.weekly_plan,
        estimated_daily_savings_liters: savings.dailySavingsLiters,
        estimated_monthly_bill_savings_inr: savings.monthlySavingsINR
      };

      cachedResponseData = mergedResult;
      activeTimelineChecklist = Array(7).fill(false);
      localStorage.setItem("aquasense_last_result", JSON.stringify(mergedResult));
      localStorage.setItem("aquasense_checklist", JSON.stringify(activeTimelineChecklist));

      await completeLoaderAnimation();

      stopLoader();
      renderDashboard(mergedResult);
      startButtonCooldown();

      if (apiFailed) {
        showToast("Calculated results loaded. AI personalization was offline, showing generic tips.", "warning");
      } else {
        showToast("Water footprint analyzed successfully!", "success");
      }

    } catch (mergeError) {
      console.error("Error during merge/render:", mergeError);
      stopLoader();
      showToast("Failed to process calculations: " + mergeError.message, "error");
    }
  }

  // --- DASHBOARD RENDERER ---
  function renderDashboard(data) {
    // Switch Panels with Transition
    switchPanel(calculatorSection, resultsSection);
    heroSection.style.display = "none";

    // 1. Semicircular Gauge Animation
    scoreVal.textContent = "0";
    countUp(scoreVal, data.risk_score, 1200);

    // Set semicircle offset (Circumference 283)
    const offset = 283 * (1 - data.risk_score / 100);
    gaugeFill.style.strokeDasharray = "283";
    gaugeFill.style.strokeDashoffset = "283"; // Start empty

    setTimeout(() => {
      gaugeFill.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(0.25, 1, 0.5, 1)';
      gaugeFill.style.strokeDashoffset = offset;
    }, 300);

    // Set Risk Badge Color Class
    riskBadge.className = "badge-risk";
    if (data.risk_level === "LOW") {
      riskBadge.classList.add("low");
      riskBadge.textContent = "LOW RISK";
      gaugeFill.style.stroke = "var(--color-risk-low)";
    } else if (data.risk_level === "MODERATE") {
      riskBadge.classList.add("moderate");
      riskBadge.textContent = "MODERATE RISK";
      gaugeFill.style.stroke = "var(--color-risk-moderate)";
    } else {
      riskBadge.classList.add("high");
      riskBadge.textContent = "HIGH RISK";
      gaugeFill.style.stroke = "var(--color-risk-high)";
    }

    scoreExplanation.textContent = data.score_explanation;

    // 2. Count-Up Savings Metrics (Triggered with 600ms delays)
    setTimeout(() => {
      countUp(litersSavedVal, data.estimated_daily_savings_liters, 1200, '');
      countUp(inrSavedVal, data.estimated_monthly_bill_savings_inr, 1400, '');
    }, 600);

    // 3. Staggered Bento Cards Fade-In
    revealBentoCards();

    // 4. Personalized Recommendations Tips
    tipsListContainer.innerHTML = "";
    data.tips.forEach((tip, idx) => {
      const tipRow = document.createElement("div");
      tipRow.className = "tip-item";

      const svgPath = getSvgIconForTip(tip.title, tip.description);

      // Clean up liters saved text
      let cleanLiters = (tip.liters_saved || "").trim();
      cleanLiters = cleanLiters.replace(/^(approximately|approx\.?|about)\s+/i, "");
      cleanLiters = cleanLiters.replace(/^[-~\s]+/g, "");
      
      // If it doesn't specify the time period or unit format (like "/day", "/week", "/wash", "per", "load"), append "L/day"
      if (!cleanLiters.includes("/") && !cleanLiters.toLowerCase().includes("per") && !cleanLiters.toLowerCase().includes("load")) {
        const numMatch = cleanLiters.match(/[\d\s-–]+/);
        const amount = numMatch ? numMatch[0].trim() : cleanLiters;
        cleanLiters = `${amount} L/day`;
      }
      
      // If it doesn't have "L" or "liters", make sure it says e.g. "160 L/wash" instead of "160/wash"
      if (!cleanLiters.toUpperCase().includes("L") && !cleanLiters.toLowerCase().includes("liter")) {
        cleanLiters = cleanLiters.replace(/(\/\w+)/, " L$1");
      }
      
      const badgeText = `Saves ~${cleanLiters}`;

      tipRow.innerHTML = `
        <div class="tip-number">${idx + 1}</div>
        <div class="tip-content-box">
          <div class="tip-title-row">
            <h4 class="tip-title">${tip.title}</h4>
            <div>
              <span class="tip-impact">${badgeText}</span>
            </div>
          </div>
          <p class="tip-desc">${tip.description}</p>
        </div>
      `;
      tipsListContainer.appendChild(tipRow);
    });

    // 5. Timeline checklist
    renderTimelineChecklist(data.weekly_plan);
  }

  // Count Up Numerical Values
  function countUp(element, target, duration = 1200, prefix = '') {
    let start = 0;
    const step = timestamp => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      element.textContent = prefix + Math.floor(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Bento Staggered reveal
  function revealBentoCards() {
    const cards = document.querySelectorAll('.bento-card');
    cards.forEach((card, i) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      setTimeout(() => {
        card.style.transition = 'opacity 0.6s ease, transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, 100 + (i * 120));
    });
  }

  function getSvgIconForTip(title, desc) {
    const text = (title + " " + desc).toLowerCase();
    if (text.includes("shower") || text.includes("bath") || text.includes("bucket")) {
      return `<path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-11-7-11S5 10.7 5 15a7 7 0 0 0 7 7z"/>`;
    }
    if (text.includes("tap") || text.includes("faucet") || text.includes("brush") || text.includes("leak")) {
      return `<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`;
    }
    if (text.includes("wash") || text.includes("machine") || text.includes("laundry") || text.includes("load")) {
      return `<rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><circle cx="12" cy="12" r="4"/><path d="M12 10a2 2 0 1 0 0 4"/>`;
    }
    if (text.includes("dish") || text.includes("utensil") || text.includes("sink")) {
      return `<circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/>`;
    }
    if (text.includes("garden") || text.includes("plant") || text.includes("water plants") || text.includes("watering")) {
      return `<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 14V8M8 12h8"/>`;
    }
    if (text.includes("tank") || text.includes("overflow") || text.includes("sensor") || text.includes("valve")) {
      return `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`;
    }
    return `<path d="M9 21h6M9 18h6M10 15c-1.5-1.5-2-3.2-2-5a4 4 0 1 1 8 0c0 1.8-.5 3.5-2 5M12 22V15"/>`;
  }

  function renderTimelineChecklist(weeklyPlan) {
    timelineContainer.innerHTML = "";
    weeklyPlan.forEach((plan, index) => {
      const card = document.createElement("div");
      card.className = "timeline-item";
      if (activeTimelineChecklist[index]) {
        card.classList.add("completed");
      }

      // Convert "Day 1", "Day 2" to numeric
      const dayNumStr = plan.day.replace(/[^\d]/g, "");

      card.innerHTML = `
        <div class="day-marker">
          <div class="day-label">Day</div>
          <div class="day-number">${dayNumStr || (index + 1)}</div>
        </div>
        <div class="timeline-task">${plan.task}</div>
        <div class="timeline-checkbox ${activeTimelineChecklist[index] ? 'checked' : ''}" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      `;

      card.addEventListener("click", () => {
        activeTimelineChecklist[index] = !activeTimelineChecklist[index];
        
        const checkbox = card.querySelector(".timeline-checkbox");
        if (activeTimelineChecklist[index]) {
          card.classList.add("completed");
          checkbox.classList.add("checked");
        } else {
          card.classList.remove("completed");
          checkbox.classList.remove("checked");
        }

        localStorage.setItem("aquasense_checklist", JSON.stringify(activeTimelineChecklist));
        checkAllCompleted();
      });

      timelineContainer.appendChild(card);
    });

    checkAllCompleted();
  }

  function checkAllCompleted() {
    const allCompleted = activeTimelineChecklist.length > 0 && activeTimelineChecklist.every(val => val === true);
    if (allCompleted) {
      completionBanner.style.display = "block";
    } else {
      completionBanner.style.display = "none";
    }
  }

  function checkProgressChecklist() {
    const historicalResult = localStorage.getItem("aquasense_last_result");
    const historicalChecklist = localStorage.getItem("aquasense_checklist");
    
    if (historicalResult) {
      cachedResponseData = JSON.parse(historicalResult);
      if (historicalChecklist) {
        activeTimelineChecklist = JSON.parse(historicalChecklist);
      }
      
      // Render immediately
      heroSection.style.display = "none";
      calculatorSection.style.display = "none";
      resultsSection.style.display = "block";
      renderDashboard(cachedResponseData);
    } else {
      updateWizardUI();
    }
  }

  // --- RECALCULATE TRIGGER ---
  recalculateBtn.addEventListener("click", () => {
    localStorage.removeItem("aquasense_last_result");
    localStorage.removeItem("aquasense_checklist");
    cachedResponseData = null;
    activeTimelineChecklist = Array(7).fill(false);

    // Swap panels with transitions
    switchPanel(resultsSection, calculatorSection);
    setTimeout(() => {
      heroSection.style.display = "block";
      heroSection.classList.add("entering");
      heroSection.offsetHeight;
      heroSection.classList.remove("entering");
    }, 400);

    currentStep = 1;
    updateWizardUI();
    
    // reset form input ranges fill property
    const sliders = [householdCountInput, showerDurationInput, washingMachineInput, carWashingInput];
    sliders.forEach(slider => {
      const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
      slider.style.setProperty('--slider-fill', `${pct}%`);
    });

    calculatorCard.scrollIntoView({ behavior: "smooth" });
  });

});

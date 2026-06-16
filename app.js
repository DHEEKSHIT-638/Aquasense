const EMBEDDED_API_KEY = ""; // Paste your API key here or enter it when prompted in the browser

document.addEventListener("DOMContentLoaded", () => {
  // --- STATE VARIABLES ---
  let currentStep = 1;
  const totalSteps = 5;
  let activeTimelineChecklist = Array(7).fill(false);
  let cachedResponseData = null;

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
  let rippleAnimId = null;
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
        ctx.strokeStyle = `rgba(91, 163, 192, ${rip.alpha})`;
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
    window.addEventListener("unload", () => {
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
  let loaderInterval = null;
  let currentY = 115;
  let loaderPhase = "filling";
  let loadingPhrasesInterval = null;

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

  // --- GEMINI API INTEGRATION ---
  async function submitWizardData() {
    let endpoint;
    const localApiKey = localStorage.getItem("gemini_api_key") || EMBEDDED_API_KEY;

    if (localApiKey) {
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${localApiKey}`;
    } else if (window.location.protocol === "file:" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      const userKey = prompt("Local Development: Please paste your Gemini API Key to run calculations (it will be saved only in your browser's local storage):");
      if (userKey && userKey.trim()) {
        localStorage.setItem("gemini_api_key", userKey.trim());
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${userKey.trim()}`;
      } else {
        showToast("API Key is required to run local calculations.", "error");
        return;
      }
    } else {
      endpoint = "/api/gemini";
    }

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

    updateLoaderStatus("Consulting IS 1172 standards & regional policies...");
    startLoader();

    const systemPrompt = `You are AquaSense, an expert AI water conservation advisor trained on:
- World Health Organization (WHO) basic domestic water access guidelines (minimum 50-100 liters per capita daily).
- United Nations Sustainable Development Goal (SDG) 6 targets (specifically Target 6.4 regarding water use efficiency).
- Bureau of Indian Standards (BIS) IS 1172:1993 domestic water supply standard, which specifies 135 liters per capita per day (lpcd) for residential buildings with full piping in Indian cities.
- Municipal water shortage limits and water pricing tariff slabs of Indian tier 1 and tier 2 cities.

Analyze the user's household water usage data relative to these standard benchmarks. Keep in mind that Indian households face specific challenges like water tankers, summer shortages, and high billing tier jumps.

Formulate a detailed water waste assessment containing:
1. A risk classification (LOW/MODERATE/HIGH) based on average household per capita consumption.
2. A waste risk score out of 100 (where 0 means highly conservationist, 100 means extreme leakage and waste).
3. A 2-line concise and punchy explanation of the score.
4. Exactly 5 highly personalized, specific, actionable water-saving tips mapped to their answers. Do not output generic advice.
5. A 7-day action plan containing one concrete, incremental task per day to resolve their waste issues.
6. Combined daily water savings in liters.
7. Estimated monthly bill savings in INR if they complete the tips.

Ensure your entire output strictly conforms to the requested JSON response schema. No markdown formatting, no comments, no surrounding wrappers. Return ONLY a valid JSON string.`;

    const userPrompt = `Here is the user household usage JSON data to analyze:
${JSON.stringify(userData, null, 2)}`;

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
              "risk_level": { "type": "STRING", "enum": ["LOW", "MODERATE", "HIGH"] },
              "risk_score": { "type": "INTEGER" },
              "score_explanation": { "type": "STRING" },
              "tips": {
                "type": "ARRAY",
                "items": {
                  "type": "OBJECT",
                  "properties": {
                    "tip_number": { "type": "INTEGER" },
                    "title": { "type": "STRING" },
                    "description": { "type": "STRING" },
                    "liters_saved": { "type": "STRING" }
                  },
                  "required": ["tip_number", "title", "description", "liters_saved"]
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
            "required": ["risk_level", "risk_score", "score_explanation", "tips", "weekly_plan", "estimated_daily_savings_liters", "estimated_monthly_bill_savings_inr"]
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
      const parsedJson = JSON.parse(rawText);

      cachedResponseData = parsedJson;
      activeTimelineChecklist = Array(7).fill(false);
      localStorage.setItem("aquasense_last_result", JSON.stringify(parsedJson));
      localStorage.setItem("aquasense_checklist", JSON.stringify(activeTimelineChecklist));

      await completeLoaderAnimation();

      stopLoader();
      renderDashboard(parsedJson);
      startButtonCooldown();
      showToast("Water footprint analyzed successfully!", "success");

    } catch (error) {
      console.error("API Call Error:", error);
      stopLoader();
      
      let friendlyMessage = error.message;
      if (friendlyMessage.includes("Max API connection retries") || friendlyMessage.includes("429") || friendlyMessage.includes("503")) {
        friendlyMessage = "The server is temporarily busy or rate-limited. Please wait a moment and click calculate again to retry.";
      }
      showToast(`Analysis Failed: ${friendlyMessage}`, "error");
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
      const numMatch = cleanLiters.match(/[\d\s-–]+/);
      let amount = numMatch ? numMatch[0].trim() : cleanLiters;
      amount = amount.replace(/\s*(liters|litres|l|ltr|ltrs|L)\b/i, "");
      const badgeText = `Saves ~${amount} L/day`;

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

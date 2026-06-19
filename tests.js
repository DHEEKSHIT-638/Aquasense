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
  tankOverflowLDay: 30, // flat daily baseline
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
      liters_saved: RATES.washingMachineLPerLoad,
      unit: "L/load (≈" + Math.round(RATES.washingMachineLPerLoad / 7) + " L/day)"
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

const goldenCases = [
  {
    inputs: {
      householdCount: 4,
      showerDurationMinutesPerPerson: 8,
      tapsLeftRunningDuringBrushing: "no",
      washingMachineUsesPerWeek: 4,
      dishwashingMethod: "hand",
      watersGarden: "no",
      gardenWateringMinutesPerDay: 0,
      carWashTimesPerWeek: 1,
      waterTankOverflowAwareness: "no"
    },
    expected: { lpcd: 173.57, riskLevel: "MODERATE", riskScore: 75 }
  },
  {
    inputs: {
      householdCount: 1,
      showerDurationMinutesPerPerson: 0,
      tapsLeftRunningDuringBrushing: "no",
      washingMachineUsesPerWeek: 0,
      dishwashingMethod: "hand",
      watersGarden: "no",
      gardenWateringMinutesPerDay: 0,
      carWashTimesPerWeek: 0,
      waterTankOverflowAwareness: "no"
    },
    expected: { lpcd: 150.00, riskLevel: "MODERATE", riskScore: 56 }
  },
  {
    inputs: {
      householdCount: 15,
      showerDurationMinutesPerPerson: 30,
      tapsLeftRunningDuringBrushing: "yes",
      washingMachineUsesPerWeek: 15,
      dishwashingMethod: "hand",
      watersGarden: "yes",
      gardenWateringMinutesPerDay: 120,
      carWashTimesPerWeek: 7,
      waterTankOverflowAwareness: "yes"
    },
    expected: { lpcd: 527.43, riskLevel: "HIGH", riskScore: 100 }
  },
  {
    inputs: {
      householdCount: 4,
      showerDurationMinutesPerPerson: 5,
      tapsLeftRunningDuringBrushing: "no",
      washingMachineUsesPerWeek: 3,
      dishwashingMethod: "machine",
      watersGarden: "no",
      gardenWateringMinutesPerDay: 0,
      carWashTimesPerWeek: 0,
      waterTankOverflowAwareness: "no"
    },
    expected: { lpcd: 112.32, riskLevel: "MODERATE", riskScore: 26 }
  },
  {
    inputs: {
      householdCount: 4,
      showerDurationMinutesPerPerson: 4,
      tapsLeftRunningDuringBrushing: "no",
      washingMachineUsesPerWeek: 0,
      dishwashingMethod: "machine",
      watersGarden: "no",
      gardenWateringMinutesPerDay: 0,
      carWashTimesPerWeek: 0,
      waterTankOverflowAwareness: "no"
    },
    expected: { lpcd: 93.75, riskLevel: "LOW", riskScore: 11 }
  },
  {
    inputs: {
      householdCount: 4,
      showerDurationMinutesPerPerson: 5,
      tapsLeftRunningDuringBrushing: "no",
      washingMachineUsesPerWeek: 0,
      dishwashingMethod: "machine",
      watersGarden: "no",
      gardenWateringMinutesPerDay: 0,
      carWashTimesPerWeek: 0,
      waterTankOverflowAwareness: "no"
    },
    expected: { lpcd: 103.75, riskLevel: "MODERATE", riskScore: 19 }
  },
  {
    inputs: {
      householdCount: 4,
      showerDurationMinutesPerPerson: 10,
      tapsLeftRunningDuringBrushing: "no",
      washingMachineUsesPerWeek: 0,
      dishwashingMethod: "hand",
      watersGarden: "no",
      gardenWateringMinutesPerDay: 0,
      carWashTimesPerWeek: 0,
      waterTankOverflowAwareness: "no"
    },
    expected: { lpcd: 175.00, riskLevel: "MODERATE", riskScore: 76 }
  },
  {
    inputs: {
      householdCount: 4,
      showerDurationMinutesPerPerson: 11,
      tapsLeftRunningDuringBrushing: "no",
      washingMachineUsesPerWeek: 0,
      dishwashingMethod: "hand",
      watersGarden: "no",
      gardenWateringMinutesPerDay: 0,
      carWashTimesPerWeek: 0,
      waterTankOverflowAwareness: "no"
    },
    expected: { lpcd: 185.00, riskLevel: "HIGH", riskScore: 84 }
  }
];

let failedTests = 0;

console.log("Running AquaSense Arithmetic Regression Tests...");
console.log("-----------------------------------------------");

goldenCases.forEach((tc, idx) => {
  const result = calculateConsumption(tc.inputs);
  const passLpcd = Math.abs(result.lpcd - tc.expected.lpcd) < 0.01;
  const passLevel = result.riskLevel === tc.expected.riskLevel;
  const passScore = result.riskScore === tc.expected.riskScore;

  if (passLpcd && passLevel && passScore) {
    console.log(`✅ Case ${idx + 1}: PASS (LPCD: ${result.lpcd}, Level: ${result.riskLevel}, Score: ${result.riskScore})`);
  } else {
    failedTests++;
    console.error(`❌ Case ${idx + 1}: FAIL`);
    if (!passLpcd) console.error(`   LPCD Expected: ${tc.expected.lpcd}, Got: ${result.lpcd}`);
    if (!passLevel) console.error(`   Level Expected: ${tc.expected.riskLevel}, Got: ${result.riskLevel}`);
    if (!passScore) console.error(`   Score Expected: ${tc.expected.riskScore}, Got: ${result.riskScore}`);
  }
});

// Tip Filtering Assertion
console.log("\nRunning Tip Filtering Assertions...");
const conservationistInputs = {
  householdCount: 4,
  showerDurationMinutesPerPerson: 5,
  tapsLeftRunningDuringBrushing: "no",
  washingMachineUsesPerWeek: 0,
  dishwashingMethod: "machine",
  watersGarden: "no",
  gardenWateringMinutesPerDay: 0,
  carWashTimesPerWeek: 0,
  waterTankOverflowAwareness: "no"
};

const tipsResult = getApplicableTips(conservationistInputs);
const forbiddenKeys = ["turn_off_tap", "bucket_dishwashing", "garden_drip", "fix_tank_overflow"];
const hasForbidden = tipsResult.some(t => forbiddenKeys.includes(t.key));

if (!hasForbidden) {
  console.log("✅ Tip Filtering PASS (No irrelevant tips shown for conservationist household)");
} else {
  failedTests++;
  console.error("❌ Tip Filtering FAIL (Irrelevant tips found):", tipsResult);
}

console.log("-----------------------------------------------");
if (failedTests === 0) {
  console.log("ALL TESTS COMPLETED SUCCESSFULLY! 🎉");
  process.exit(0);
} else {
  console.error(`${failedTests} tests failed.`);
  process.exit(1);
}

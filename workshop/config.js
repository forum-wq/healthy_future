/* ============================================================
   REFORMA 3.3 — SteerCo Decision Workshop
   config.js — verejná konfigurácia (smie byť v public repe).
   Po nasadení GAS Web App sem vlož jeho /exec URL.
   Endpoint je verejný, ale každá akcia vyžaduje platný PIN.
   ============================================================ */
window.WORKSHOP_CONFIG = {
  // Deploy → New deployment → Web app → skopíruj URL končiacu na /exec
  GAS_URL: "https://script.google.com/macros/s/AKfycbzaPMFb6aFojSi-ZpJsfsJLnJ_1ipuyTU07Tfn3ZQeWh2zoU-mQ1b3F8M47Guj0qbXl/exec",
  // hlasovací round — oddeľuje nový balík (25 bodov) od starého roundu 2026-06-09 (verejná, necitlivá hodnota)
  ROUND_ID: "2026-06-17-final25"
};

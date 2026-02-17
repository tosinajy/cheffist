(function () {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const seenKey = "email_exit_intent_seen";
  let shown = sessionStorage.getItem(seenKey) === "1";

  function showCapturePrompt() {
    if (shown) return;
    const target = document.querySelector("[data-email-exit-intent-target]");
    if (!target) return;
    shown = true;
    sessionStorage.setItem(seenKey, "1");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    const firstInput = target.querySelector("input[name='name']");
    if (firstInput) {
      firstInput.focus({ preventScroll: true });
    }
  }

  document.addEventListener("mouseout", function onMouseOut(event) {
    if (!event || typeof event.clientY !== "number") return;
    if (event.clientY <= 0) {
      showCapturePrompt();
    }
  });
})();

import {
  awardChallenge,
  awardDailyCompletion,
  challengeCopy,
  challengeDayKey,
  CHALLENGES,
  dailyChallengeForDate,
  levelFromXp,
  normalizeChallengeProgress,
  verifyChallenge
} from "../modules/challenges.js";
import { loadChallengeProgress, STORAGE_KEYS, writeStoredJson } from "../modules/project-store.js";

export function createChallengeController(deps) {
  const {
    $, state, t, challengeUi, resetProject, updateColorUi,
    render, compositeFrame, showToast
  } = deps;
  const previewTimers = new Set();

  function stopChallengePreviews() {
    previewTimers.forEach((timer) => clearInterval(timer));
    previewTimers.clear();
  }

  function challengeProgress() {
    return loadChallengeProgress(normalizeChallengeProgress);
  }
  
  function saveChallengeProgress(progress) {
    writeStoredJson(STORAGE_KEYS.challenges, progress);
  }
  
  function rankName(level) {
    const ranks = challengeUi("ranks");
    return level >= 5 ? ranks[3] : level >= 3 ? ranks[2] : level >= 2 ? ranks[1] : ranks[0];
  }
  
  function renderChallengeProfile(progress = challengeProgress()) {
    const level = levelFromXp(progress.xp);
    $("#challengePlayerLevel").textContent = level.level;
    $("#challengeRankName").textContent = rankName(level.level);
    $("#challengeXpLabel").value = `${level.current} / ${level.target}`;
    $("#challengeXpBar").style.width = `${level.progress * 100}%`;
    $("#challengeStreak").textContent = progress.streak;
  }
  
  function renderDailyChallenge(progress = challengeProgress()) {
    const host = $("#dailyChallenge");
    if (!host) return;
    const today = challengeDayKey();
    const challenge = dailyChallengeForDate();
    const copy = challengeCopy(challenge, state.language);
    const completed = Boolean(progress.daily.completed[today]);
    host.classList.toggle("completed", completed);
    host.innerHTML = "";
  
    const preview = document.createElement("canvas");
    drawChallengeTemplate(preview, challenge, challenge.frameTemplates?.[0] || challenge.template);
    const copyBlock = document.createElement("div");
    const eyebrow = document.createElement("span");
    eyebrow.textContent = `${t("dailyChallenge")} · +50 XP`;
    const title = document.createElement("strong");
    title.textContent = copy.title;
    const detail = document.createElement("small");
    detail.textContent = completed
      ? `${t("dailyDone")} · ${progress.daily.streak} ${t("dailyStreak")}`
      : `${t("dailyBonus")} · ${copy.subtitle}`;
    copyBlock.append(eyebrow, title, detail);
    const start = document.createElement("button");
    start.type = "button";
    start.textContent = completed ? challengeUi("retry") : t("startChallenge");
    start.addEventListener("click", () => startChallenge(challenge, { dailyDate: today }));
    host.append(preview, copyBlock, start);
  }
  
  function drawChallengeTemplate(surface, challenge, template = challenge.template) {
    surface.width = challenge.width;
    surface.height = challenge.height;
    const context = surface.getContext("2d");
    context.clearRect(0, 0, surface.width, surface.height);
    context.putImageData(new ImageData(new Uint8ClampedArray(template), challenge.width, challenge.height), 0, 0);
  }
  
  function renderChallengeList() {
    const host = $("#challengeList");
    if (!host) return;
    stopChallengePreviews();
    const progress = challengeProgress();
    renderChallengeProfile(progress);
    renderDailyChallenge(progress);
    const completedCount = CHALLENGES.filter((challenge) => progress.completed[challenge.id]).length;
    const nextChallenge = CHALLENGES.find((challenge) => !progress.completed[challenge.id]);
    $("#challengeCourseProgress").value = `${completedCount} / ${CHALLENGES.length}`;
    $("#challengeCourseBar").style.width = `${completedCount / CHALLENGES.length * 100}%`;
    host.innerHTML = "";
    CHALLENGES.forEach((challenge) => {
      const copy = challengeCopy(challenge, state.language);
      const completion = progress.completed[challenge.id];
      const card = document.createElement("article");
      const recommended = nextChallenge?.id === challenge.id;
      card.className = `challenge-card${completion ? " completed" : ""}${recommended ? " recommended" : ""}`;
      const reward = document.createElement("span");
      reward.className = "challenge-card-reward";
      reward.textContent = completion ? `★ ${completion.bestScore}%` : `+${challenge.reward} XP`;
      const preview = document.createElement("div");
      preview.className = "challenge-preview";
      const templates = challenge.frameTemplates || [challenge.template];
      const template = document.createElement("canvas");
      drawChallengeTemplate(template, challenge, templates[0]);
      preview.append(template);
      const frameBadge = document.createElement("span");
      frameBadge.className = "challenge-preview-frames";
      frameBadge.textContent = templates.length > 1
        ? `▶ 1 / ${templates.length}`
        : `1 ${t("frameLabel")}`;
      preview.append(frameBadge);
      if (templates.length > 1) {
        preview.classList.add("animated");
        let frameIndex = 0;
        const timer = setInterval(() => {
          if (!preview.isConnected || !$("#challengesDialog").open) return;
          frameIndex = (frameIndex + 1) % templates.length;
          drawChallengeTemplate(template, challenge, templates[frameIndex]);
          frameBadge.textContent = `▶ ${frameIndex + 1} / ${templates.length}`;
        }, 520);
        previewTimers.add(timer);
      }
      const meta = document.createElement("div");
      meta.className = "challenge-card-meta";
      meta.innerHTML = `<span>${challengeUi("level")} ${challenge.level}</span><span class="challenge-free">${completion ? t("completed") : recommended ? t("recommended") : t("free")}</span>`;
      const title = document.createElement("h3");
      title.textContent = copy.title;
      const description = document.createElement("p");
      description.textContent = copy.subtitle;
      const rules = document.createElement("div");
      rules.className = "challenge-rules";
      copy.rules.filter((_, index) => index > 0).slice(0, 2).forEach((rule) => {
        const item = document.createElement("span");
        item.textContent = rule;
        rules.append(item);
      });
      const start = document.createElement("button");
      start.className = "challenge-start";
      start.textContent = completion ? challengeUi("retry") : t("startChallenge");
      start.addEventListener("click", () => startChallenge(challenge));
      card.append(reward, preview, meta, title, description, rules, start);
      host.append(card);
    });
  }
  
  function renderChallengeRunner() {
    const runner = $("#challengeRunner");
    if (!runner) return;
    const challenge = state.activeChallenge;
    runner.closest(".canvas-stage").classList.toggle("challenge-active", Boolean(challenge));
    runner.hidden = !challenge;
    if (!challenge) return;
    const copy = challengeCopy(challenge, state.language);
    const targetFrame = challenge.frameTemplates?.[Math.min(state.activeFrame, challenge.frameTemplates.length - 1)] || challenge.template;
    drawChallengeTemplate($("#challengeReference"), challenge, targetFrame);
    $("#challengeLevel").textContent = `${challengeUi("challenge")} ${challenge.level} / ${CHALLENGES.length}`;
    $("#challengeTitle").textContent = copy.title;
    $("#challengeGoal").textContent = challenge.frameTemplates
      ? `${challengeUi("currentFrame")} ${Math.min(state.activeFrame + 1, challenge.frameTemplates.length)} / ${challenge.frameTemplates.length}`
      : copy.subtitle;
    const guide = $("#challengeFrameGuide");
    guide.hidden = !challenge.frameTemplates;
    guide.innerHTML = "";
    challenge.frameTemplates?.forEach((template, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = index === state.activeFrame ? "active" : "";
      button.title = `${challengeUi("frame")} ${index + 1}`;
      const canvas = document.createElement("canvas");
      drawChallengeTemplate(canvas, challenge, template);
      const number = document.createElement("b");
      number.textContent = index + 1;
      button.append(canvas, number);
      button.addEventListener("click", () => {
        state.referenceFrame = index;
        openChallengeReference();
      });
      guide.append(button);
    });
  }
  
  function renderLargeChallengeReference() {
    const challenge = state.activeChallenge;
    if (!challenge) return;
    const surface = $("#largeChallengeReference");
    const template = challenge.frameTemplates?.[state.referenceFrame] || challenge.template;
    drawChallengeTemplate(surface, challenge, template);
    const displayWidth = challenge.width * state.referenceZoom;
    const displayHeight = challenge.height * state.referenceZoom;
    surface.style.width = `${displayWidth}px`;
    surface.style.height = `${displayHeight}px`;
    surface.style.backgroundSize = `${state.referenceZoom * 2}px ${state.referenceZoom * 2}px`;
    surface.style.backgroundPosition = `0 0, 0 ${state.referenceZoom}px, ${state.referenceZoom}px -${state.referenceZoom}px, -${state.referenceZoom}px 0`;
  
    const grid = $("#challengeReferenceGrid");
    const ratio = window.devicePixelRatio || 1;
    grid.width = Math.round(displayWidth * ratio);
    grid.height = Math.round(displayHeight * ratio);
    grid.style.width = `${displayWidth}px`;
    grid.style.height = `${displayHeight}px`;
    const context = grid.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, displayWidth, displayHeight);
    grid.hidden = !$("#referenceGridVisible").checked;
    if (!grid.hidden) {
      context.beginPath();
      context.strokeStyle = "rgba(12, 11, 14, .48)";
      context.lineWidth = 1;
      for (let x = state.referenceZoom; x < displayWidth; x += state.referenceZoom) {
        context.moveTo(x + .5, 0);
        context.lineTo(x + .5, displayHeight);
      }
      for (let y = state.referenceZoom; y < displayHeight; y += state.referenceZoom) {
        context.moveTo(0, y + .5);
        context.lineTo(displayWidth, y + .5);
      }
      context.stroke();
    }
    $("#referenceZoomRange").value = state.referenceZoom;
    $("#referenceZoomValue").value = `${state.referenceZoom}×`;
  }
  
  function updateReferenceZoom(value) {
    state.referenceZoom = Math.max(8, Math.min(28, Math.round(Number(value) / 2) * 2 || 16));
    renderLargeChallengeReference();
  }
  
  function fitReferenceZoom() {
    const wrap = $(".reference-canvas-wrap");
    const challenge = state.activeChallenge;
    if (!challenge) return;
    const availableWidth = Math.max(128, wrap.clientWidth - 52);
    const availableHeight = Math.max(128, wrap.clientHeight - 52);
    const fit = Math.floor(Math.min(availableWidth / challenge.width, availableHeight / challenge.height) / 2) * 2;
    updateReferenceZoom(fit);
  }
  
  function openChallengeReference() {
    const challenge = state.activeChallenge;
    if (!challenge) return;
    const copy = challengeCopy(challenge, state.language);
    $("#referenceTitle").textContent = copy.title;
    $("#referenceLevel").textContent = `${challengeUi("challenge")} ${challenge.level} / ${CHALLENGES.length}`;
    $("#referenceDescription").textContent = copy.description;
    const rules = $("#referenceRules");
    rules.innerHTML = "";
    copy.rules.forEach((rule) => {
      const item = document.createElement("span");
      item.textContent = rule;
      rules.append(item);
    });
    const storyboard = $("#referenceStoryboard");
    const buttons = $("#referenceFrameButtons");
    storyboard.hidden = !challenge.frameTemplates;
    buttons.innerHTML = "";
    challenge.frameTemplates?.forEach((template, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = index === state.referenceFrame ? "active" : "";
      const canvas = document.createElement("canvas");
      drawChallengeTemplate(canvas, challenge, template);
      const label = document.createElement("span");
      label.textContent = `${challengeUi("frame")} ${index + 1}`;
      button.append(canvas, label);
      button.addEventListener("click", () => {
        state.referenceFrame = index;
        renderLargeChallengeReference();
        buttons.querySelectorAll("button").forEach((item, buttonIndex) => item.classList.toggle("active", buttonIndex === index));
      });
      buttons.append(button);
    });
    $("#challengeReferenceDialog").showModal();
    requestAnimationFrame(fitReferenceZoom);
  }
  
  function startChallenge(challenge, options = {}) {
    $("#challengesDialog").close();
    resetProject(challenge.width, challenge.height);
    state.activeChallenge = challenge;
    state.activeDailyDate = options.dailyDate || "";
    state.referenceFrame = 0;
    $("#projectName").value = challengeCopy(challenge, state.language).title;
    const startColors = {
      "pixel-heart": "#ed6473",
      "tiny-robot": "#5e9cff",
      "happy-slime": "#5ccda4",
      "pixel-rocket": "#ffffff"
    };
    state.color = startColors[challenge.id] || "#f7d154";
    $("#colorPicker").value = state.color;
    updateColorUi(state.color);
    render();
    showToast(challengeUi("started"));
  }
  
  function challengeFrames() {
    return state.layers[0].frames.map((_, index) => compositeFrame(index).data);
  }
  
  function showChallengeResult(result) {
    let resultBox = $("#challengeResult");
    if (!resultBox) {
      resultBox = document.createElement("div");
      resultBox.id = "challengeResult";
      resultBox.className = "challenge-result";
      resultBox.innerHTML = '<span class="challenge-result-icon"></span><strong></strong><p></p>';
      document.body.append(resultBox);
    }
    const failed = result.checks.filter((check) => !check.passed).map((check) => check.id);
    const labels = {
      similarity: challengeUi("similarity"),
      colors: challengeUi("colors"),
      frames: challengeUi("frames"),
      motion: challengeUi("motion"),
      sequence: challengeUi("sequence")
    };
    resultBox.classList.toggle("failed", !result.passed);
    resultBox.querySelector(".challenge-result-icon").textContent = result.passed ? "✓" : "↻";
    resultBox.querySelector("strong").textContent = result.passed
      ? `${challengeUi("completed")} · ${result.score}%`
      : `${challengeUi("notReady")} · ${result.score}%`;
    resultBox.querySelector("p").textContent = result.passed
      ? challengeUi("saved")
      : `${challengeUi("improve")}: ${failed.map((id) => labels[id]).join(", ")}.`;
    resultBox.classList.add("show");
    clearTimeout(showChallengeResult.timer);
    showChallengeResult.timer = setTimeout(() => resultBox.classList.remove("show"), 5000);
  }
  
  function playVictoryChime() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audio = new AudioContext();
      [523.25, 659.25, 783.99].forEach((frequency, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = "square";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(.035, audio.currentTime + index * .09);
        gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + index * .09 + .16);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(audio.currentTime + index * .09);
        oscillator.stop(audio.currentTime + index * .09 + .17);
      });
      setTimeout(() => audio.close(), 700);
    } catch {
      // Audio is a bonus; visual feedback remains available.
    }
  }
  
  function createPixelConfetti() {
    const host = $("#pixelConfetti");
    const colors = ["#f1c542", "#ed6473", "#5ccda4", "#5e9cff", "#af70e2", "#ffffff"];
    host.innerHTML = "";
    for (let index = 0; index < 52; index += 1) {
      const pixel = document.createElement("i");
      pixel.style.left = `${Math.random() * 100}%`;
      pixel.style.setProperty("--confetti-color", colors[index % colors.length]);
      pixel.style.setProperty("--fall-time", `${1.8 + Math.random() * 1.8}s`);
      pixel.style.setProperty("--fall-delay", `${Math.random() * .7}s`);
      pixel.style.setProperty("--drift", `${-80 + Math.random() * 160}px`);
      host.append(pixel);
    }
  }
  
  function showVictory(result, award) {
    const challenge = state.activeChallenge;
    const copy = challengeCopy(challenge, state.language);
    const progress = award.progress;
    const nextIndex = CHALLENGES.findIndex((item) => item.id === challenge.id) + 1;
    const nextChallenge = CHALLENGES[nextIndex];
    $("#victoryTitle").textContent = copy.title;
    $("#victoryScore").textContent = `${result.score}%`;
    $("#victoryXp").textContent = award.earnedXp ? `+${award.earnedXp} XP` : challengeUi("xpEarned");
    $("#victoryStreak").textContent = `⚡ ${state.activeDailyDate ? progress.daily.streak : progress.streak}`;
    $("#victoryMessage").textContent = award.firstCompletion
      ? challengeUi("newResult")
      : challengeUi("bestUpdated");
    $("#victoryNext").hidden = !nextChallenge;
    $("#victoryNext").dataset.challengeId = nextChallenge?.id || "";
    createPixelConfetti();
    $("#challengeVictory").hidden = false;
    $("#challengeRunner").classList.remove("challenge-success");
    requestAnimationFrame(() => $("#challengeRunner").classList.add("challenge-success"));
    playVictoryChime();
  }
  
  function closeVictory() {
    $("#challengeVictory").hidden = true;
    $("#pixelConfetti").innerHTML = "";
  }
  
  function checkActiveChallenge() {
    if (!state.activeChallenge) return;
    const result = verifyChallenge(state.activeChallenge, challengeFrames());
    if (result.passed) {
      const baseAward = awardChallenge(challengeProgress(), state.activeChallenge, result.score);
      let award = baseAward;
      if (state.activeDailyDate) {
        const dailyAward = awardDailyCompletion(baseAward.progress, state.activeDailyDate, 50);
        award = {
          ...baseAward,
          progress: dailyAward.progress,
          earnedXp: baseAward.earnedXp + dailyAward.earnedXp,
          firstCompletion: baseAward.firstCompletion || dailyAward.firstCompletion
        };
      }
      saveChallengeProgress(award.progress);
      renderChallengeList();
      showVictory(result, award);
      return;
    }
    showChallengeResult(result);
  }
  
  function leaveChallenge() {
    state.activeChallenge = null;
    state.activeDailyDate = "";
    renderChallengeRunner();
    showToast(challengeUi("closed"));
  }

  return {
    renderChallengeList,
    stopChallengePreviews,
    renderChallengeRunner,
    renderLargeChallengeReference,
    updateReferenceZoom,
    fitReferenceZoom,
    openChallengeReference,
    startChallenge,
    checkActiveChallenge,
    leaveChallenge,
    closeVictory
  };
}

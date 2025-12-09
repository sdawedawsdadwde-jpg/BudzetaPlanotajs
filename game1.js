// game1.js — added: touching the maze outer border counts as a collision
// Expects: assets/jumpscare.png and assets/jumpscare.mp3

(() => {
  const maze = document.getElementById('maze');
  const startBtn = document.getElementById('startBtn');
  const startBox = document.getElementById('start');
  const goalBox = document.getElementById('goal');
  const walls = Array.from(document.querySelectorAll('.wall'));
  const collisionsLabel = document.getElementById('collisions');
  const msg = document.getElementById('message');
  const jumpscareOverlay = document.getElementById('jumpscareOverlay');
  const jumpsound = document.getElementById('jumpsound');
  const winOverlay = document.getElementById('winOverlay');
  const winClose = document.getElementById('winClose');

  let playing = false;
  let collisionCount = 0;          // persistent across attempts until jumpscare resets it
  let isInWall = false;           // prevents repeated triggers while cursor stays in wall
  let isOnBorder = false;         // prevents repeated triggers while cursor stays on border
  let startedFromStart = false;   // true once player places cursor on Start after clicking Start

  // Shrink control (unchanged)
  let shrinkTimer = null;
  let currentScale = 1;
  const scaleStep = 0.92;
  const shrinkIntervalMs = 2000;
  const minScale = 0.48;

  // Read base border thickness from computed style (unscaled CSS value)
  const baseBorderWidth = parseFloat(getComputedStyle(maze).borderLeftWidth) || 6;

  function resetHUD() {
    collisionsLabel.textContent = collisionCount;
    msg.textContent = '';
  }

  function showMessage(t, timeout = 1500) {
    msg.textContent = t || '';
    if (timeout && t) {
      setTimeout(() => {
        if (msg.textContent === t) msg.textContent = '';
      }, timeout);
    }
  }

  function flashRed() {
    const flash = document.createElement('div');
    flash.className = 'flash';
    maze.appendChild(flash);
    setTimeout(() => flash.remove(), 450);
  }

  function restartRun(reason) {
    stopShrinking();
    playing = false;
    startedFromStart = false;
    isInWall = false;
    isOnBorder = false;
    currentScale = 1;
    maze.style.transform = `scale(${currentScale})`;
    flashRed();
    showMessage(reason || 'You hit a wall! Click Start to try again.');
    // collisions persistent until jumpscare reset as requested
  }

  function triggerJumpscare() {
    stopShrinking();
    jumpsound.currentTime = 0;
    jumpsound.play().catch(() => { /* may be blocked until user gesture */ });
    jumpscareOverlay.classList.remove('hidden');
    jumpscareOverlay.setAttribute('aria-hidden', 'false');
    playing = false;
    showMessage('JUMPSCARE! Click the image to close.');
  }

  function closeJumpscare() {
    try {
      jumpsound.pause();
      jumpsound.currentTime = 0;
    } catch (e) {}
    jumpscareOverlay.classList.add('hidden');
    jumpscareOverlay.setAttribute('aria-hidden', 'true');
    collisionCount = 0;
    resetHUD();
    currentScale = 1;
    maze.style.transform = `scale(${currentScale})`;
    showMessage('');
  }

  function handleCollision() {
    if (!playing || !startedFromStart) return;
    collisionCount += 1;
    collisionsLabel.textContent = collisionCount;

    if (collisionCount >= 3) {
      triggerJumpscare();
    } else {
      restartRun(`Collision ${collisionCount}. Run restarted.`);
    }
  }

  function handleWin() {
    stopShrinking();
    playing = false;
    startedFromStart = false;
    winOverlay.classList.remove('hidden');
    winOverlay.setAttribute('aria-hidden', 'false');
  }

  function startShrinking() {
    stopShrinking();
    currentScale = 1;
    maze.style.transform = `scale(${currentScale})`;
    shrinkTimer = setInterval(() => {
      currentScale = Math.max(minScale, currentScale * scaleStep);
      maze.style.transform = `scale(${currentScale})`;
      if (currentScale <= minScale + 0.001) {
        stopShrinking();
      }
    }, shrinkIntervalMs);
  }

  function stopShrinking() {
    if (shrinkTimer) {
      clearInterval(shrinkTimer);
      shrinkTimer = null;
    }
  }

  // Helper: element under pointer
  function elementAtPoint(x, y) {
    return document.elementFromPoint(x, y);
  }

  // Helper: check if the pointer is touching the maze outer border (counts as collision)
  function isTouchingMazeBorder(x, y) {
    const rect = maze.getBoundingClientRect();
    // border in viewport pixels scales with transform, so compute scaled border
    const scaledBorder = baseBorderWidth * currentScale;
    // if pointer is outside bounding rect, that's a leave (separately handled)
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return false;
    // inside rect -> check if within the border area
    if (x <= rect.left + scaledBorder + 0.5 ||
        x >= rect.right - scaledBorder - 0.5 ||
        y <= rect.top + scaledBorder + 0.5 ||
        y >= rect.bottom - scaledBorder - 0.5) {
      return true;
    }
    return false;
  }

  // Robust pointer tracking:
  // - Use elementFromPoint to detect walls/goal/start even when maze is transformed.
  // - If the element under pointer isn't inside #maze, treat as "left the maze".
  // - If pointer is inside maze but within the outer border area, count a collision.
  maze.addEventListener('mousemove', (e) => {
    if (!playing) return;

    const x = e.clientX;
    const y = e.clientY;
    const el = elementAtPoint(x, y);

    // If we haven't started from Start yet, require pointer to be over start.
    if (!startedFromStart) {
      if (el && (el === startBox || (el.closest && el.closest('.start')))) {
        startedFromStart = true;
        showMessage('Good — run started! Maze will shrink. Move carefully.');
        startShrinking();
      } else {
        // still waiting for player to move cursor over Start
        return;
      }
    }

    // If pointer is not over any element or not inside the maze, consider it a leave
    if (!el || !(el.closest && el.closest('#maze'))) {
      if (playing && startedFromStart) {
        restartRun('Cursor left the maze. Run restarted.');
      }
      return;
    }

    // If pointer is on goal
    if (el === goalBox || (el.closest && el.closest('.goal'))) {
      handleWin();
      return;
    }

    // If pointer is on any wall
    if (el.classList && el.classList.contains('wall')) {
      if (!isInWall) {
        isInWall = true;
        isOnBorder = false;
        handleCollision();
      }
      return;
    } else {
      isInWall = false;
    }

    // Check border-touch collision (outer maze border)
    if (isTouchingMazeBorder(x, y)) {
      if (!isOnBorder) {
        isOnBorder = true;
        isInWall = false;
        handleCollision();
      }
      return;
    } else {
      isOnBorder = false;
    }

    // else, normal empty area inside maze — nothing to do
  });

  // Keep mouseleave as an additional fallback
  maze.addEventListener('mouseleave', () => {
    if (playing && startedFromStart) {
      restartRun('Cursor left the maze. Run restarted.');
    }
  });

  // Start button
  startBtn.addEventListener('click', () => {
    playing = true;
    isInWall = false;
    isOnBorder = false;
    startedFromStart = false;
    showMessage('Game started! Place your cursor over the Start box to begin. Maze will shrink while you move.');
    resetHUD();
    currentScale = 1;
    maze.style.transform = `scale(${currentScale})`;
  });

  // Jumpscare overlay close on click
  jumpscareOverlay.addEventListener('click', () => {
    closeJumpscare();
  });

  // Win overlay close
  winClose.addEventListener('click', () => {
    winOverlay.classList.add('hidden');
    winOverlay.setAttribute('aria-hidden', 'true');
    collisionCount = 0;
    resetHUD();
    currentScale = 1;
    maze.style.transform = `scale(${currentScale})`;
    showMessage('');
  });

  // initialize HUD
  resetHUD();

  // Stop shrinking when page hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopShrinking();
  });
})();
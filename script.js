/**
 * ============================================================
 * 🌌 ANTIGRAVITY COSMIC MAZE ESCAPE (무중력 미로 탈출)
 * ============================================================
 * 
 * [학습 포인트 및 알고리즘 설명]
 * 1. 미로 생성 알고리즘: 깊이 우선 탐색(DFS / Recursive Backtracker)
 *    - 모든 방을 한 번씩 방문하며 유일한 탈출 경로를 가진 완벽한 미로(Perfect Maze)를 생성합니다.
 * 2. 최단 경로 탐색: 너비 우선 탐색(BFS / Breadth-First Search)
 *    - 힌트 기능 구현 시, 플레이어 위치에서 출구까지의 최단 탈출 경로를 계산합니다.
 * 3. 이동 모드:
 *    - 일반 모드: 방향키 1번에 1칸 정밀 이동
 *    - 반중력 모드: 우주 무중력 상태처럼 벽에 부딪힐 때까지 쭉 미끄러지는 관성 이동
 * 4. 사운드: 외부 파일 없이 브라우저 Web Audio API 오실레이터로 실시간 합성
 * ============================================================
 */

// --- 1. 전역 상태 및 DOM 요소 참조 ---
const canvas = document.getElementById('mazeCanvas');
const ctx = canvas.getContext('2d');

const difficultySelect = document.getElementById('difficultySelect');
const modeToggle = document.getElementById('modeToggle');
const modeIcon = document.getElementById('modeIcon');
const modeText = document.getElementById('modeText');
const fogToggle = document.getElementById('fogToggle');
const fogIcon = document.getElementById('fogIcon');
const soundToggle = document.getElementById('soundToggle');
const hintBtn = document.getElementById('hintBtn');
const resetBtn = document.getElementById('resetBtn');

const timerText = document.getElementById('timerText');
const stepText = document.getElementById('stepText');
const bestRecordText = document.getElementById('bestRecordText');

const winModal = document.getElementById('winModal');
const finalTime = document.getElementById('finalTime');
const finalSteps = document.getElementById('finalSteps');
const finalMode = document.getElementById('finalMode');
const modalNextBtn = document.getElementById('modalNextBtn');

// 터치 D-Pad 버튼
const btnUp = document.getElementById('btnUp');
const btnDown = document.getElementById('btnDown');
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');

// 게임 설정 및 상태 객체
const gameState = {
  gridSize: 23,            // 미로 크기 (홀수여야 함)
  maze: [],                // 0: 벽, 1: 길
  player: { x: 1, y: 1 },  // 플레이어 좌표
  goal: { x: 21, y: 21 },  // 도착 포탈 좌표
  isAntiGravity: true,     // true: 관성 슬라이드 모드, false: 1칸씩 이동 모드
  isFogOfWar: false,       // 시야 제한 안개 모드
  isSoundOn: true,         // 효과음 활성화 여부
  showHint: false,         // 최단 경로 힌트 표시 여부
  hintPath: [],            // BFS로 구한 최단 경로 좌표 목록
  steps: 0,                // 이동 횟수
  timerSeconds: 0,         // 소요 시간(초)
  timerInterval: null,     // 타이머 인터벌
  isGameWon: false,        // 승리 여부
  isSliding: false,        // 슬라이드 애니메이션 중 여부
  cellSize: 0,             // 캔버스 내 1칸 크기(px)
  particles: [],           // 클리어 축하 파티클
  trail: []                // 플레이어 궤적 잔상
};

// --- 2. Web Audio API 신디사이저 (효과음 생성기) ---
class SoundManager {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 기본 단음 생성 (주파수, 지속시간, 파형)
  playTone(freq, duration = 0.08, type = 'sine', volume = 0.15) {
    if (!gameState.isSoundOn) return;
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // 오디오 컨텍스트 정책 예외 처리
    }
  }

  // 발자국 / 일반 이동음
  playMove() {
    this.playTone(320, 0.05, 'triangle', 0.1);
  }

  // 무중력 부스터/슬라이드 음
  playSlide() {
    if (!gameState.isSoundOn) return;
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch (e) {}
  }

  // 벽 충돌 음
  playBump() {
    this.playTone(110, 0.08, 'square', 0.15);
  }

  // 승리 팡파레 (아르페지오)
  playWin() {
    if (!gameState.isSoundOn) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 0.25, 'triangle', 0.2);
      }, idx * 100);
    });
  }
}

const sounds = new SoundManager();

// --- 3. 미로 생성 알고리즘 (DFS Recursive Backtracking) ---
function generateMaze(size) {
  // 1: 길(Passage), 0: 벽(Wall)
  // 모든 셀을 처음엔 벽(0)으로 초기화
  const maze = Array.from({ length: size }, () => Array(size).fill(0));

  // 시작점 (1, 1) 설정
  maze[1][1] = 1;
  const stack = [{ x: 1, y: 1 }];

  // 상하좌우 2칸 이동 방향
  const directions = [
    { dx: 0, dy: -2 },
    { dx: 0, dy: 2 },
    { dx: -2, dy: 0 },
    { dx: 2, dy: 0 }
  ];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    
    // 무작위로 섞은 방향 목록
    const shuffledDirs = [...directions].sort(() => Math.random() - 0.5);
    let found = false;

    for (const dir of shuffledDirs) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;

      // 미로 경계 내부이고, 아직 방문하지 않은 벽(0)인 경우
      if (nx > 0 && nx < size - 1 && ny > 0 && ny < size - 1 && maze[ny][nx] === 0) {
        // 벽을 뚫어 길로 만듦
        maze[current.y + dir.dy / 2][current.x + dir.dx / 2] = 1;
        maze[ny][nx] = 1;
        stack.push({ x: nx, y: ny });
        found = true;
        break;
      }
    }

    // 막다른 길에 도달하면 스택에서 되돌아가기(Backtrack)
    if (!found) {
      stack.pop();
    }
  }

  // 출구는 가장 먼 오른쪽 아래 구석 근처 길로 설정
  const goalX = size - 2;
  const goalY = size - 2;
  maze[goalY][goalX] = 1;

  return { maze, goal: { x: goalX, y: goalY } };
}

// --- 4. 최단 경로 탐색 알고리즘 (BFS) - 힌트 기능 ---
function findShortestPath(maze, start, goal) {
  const size = maze.length;
  const visited = Array.from({ length: size }, () => Array(size).fill(false));
  const queue = [{ x: start.x, y: start.y, path: [] }];
  visited[start.y][start.x] = true;

  const dirs = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 }
  ];

  while (queue.length > 0) {
    const { x, y, path } = queue.shift();

    if (x === goal.x && y === goal.y) {
      return [...path, { x, y }];
    }

    for (const d of dirs) {
      const nx = x + d.dx;
      const ny = y + d.dy;

      if (nx >= 0 && nx < size && ny >= 0 && ny < size && maze[ny][nx] === 1 && !visited[ny][nx]) {
        visited[ny][nx] = true;
        queue.push({
          x: nx,
          y: ny,
          path: [...path, { x, y }]
        });
      }
    }
  }

  return [];
}

// --- 5. 게임 초기화 및 재시작 ---
function initGame() {
  gameState.gridSize = parseInt(difficultySelect.value, 10);
  const generated = generateMaze(gameState.gridSize);
  gameState.maze = generated.maze;
  gameState.goal = generated.goal;

  gameState.player = { x: 1, y: 1 };
  gameState.steps = 0;
  gameState.timerSeconds = 0;
  gameState.isGameWon = false;
  gameState.isSliding = false;
  gameState.showHint = false;
  gameState.hintPath = [];
  gameState.trail = [];
  gameState.particles = [];

  winModal.classList.add('hidden');
  updateStatsUI();
  loadBestRecord();

  // 타이머 리셋 및 재시작
  clearInterval(gameState.timerInterval);
  gameState.timerInterval = setInterval(() => {
    if (!gameState.isGameWon) {
      gameState.timerSeconds++;
      updateStatsUI();
    }
  }, 1000);

  resizeCanvas();
  render();
}

// --- 6. 캔버스 리사이즈 및 고해상도 DPI 보정 ---
function resizeCanvas() {
  const container = canvas.parentElement;
  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  // 정방형 캔버스 유지
  const side = Math.min(rect.width, rect.height || rect.width);
  canvas.width = side * dpr;
  canvas.height = side * dpr;
  canvas.style.width = `${side}px`;
  canvas.style.height = `${side}px`;

  ctx.resetTransform?.();
  ctx.scale(dpr, dpr);

  gameState.cellSize = side / gameState.gridSize;
}

// --- 7. 플레이어 이동 로직 (일반 vs 반중력 관성 모드) ---
async function movePlayer(dx, dy) {
  if (gameState.isGameWon || gameState.isSliding) return;

  const currentMaze = gameState.maze;
  const px = gameState.player.x;
  const py = gameState.player.y;

  // 다음 칸이 벽인지 확인
  const nextX = px + dx;
  const nextY = py + dy;

  if (currentMaze[nextY]?.[nextX] !== 1) {
    sounds.playBump();
    return;
  }

  if (!gameState.isAntiGravity) {
    // [모드 1] 일반 탐험 모드 (한 칸씩 정밀 이동)
    gameState.trail.push({ x: px, y: py, alpha: 1.0 });
    gameState.player.x = nextX;
    gameState.player.y = nextY;
    gameState.steps++;
    sounds.playMove();

    checkWinCondition();
    if (gameState.showHint) updateHint();
    render();
  } else {
    // [모드 2] 반중력 관성 슬라이드 모드 (벽에 닿을 때까지 미끄러짐!)
    gameState.isSliding = true;
    sounds.playSlide();

    let curX = px;
    let curY = py;
    let movedSteps = 0;

    // 미끄러지는 애니메이션 효과
    while (currentMaze[curY + dy]?.[curX + dx] === 1) {
      gameState.trail.push({ x: curX, y: curY, alpha: 0.9 });
      curX += dx;
      curY += dy;
      movedSteps++;

      gameState.player.x = curX;
      gameState.player.y = curY;
      render();

      // 출구에 도달하면 즉시 멈춤
      if (curX === gameState.goal.x && curY === gameState.goal.y) {
        break;
      }

      // 부드러운 이동 속도감 (밀리초 단위 딜레이)
      await new Promise(r => setTimeout(r, 28));
    }

    if (movedSteps > 0) {
      gameState.steps += movedSteps;
      sounds.playBump();
    }

    gameState.isSliding = false;
    checkWinCondition();
    if (gameState.showHint) updateHint();
    render();
  }

  updateStatsUI();
}

// --- 8. 승리 조건 체크 및 모달 팝업 ---
function checkWinCondition() {
  if (gameState.player.x === gameState.goal.x && gameState.player.y === gameState.goal.y) {
    gameState.isGameWon = true;
    clearInterval(gameState.timerInterval);
    sounds.playWin();
    createWinConfetti();

    // 최고 기록 저장 (LocalStorage)
    saveBestRecord();

    // 승리 모달 내용 채우기
    finalTime.textContent = formatTime(gameState.timerSeconds);
    finalSteps.textContent = gameState.steps;
    finalMode.textContent = gameState.isAntiGravity ? '반중력 미끄러짐' : '일반 걸음';
    
    setTimeout(() => {
      winModal.classList.remove('hidden');
    }, 400);
  }
}

// 승리 축하 파티클 생성
function createWinConfetti() {
  const count = 70;
  const colors = ['#00f0ff', '#b026ff', '#ffd700', '#00ff88', '#ffffff'];
  gameState.particles = [];

  const side = canvas.width / (window.devicePixelRatio || 1);

  for (let i = 0; i < count; i++) {
    gameState.particles.push({
      x: side / 2,
      y: side / 2,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.5) * 12 - 3,
      size: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      life: Math.random() * 40 + 60
    });
  }
}

// --- 9. 캔버스 렌더링 루프 ---
function render() {
  const size = gameState.gridSize;
  const cellSize = gameState.cellSize;
  const canvasWidth = canvas.width / (window.devicePixelRatio || 1);
  const canvasHeight = canvas.height / (window.devicePixelRatio || 1);

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // 1) 미로 벽 및 길 그리기
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (gameState.maze[y][x] === 0) {
        // 벽 (심우주 메탈릭 네이비)
        ctx.fillStyle = '#141b36';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

        // 벽 테두리 하이라이트
        ctx.strokeStyle = '#232f57';
        ctx.lineWidth = 1;
        ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
      } else {
        // 길 (어두운 심우주 배경)
        ctx.fillStyle = '#080c1a';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }

  // 2) 힌트 최단 경로 선 그리기 (활성화된 경우)
  if (gameState.showHint && gameState.hintPath.length > 1) {
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.7)';
    ctx.lineWidth = Math.max(2, cellSize * 0.25);
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    gameState.hintPath.forEach((pt, idx) => {
      const cx = (pt.x + 0.5) * cellSize;
      const cy = (pt.y + 0.5) * cellSize;
      if (idx === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.stroke();
    ctx.setLineDash([]); // 복원
  }

  // 3) 플레이어 이동 궤적 (잔상 파티클)
  for (let i = gameState.trail.length - 1; i >= 0; i--) {
    const t = gameState.trail[i];
    t.alpha -= 0.04;
    if (t.alpha <= 0) {
      gameState.trail.splice(i, 1);
      continue;
    }
    ctx.fillStyle = `rgba(0, 240, 255, ${t.alpha * 0.35})`;
    ctx.beginPath();
    ctx.arc((t.x + 0.5) * cellSize, (t.y + 0.5) * cellSize, cellSize * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4) 도착 출구 (차원 포탈 효과)
  const gx = (gameState.goal.x + 0.5) * cellSize;
  const gy = (gameState.goal.y + 0.5) * cellSize;
  const pulse = Math.sin(Date.now() * 0.006) * 0.15 + 0.85;

  ctx.save();
  ctx.shadowColor = '#b026ff';
  ctx.shadowBlur = 18;
  const portalGradient = ctx.createRadialGradient(gx, gy, 2, gx, gy, cellSize * 0.45 * pulse);
  portalGradient.addColorStop(0, '#ffffff');
  portalGradient.addColorStop(0.5, '#b026ff');
  portalGradient.addColorStop(1, 'rgba(0, 240, 255, 0)');
  ctx.fillStyle = portalGradient;
  ctx.beginPath();
  ctx.arc(gx, gy, cellSize * 0.45 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 5) 플레이어 (우주선 오브 / 안티그래비티 캡슐)
  const px = (gameState.player.x + 0.5) * cellSize;
  const py = (gameState.player.y + 0.5) * cellSize;

  ctx.save();
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#00f0ff';
  ctx.beginPath();
  ctx.arc(px, py, cellSize * 0.38, 0, Math.PI * 2);
  ctx.fill();

  // 코어 하이라이트
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px - cellSize * 0.1, py - cellSize * 0.1, cellSize * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 6) 안개 모드 (Fog of War) 마스킹
  if (gameState.isFogOfWar) {
    ctx.save();
    const viewRadius = cellSize * 3.6;
    const fogGrad = ctx.createRadialGradient(px, py, cellSize * 0.8, px, py, viewRadius);
    fogGrad.addColorStop(0, 'rgba(4, 7, 18, 0)');
    fogGrad.addColorStop(0.7, 'rgba(4, 7, 18, 0.4)');
    fogGrad.addColorStop(1, 'rgba(4, 7, 18, 0.98)');

    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 시야 바깥 영역 완전히 덮기
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#040712';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.restore();
  }

  // 7) 승리 축하 파티클 애니메이션
  if (gameState.particles.length > 0) {
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
      const p = gameState.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2; // 중력
      p.alpha -= 0.015;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (p.alpha <= 0) {
        gameState.particles.splice(i, 1);
      }
    }
    requestAnimationFrame(render);
  }
}

// 힌트 경로 재계산
function updateHint() {
  gameState.hintPath = findShortestPath(gameState.maze, gameState.player, gameState.goal);
}

// --- 10. UI 및 로컬스토리지 보조 함수 ---
function formatTime(totalSeconds) {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function updateStatsUI() {
  timerText.textContent = formatTime(gameState.timerSeconds);
  stepText.textContent = gameState.steps;
}

function saveBestRecord() {
  const key = `maze_best_${gameState.gridSize}_${gameState.isAntiGravity ? 'ag' : 'normal'}`;
  const currentBest = localStorage.getItem(key);
  const currentScore = gameState.timerSeconds;

  if (!currentBest || currentScore < parseInt(currentBest, 10)) {
    localStorage.setItem(key, currentScore);
  }
  loadBestRecord();
}

function loadBestRecord() {
  const key = `maze_best_${gameState.gridSize}_${gameState.isAntiGravity ? 'ag' : 'normal'}`;
  const best = localStorage.getItem(key);
  if (best) {
    bestRecordText.textContent = formatTime(parseInt(best, 10));
  } else {
    bestRecordText.textContent = '-';
  }
}

// --- 11. 이벤트 리스너 바인딩 ---

// 키보드 조작
window.addEventListener('keydown', (e) => {
  // 모달이 열려있을 때 닫기/재시작
  if (!winModal.classList.contains('hidden') && (e.key === 'Enter' || e.key === ' ')) {
    initGame();
    return;
  }

  switch (e.key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      e.preventDefault();
      movePlayer(0, -1);
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      e.preventDefault();
      movePlayer(0, 1);
      break;
    case 'ArrowLeft':
    case 'a':
    case 'A':
      e.preventDefault();
      movePlayer(-1, 0);
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      e.preventDefault();
      movePlayer(1, 0);
      break;
    case 'r':
    case 'R':
      initGame();
      break;
    case 'h':
    case 'H':
      toggleHint();
      break;
    case 'm':
    case 'M':
      toggleMode();
      break;
  }
});

// 터치 D-Pad 버튼 이벤트
btnUp.addEventListener('click', () => movePlayer(0, -1));
btnDown.addEventListener('click', () => movePlayer(0, 1));
btnLeft.addEventListener('click', () => movePlayer(-1, 0));
btnRight.addEventListener('click', () => movePlayer(1, 0));

// 모바일 스와이프 제스처 지원 (캔버스 위에서 손가락 쓸어넘기기)
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  sounds.init(); // 사용자 인터랙션 시 오디오 활성화
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;

  const dx = touchEndX - touchStartX;
  const dy = touchEndY - touchStartY;
  const threshold = 25; // 최소 스와이프 거리 (px)

  if (Math.abs(dx) > Math.abs(dy)) {
    if (Math.abs(dx) > threshold) {
      movePlayer(dx > 0 ? 1 : -1, 0);
    }
  } else {
    if (Math.abs(dy) > threshold) {
      movePlayer(0, dy > 0 ? 1 : -1);
    }
  }
}, { passive: true });

// 옵션 버튼 핸들러
function toggleMode() {
  gameState.isAntiGravity = !gameState.isAntiGravity;
  modeIcon.textContent = gameState.isAntiGravity ? '🛸' : '🚶';
  modeText.textContent = gameState.isAntiGravity ? '반중력 미끄러짐' : '한 칸씩 걷기';
  modeToggle.classList.toggle('active', gameState.isAntiGravity);
  sounds.playTone(550, 0.05);
  loadBestRecord();
}

function toggleFog() {
  gameState.isFogOfWar = !gameState.isFogOfWar;
  fogIcon.textContent = gameState.isFogOfWar ? '🔦' : '💡';
  fogText.textContent = gameState.isFogOfWar ? '안개 탐험' : '전체 시야';
  fogToggle.classList.toggle('active', gameState.isFogOfWar);
  sounds.playTone(450, 0.05);
  render();
}

function toggleSound() {
  gameState.isSoundOn = !gameState.isSoundOn;
  soundToggle.classList.toggle('active', gameState.isSoundOn);
  document.getElementById('soundIcon').textContent = gameState.isSoundOn ? '🔊' : '🔇';
  if (gameState.isSoundOn) sounds.playTone(600, 0.05);
}

function toggleHint() {
  gameState.showHint = !gameState.showHint;
  if (gameState.showHint) {
    updateHint();
    sounds.playTone(700, 0.08);
  }
  hintBtn.classList.toggle('active', gameState.showHint);
  render();
}

// 이벤트 리스너 연결
modeToggle.addEventListener('click', toggleMode);
fogToggle.addEventListener('click', toggleFog);
soundToggle.addEventListener('click', toggleSound);
hintBtn.addEventListener('click', toggleHint);
resetBtn.addEventListener('click', () => {
  sounds.playTone(380, 0.05);
  initGame();
});

difficultySelect.addEventListener('change', () => {
  sounds.playTone(420, 0.05);
  initGame();
});

modalNextBtn.addEventListener('click', initGame);

window.addEventListener('resize', () => {
  resizeCanvas();
  render();
});

// 초기화 실행
window.addEventListener('DOMContentLoaded', () => {
  initGame();
});

// 포탈 회전/펄스 주기적 렌더링 루프
setInterval(() => {
  if (!gameState.isSliding && !gameState.isGameWon) {
    render();
  }
}, 80);

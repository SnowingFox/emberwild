import './styles.css';
import { Game } from './game/Game';

const canvas = document.getElementById('game-canvas');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Game canvas not found');

try {
  new Game(canvas);
} catch (error) {
  console.error(error);
  const startScreen = document.getElementById('start-screen');
  if (startScreen) {
    startScreen.classList.add('visible');
    startScreen.innerHTML = `<div class="start-card"><div class="eyebrow">WebGL setup failed</div><h2>Emberwild</h2><p class="lede">This browser could not start the 3D world. Try the latest Chrome, Edge, or Safari with hardware acceleration enabled.</p></div>`;
  }
}

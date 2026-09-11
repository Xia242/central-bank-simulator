# Central Bank Simulator 🏛️

A real-time Monetary Policy Dashboard where you act as the central bank chair. Balance the economy, adjust interest rates, and prevent economic collapse!

## ✨ Features
* **Real-time Economic Physics Engine:** Powered by Phillips Curve economics (Inverse U-π relationship) and Geometric Brownian Motion (GBM) stochastic modeling.
* **Interactive Dashboard:** Live charting for CPI Inflation and Unemployment Rate at 60 FPS, built with Chart.js.
* **AI Auto-Pilot:** Built-in PID Controller targeting a strict 2% inflation rate that can dynamically adjust the Federal Funds Rate.
* **Survival Mechanics:** Keep inflation within the 2% ± 1% target zone. The game ends if inflation enters the danger zone (<-1.0% or >6.0%) for more than 10 seconds.

## 🛠️ Tech Stack
* HTML5 / CSS3 (CSS Variables, Flexbox/Grid)
* Vanilla JavaScript (ES6 Classes)
* Chart.js & Chart.js Annotation Plugin (via CDN)

## 🎮 How to Play
1. Open the simulator in your browser.
2. Monitor the **CPI Inflation** and **Unemployment Rate**.
3. Use the slider to adjust the policy interest rate between **Dovish (0%)** and **Hawkish (10%)**.
4. Alternatively, toggle the **AI Auto-Pilot** to watch the PID controller manage the economy automatically.
5. Survive as many quarters as possible!

## 🚀 Quick Start
Simply download or clone this repository and open `index.html` in any modern web browser (keep `simulator.js` alongside it). No build steps, Node.js, or server setup required.
## Validation
Run `node --test tests/*.cjs` with Node.js 20 or newer. The economic engine and PID controller run at a fixed 60 Hz, independent of the screen refresh rate. Charts start at Q0 and keep the last 100 actual samples. Background-tab delays are capped to pause rather than fast-forward gameplay.

        class EconomicEngine {
            constructor() {
                // Economic parameters
                this.NAIRU = 5.0;              // Natural Rate of Unemployment
                this.NEUTRAL_RATE = 2.5;       // Neutral interest rate
                this.TARGET_INFLATION = 2.0;   // Target inflation rate

                // Danger zone thresholds
                this.DANGER_LOW = -1.0;        // Deflation danger
                this.DANGER_HIGH = 6.0;        // Hyperinflation danger
                this.DANGER_TIME_LIMIT = 10;   // Seconds in danger zone before game over

                // Reset state
                this.reset();
            }

            reset() {
                // State variables
                this.inflation = 2.0;
                this.unemployment = 5.0;
                this.interestRate = 2.5;

                // FIXED: Much lower coefficients for stable gameplay
                this.phillipsBeta = 0.008;     // Reduced from 0.4
                this.okunAlpha = 0.006;        // Reduced from 0.3

                // FIXED: Much lower GBM volatility
                this.inflationVolatility = 0.002;   // Reduced from 0.15
                this.unemploymentVolatility = 0.001; // Reduced from 0.1
                this.drift = 0.0;

                // History for charts
                this.maxHistory = 100;
                this.inflationHistory = [this.inflation];
                this.unemploymentHistory = [this.unemployment];
                this.timeLabels = ["Q0"];
                this.physicsAccumulator = 0;
                this.fixedStep = 1 / 60;

                // Simulation state
                this.quarter = 0;
                this.quarterAccumulator = 0;
                this.previousInflation = 2.0;
                this.previousUnemployment = 5.0;

                // Game over state
                this.dangerZoneTime = 0;
                this.isInDangerZone = false;
                this.gameOver = false;

                // Box-Muller state
                this.spareGaussian = null;
                this.hasSpare = false;
            }

            /**
             * Box-Muller Transform for normally distributed random numbers
             */
            generateGaussian(mean = 0, stdDev = 1) {
                if (this.hasSpare) {
                    this.hasSpare = false;
                    return mean + stdDev * this.spareGaussian;
                }

                let u, v, s;
                do {
                    u = Math.random() * 2 - 1;
                    v = Math.random() * 2 - 1;
                    s = u * u + v * v;
                } while (s >= 1 || s === 0);

                const mul = Math.sqrt(-2.0 * Math.log(s) / s);
                this.spareGaussian = v * mul;
                this.hasSpare = true;

                return mean + stdDev * u * mul;
            }

            /**
             * Geometric Brownian Motion (GBM) - FIXED with proper scaling
             * dX = μ*X*dt + σ*X*dW
             */
            applyGBM(currentValue, drift, volatility) {
                // Wiener process increment with fixed small timestep
                const dW = this.generateGaussian(0, 1);

                // GBM increment - properly scaled
                const dX = drift * currentValue + volatility * currentValue * dW;

                return currentValue + dX;
            }

            /**
             * Phillips Curve Implementation - FIXED with proper damping
             */
            applyPhillipsCurve() {
                // Unemployment gap (deviation from natural rate)
                const unemploymentGap = this.unemployment - this.NAIRU;

                // Interest rate gap (deviation from neutral)
                const rateGap = this.interestRate - this.NEUTRAL_RATE;

                // Phillips Curve: inflation responds inversely to unemployment gap
                // Higher unemployment = lower inflation pressure
                const inflationPressure = -this.phillipsBeta * unemploymentGap;

                // Taylor Rule effect: higher rates = higher unemployment
                const unemploymentPressure = this.okunAlpha * rateGap;

                // Strong mean reversion for stability
                const inflationReversion = 0.003 * (this.TARGET_INFLATION - this.inflation);
                const unemploymentReversion = 0.002 * (this.NAIRU - this.unemployment);

                // Apply adjustments with damping
                this.inflation += inflationPressure + inflationReversion;
                this.unemployment += unemploymentPressure + unemploymentReversion;
            }

            /**
             * Check if in danger zone
             */
            checkDangerZone(dt) {
                const inDanger = this.inflation < this.DANGER_LOW || this.inflation > this.DANGER_HIGH;

                if (inDanger) {
                    this.isInDangerZone = true;
                    this.dangerZoneTime += dt;

                    if (this.dangerZoneTime >= this.DANGER_TIME_LIMIT) {
                        this.gameOver = true;
                    }
                } else {
                    this.isInDangerZone = false;
                    // Slowly recover danger time when stable
                    this.dangerZoneTime = Math.max(0, this.dangerZoneTime - dt * 0.5);
                }

                return this.gameOver;
            }

            /**
             * Main simulation update (called at 60 FPS)
             */
            update(dt) {
                if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid time step');
                if (this.gameOver) return true;
                this.physicsAccumulator += dt;
                while (this.physicsAccumulator + 1e-12 >= this.fixedStep) {
                    this.physicsAccumulator = Math.max(0, this.physicsAccumulator - this.fixedStep);
                    if (this.step(this.fixedStep)) return true;
                }
                return false;
            }

            step(dt) {
                if (this.gameOver) return true;

                // Store previous values for change calculation
                this.previousInflation = this.inflation;
                this.previousUnemployment = this.unemployment;

                // Apply Phillips Curve economics
                this.applyPhillipsCurve();

                // Apply Geometric Brownian Motion for market noise
                this.inflation = this.applyGBM(
                    this.inflation,
                    this.drift,
                    this.inflationVolatility
                );

                this.unemployment = this.applyGBM(
                    this.unemployment,
                    this.drift,
                    this.unemploymentVolatility
                );

                // Soft clamps with elastic bounds
                this.inflation = Math.max(-5, Math.min(15, this.inflation));
                this.unemployment = Math.max(0.5, Math.min(25, this.unemployment));

                // Accumulate time for quarter updates
                this.quarterAccumulator += dt;

                // Update quarter every 1 second
                if (this.quarterAccumulator + 1e-12 >= 1.0) {
                    this.quarterAccumulator = Math.max(0, this.quarterAccumulator - 1.0);
                    this.quarter++;

                    // Update history
                    if (this.inflationHistory.length >= this.maxHistory) this.inflationHistory.shift();
                    this.inflationHistory.push(this.inflation);

                    if (this.unemploymentHistory.length >= this.maxHistory) this.unemploymentHistory.shift();
                    this.unemploymentHistory.push(this.unemployment);

                    // Update labels
                    if (this.timeLabels.length >= this.maxHistory) this.timeLabels.shift();
                    this.timeLabels.push(`Q${this.quarter}`);
                }

                // Check for game over
                return this.checkDangerZone(dt);
            }

            setInterestRate(rate) {
                this.interestRate = rate;
            }

            getInflationChange() {
                return (this.inflation - this.previousInflation) * 100;
            }

            getUnemploymentChange() {
                return (this.unemployment - this.previousUnemployment) * 100;
            }

            calculateHealthIndex() {
                const inflationDev = Math.abs(this.inflation - this.TARGET_INFLATION);
                const unemploymentDev = Math.abs(this.unemployment - this.NAIRU);
                const health = 100 - (inflationDev * 8 + unemploymentDev * 4);
                return Math.max(0, Math.min(100, Math.round(health)));
            }

            getDangerTimeRemaining() {
                return Math.max(0, this.DANGER_TIME_LIMIT - this.dangerZoneTime);
            }
        }

        // ============================================================
        // AGENT 1 (THE QUANT): PID Controller for Auto-Pilot
        // ============================================================

        class PIDController {
            constructor(target = 2.0) {
                this.target = target;           // Target inflation (2%)

                // PID Gains - Tuned for smooth response
                // Higher Kp = faster response but more overshoot
                // Higher Ki = eliminates steady-state error but can cause oscillation
                // Higher Kd = dampens oscillation but can amplify noise
                this.Kp = 0.8;    // Proportional gain
                this.Ki = 0.1;    // Integral gain (low to prevent windup)
                this.Kd = 0.3;    // Derivative gain (smooths response)

                // Controller state
                this.integral = 0;
                this.previousError = 0;
                this.output = 2.5;              // Start at neutral rate

                // Anti-windup limits
                this.integralMax = 5.0;
                this.integralMin = -5.0;

                // Output limits (interest rate bounds)
                this.outputMin = 0.0;
                this.outputMax = 10.0;

                // Smoothing factor for output changes
                this.smoothingFactor = 0.1;     // Lower = smoother transitions

                // Debug values
                this.lastP = 0;
                this.lastI = 0;
                this.lastD = 0;
            }

            reset() {
                this.integral = 0;
                this.previousError = 0;
                this.output = 2.5;
                this.lastP = 0;
                this.lastI = 0;
                this.lastD = 0;
            }

            /**
             * Compute PID output
             * @param {number} currentInflation - Current inflation rate
             * @param {number} dt - Time delta in seconds
             * @returns {number} - Interest rate to apply
             */
            compute(currentInflation, dt) {
                // Error: positive when inflation is above target
                const error = currentInflation - this.target;

                // Proportional term
                const P = this.Kp * error;

                // Integral term with anti-windup
                this.integral += error * dt;
                this.integral = Math.max(this.integralMin, Math.min(this.integralMax, this.integral));
                const I = this.Ki * this.integral;

                // Derivative term (rate of change of error)
                const derivative = dt > 0 ? (error - this.previousError) / dt : 0;
                const D = this.Kd * derivative;

                // Store for next iteration
                this.previousError = error;

                // Calculate raw output
                // When inflation is HIGH (positive error), we want HIGH interest rate
                // So we ADD the PID output to the neutral rate
                const rawOutput = 2.5 + P + I + D;

                // Clamp to valid range
                const clampedOutput = Math.max(this.outputMin, Math.min(this.outputMax, rawOutput));

                // Smooth the transition to prevent jerky movements
                this.output += (clampedOutput - this.output) * this.smoothingFactor;

                // Store debug values
                this.lastP = P;
                this.lastI = I;
                this.lastD = D;

                return this.output;
            }

            getDebugValues() {
                return {
                    error: this.previousError,
                    P: this.lastP,
                    I: this.lastI,
                    D: this.lastD,
                    integral: this.integral,
                    output: this.output
                };
            }
        }

        // ============================================================
        // AGENT 2 (THE FRONTEND): UI & Visualization
        // ============================================================

        class Dashboard {
            constructor(engine, pidController) {
                this.engine = engine;
                this.pid = pidController;
                this.autopilotEnabled = false;
                this.inflationChart = null;
                this.unemploymentChart = null;
                this.initCharts();
                this.initControls();
            }

            initCharts() {
                const commonOptions = {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 0 },
                    interaction: { intersect: false, mode: 'index' },
                    scales: {
                        x: {
                            display: true,
                            grid: { color: 'rgba(148, 163, 184, 0.1)' },
                            ticks: { color: '#94a3b8', maxTicksLimit: 10 }
                        },
                        y: {
                            display: true,
                            grid: { color: 'rgba(148, 163, 184, 0.1)' },
                            ticks: {
                                color: '#94a3b8',
                                callback: (val) => val.toFixed(1) + '%'
                            }
                        }
                    },
                    plugins: { legend: { display: false } }
                };

                // Inflation Chart
                const inflationCtx = document.getElementById('inflationChart').getContext('2d');
                const inflationGradient = inflationCtx.createLinearGradient(0, 0, 0, 280);
                inflationGradient.addColorStop(0, 'rgba(245, 158, 11, 0.3)');
                inflationGradient.addColorStop(1, 'rgba(245, 158, 11, 0.0)');

                this.inflationChart = new Chart(inflationCtx, {
                    type: 'line',
                    data: {
                        labels: this.engine.timeLabels,
                        datasets: [{
                            label: 'CPI Inflation',
                            data: this.engine.inflationHistory,
                            borderColor: '#f59e0b',
                            backgroundColor: inflationGradient,
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 0
                        }]
                    },
                    options: {
                        ...commonOptions,
                        scales: {
                            ...commonOptions.scales,
                            y: { ...commonOptions.scales.y, min: -2, max: 10 }
                        },
                        plugins: {
                            ...commonOptions.plugins,
                            annotation: {
                                annotations: {
                                    targetZone: {
                                        type: 'box',
                                        yMin: 1,
                                        yMax: 3,
                                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                        borderColor: 'rgba(16, 185, 129, 0.5)',
                                        borderWidth: 1
                                    },
                                    dangerHigh: {
                                        type: 'box',
                                        yMin: 6,
                                        yMax: 10,
                                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                        borderColor: 'rgba(239, 68, 68, 0.3)',
                                        borderWidth: 1
                                    },
                                    dangerLow: {
                                        type: 'box',
                                        yMin: -2,
                                        yMax: -1,
                                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                        borderColor: 'rgba(239, 68, 68, 0.3)',
                                        borderWidth: 1
                                    },
                                    targetLine: {
                                        type: 'line',
                                        yMin: 2,
                                        yMax: 2,
                                        borderColor: '#10b981',
                                        borderWidth: 2,
                                        borderDash: [6, 4]
                                    }
                                }
                            }
                        }
                    }
                });

                // Unemployment Chart
                const unemploymentCtx = document.getElementById('unemploymentChart').getContext('2d');
                const unemploymentGradient = unemploymentCtx.createLinearGradient(0, 0, 0, 280);
                unemploymentGradient.addColorStop(0, 'rgba(6, 182, 212, 0.3)');
                unemploymentGradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

                this.unemploymentChart = new Chart(unemploymentCtx, {
                    type: 'line',
                    data: {
                        labels: this.engine.timeLabels,
                        datasets: [{
                            label: 'Unemployment Rate',
                            data: this.engine.unemploymentHistory,
                            borderColor: '#06b6d4',
                            backgroundColor: unemploymentGradient,
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 0
                        }]
                    },
                    options: {
                        ...commonOptions,
                        scales: {
                            ...commonOptions.scales,
                            y: { ...commonOptions.scales.y, min: 0, max: 15 }
                        },
                        plugins: {
                            ...commonOptions.plugins,
                            annotation: {
                                annotations: {
                                    nairuLine: {
                                        type: 'line',
                                        yMin: 5,
                                        yMax: 5,
                                        borderColor: '#3b82f6',
                                        borderWidth: 2,
                                        borderDash: [6, 4]
                                    }
                                }
                            }
                        }
                    }
                });
            }

            initControls() {
                const slider = document.getElementById('interestRate');
                const sliderValue = document.getElementById('sliderValue');
                const autopilotToggle = document.getElementById('autopilotToggle');
                const sliderWrapper = document.getElementById('sliderWrapper');

                slider.addEventListener('input', (e) => {
                    if (!this.autopilotEnabled) {
                        const rate = parseFloat(e.target.value);
                        this.engine.setInterestRate(rate);
                        sliderValue.textContent = rate.toFixed(2) + '%';
                        this.updateRateDisplay(rate);
                    }
                });

                // Autopilot toggle handler
                autopilotToggle.addEventListener('change', (e) => {
                    this.autopilotEnabled = e.target.checked;
                    const autopilotStatus = document.getElementById('autopilotStatus');
                    const pidIndicator = document.getElementById('pidIndicator');

                    if (this.autopilotEnabled) {
                        autopilotStatus.innerHTML = '<span>●</span> AI Active';
                        autopilotStatus.classList.add('active');
                        pidIndicator.classList.add('active');
                        sliderWrapper.classList.add('disabled');
                        this.pid.reset();
                    } else {
                        autopilotStatus.innerHTML = '<span>●</span> Manual Mode';
                        autopilotStatus.classList.remove('active');
                        pidIndicator.classList.remove('active');
                        sliderWrapper.classList.remove('disabled');
                    }
                });
            }

            /**
             * Run PID controller and update slider
             */
            updateAutopilot(dt) {
                if (!this.autopilotEnabled) return;

                // Compute new interest rate from PID
                const newRate = this.pid.compute(this.engine.inflation, dt);

                // Apply to engine
                this.engine.setInterestRate(newRate);

                // Update slider position visually
                const slider = document.getElementById('interestRate');
                const sliderValue = document.getElementById('sliderValue');
                slider.value = newRate;
                sliderValue.textContent = newRate.toFixed(2) + '%';
                this.updateRateDisplay(newRate);

                // Update PID debug display
                const debug = this.pid.getDebugValues();
                document.getElementById('pidError').textContent = debug.error.toFixed(3);
                document.getElementById('pidIntegral').textContent = debug.integral.toFixed(3);
                document.getElementById('pidDerivative').textContent = (debug.D / this.pid.Kd).toFixed(3);
                document.getElementById('pidOutput').textContent = debug.output.toFixed(2) + '%';
            }

            updateRateDisplay(rate) {
                const rateValue = document.getElementById('rateValue');
                const rateChange = document.getElementById('rateChange');

                rateValue.textContent = rate.toFixed(2) + '%';

                if (rate < 2.0) {
                    rateChange.innerHTML = '<span>🕊️</span> Dovish Stance';
                    rateChange.className = 'metric-change positive';
                } else if (rate > 3.0) {
                    rateChange.innerHTML = '<span>🦅</span> Hawkish Stance';
                    rateChange.className = 'metric-change negative';
                } else {
                    rateChange.innerHTML = '<span>↔</span> Neutral Stance';
                    rateChange.className = 'metric-change';
                }
            }

            updateUI() {
                // Update metric cards
                const inflationEl = document.getElementById('inflationValue');
                const unemploymentEl = document.getElementById('unemploymentValue');

                inflationEl.textContent = this.engine.inflation.toFixed(2) + '%';
                unemploymentEl.textContent = this.engine.unemployment.toFixed(2) + '%';

                // Update inflation card danger state
                const inflationCard = document.getElementById('inflationCard');
                if (this.engine.isInDangerZone) {
                    inflationCard.classList.add('danger');
                } else {
                    inflationCard.classList.remove('danger');
                }

                // Update status indicator
                const statusPulse = document.getElementById('statusPulse');
                const statusText = document.getElementById('statusText');
                const dangerTimer = document.getElementById('dangerTimer');

                if (this.engine.isInDangerZone) {
                    statusPulse.className = 'pulse danger';
                    statusText.textContent = '⚠️ DANGER ZONE';
                    dangerTimer.style.display = 'inline';
                    dangerTimer.textContent = `${this.engine.getDangerTimeRemaining().toFixed(1)}s`;
                } else if (this.engine.dangerZoneTime > 0) {
                    statusPulse.className = 'pulse warning';
                    statusText.textContent = 'Recovering...';
                    dangerTimer.style.display = 'none';
                } else {
                    statusPulse.className = 'pulse';
                    statusText.textContent = 'Live @ 60 FPS';
                    dangerTimer.style.display = 'none';
                }

                // Update changes
                const inflChange = this.engine.getInflationChange();
                const inflChangeEl = document.getElementById('inflationChange');
                inflChangeEl.innerHTML = `<span>${inflChange > 0.1 ? '↑' : inflChange < -0.1 ? '↓' : '→'}</span> ${Math.abs(inflChange).toFixed(2)} bps`;
                inflChangeEl.className = `metric-change ${inflChange > 0.1 ? 'negative' : inflChange < -0.1 ? 'positive' : ''}`;

                const unempChange = this.engine.getUnemploymentChange();
                const unempChangeEl = document.getElementById('unemploymentChange');
                unempChangeEl.innerHTML = `<span>${unempChange > 0.1 ? '↑' : unempChange < -0.1 ? '↓' : '→'}</span> ${Math.abs(unempChange).toFixed(2)} bps`;
                unempChangeEl.className = `metric-change ${unempChange > 0.1 ? 'negative' : unempChange < -0.1 ? 'positive' : ''}`;

                // Update health index
                const health = this.engine.calculateHealthIndex();
                document.getElementById('healthIndex').textContent = health;
                const healthChange = document.getElementById('healthChange');
                if (health >= 80) {
                    healthChange.innerHTML = '<span>●</span> Healthy';
                    healthChange.className = 'metric-change positive';
                } else if (health >= 50) {
                    healthChange.innerHTML = '<span>●</span> Moderate';
                    healthChange.className = 'metric-change';
                } else {
                    healthChange.innerHTML = '<span>●</span> Critical';
                    healthChange.className = 'metric-change negative';
                }

                // Update simulation time
                document.getElementById('simTime').textContent = `Quarter: ${this.engine.quarter}`;

                // Update charts
                this.inflationChart.data.datasets[0].data = [...this.engine.inflationHistory];
                this.inflationChart.data.labels = [...this.engine.timeLabels];
                this.inflationChart.update('none');

                this.unemploymentChart.data.datasets[0].data = [...this.engine.unemploymentHistory];
                this.unemploymentChart.data.labels = [...this.engine.timeLabels];
                this.unemploymentChart.update('none');
            }

            showGameOver() {
                const overlay = document.getElementById('gameOverOverlay');
                const message = document.getElementById('gameOverMessage');

                if (this.engine.inflation > 6) {
                    message.textContent = 'Hyperinflation has destroyed the economy! Prices skyrocketed beyond control, leading to economic collapse.';
                } else {
                    message.textContent = 'Severe deflation has triggered an economic depression! Falling prices caused a deflationary spiral.';
                }

                document.getElementById('finalInflation').textContent = this.engine.inflation.toFixed(2) + '%';
                document.getElementById('quartersSurvived').textContent = this.engine.quarter;
                document.getElementById('finalUnemployment').textContent = this.engine.unemployment.toFixed(2) + '%';

                overlay.classList.add('active');
            }

            hideGameOver() {
                document.getElementById('gameOverOverlay').classList.remove('active');
            }

            resetUI() {
                document.getElementById('interestRate').value = 2.5;
                document.getElementById('sliderValue').textContent = '2.50%';
                this.updateRateDisplay(2.5);
            }
        }

        // ============================================================
        // AGENT 3 (THE DEVOPS): Game Loop & Initialization
        // ============================================================

        class Simulator {
            constructor() {
                this.engine = new EconomicEngine();
                this.pid = new PIDController(2.0);  // Target 2% inflation
                this.dashboard = new Dashboard(this.engine, this.pid);

                this.targetFPS = 60;
                this.frameInterval = 1000 / this.targetFPS;
                this.lastTime = null;
                this.accumulator = 0;

                this.running = true;
                this.setupRestartButton();
            }

            setupRestartButton() {
                document.getElementById('restartBtn').addEventListener('click', () => {
                    this.restart();
                });
            }

            restart() {
                this.engine.reset();
                this.pid.reset();
                this.dashboard.hideGameOver();
                this.dashboard.resetUI();

                // Reset autopilot toggle
                document.getElementById('autopilotToggle').checked = false;
                this.dashboard.autopilotEnabled = false;
                document.getElementById('autopilotStatus').innerHTML = '<span>●</span> Manual Mode';
                document.getElementById('autopilotStatus').classList.remove('active');
                document.getElementById('pidIndicator').classList.remove('active');
                document.getElementById('sliderWrapper').classList.remove('disabled');

                // Reinitialize charts with fresh data
                this.dashboard.inflationChart.data.datasets[0].data = [...this.engine.inflationHistory];
                this.dashboard.unemploymentChart.data.datasets[0].data = [...this.engine.unemploymentHistory];
                this.dashboard.inflationChart.update();
                this.dashboard.unemploymentChart.update();

                this.running = true;
                this.lastTime = null;
                this.accumulator = 0;
                requestAnimationFrame((time) => this.gameLoop(time));
            }

            gameLoop(currentTime) {
                if (!this.running) return;

                if (this.lastTime === null) this.lastTime = currentTime;

                const deltaTime = Math.min(currentTime - this.lastTime, 100); // Cap delta
                this.lastTime = currentTime;

                const dt = deltaTime / 1000; // Convert to seconds

                // Run both control and physics at 60 fixed steps per simulated second.
                this.accumulator += dt;
                let gameOver = this.engine.gameOver;
                const step = 1 / this.targetFPS;
                while (this.accumulator + 1e-12 >= step && !gameOver) {
                    this.accumulator = Math.max(0, this.accumulator - step);
                    this.dashboard.updateAutopilot(step);
                    gameOver = this.engine.update(step);
                }

                // Update UI
                this.dashboard.updateUI();

                if (gameOver) {
                    this.running = false;
                    this.dashboard.showGameOver();
                    return;
                }

                requestAnimationFrame((time) => this.gameLoop(time));
            }

            start() {
                console.log('🏛️ Central Bank Simulator Initialized');
                console.log('📊 Running at 60 FPS with stabilized GBM');
                console.log('🤖 AI Auto-Pilot: PID Controller (Kp=0.8, Ki=0.1, Kd=0.3)');
                console.log('⚠️ Game Over if inflation stays in danger zone for 10 seconds');
                console.log('⚡ Starting simulation...');

                requestAnimationFrame((time) => this.gameLoop(time));
            }
        }


if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EconomicEngine, PIDController, Simulator };
}
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => new Simulator().start());
}

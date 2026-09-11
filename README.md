# Central Bank Simulator

A small browser game about adjusting interest rates. Raise or lower the policy rate and watch how inflation and unemployment change. An optional PID controller adjusts the rate toward a 2% inflation target.

## Run

Open `index.html` in a browser, keeping `simulator.js` in the same directory. No build step is required. Chart.js and its annotation plugin load from a CDN, so an internet connection is needed.

## Rules

- Set the policy rate between 0% and 10%, or enable automatic control.
- The target inflation range is 1%–3%.
- Inflation below −1% or above 6% adds to a danger timer. The game ends when that timer reaches 10 seconds.
- Inside the safe range, the danger timer decreases by half a second per simulated second; it does not reset immediately.
- Each simulated second counts as one game quarter. Charts keep the last 100 samples.

## Model

Inflation responds to the unemployment gap, while unemployment responds to the gap between the policy rate and a 2.5% baseline. Both variables move back toward their baselines and receive multiplicative random noise. The coefficients are chosen for gameplay, not estimated from economic data.

The automatic controller combines proportional, integral and derivative terms. Its output is smoothed and limited to the slider range. It is a PID controller, not a trained AI model.

Physics and control run at 60 fixed steps per simulated second. Rendering follows the browser's refresh rate. Long frame delays are capped at 100 ms, so background tabs do not fast-forward the game when reopened.

## Files

- `index.html`: layout, styles and chart dependencies.
- `simulator.js`: economic model, PID controller, dashboard and game loop.
- `tests/simulator.test.cjs`: regression tests.

## Tests

With Node.js 20 or newer:

```sh
node --test tests/*.cjs
```

Tests cover frame-rate independence in manual and automatic modes, time-step validation, chart history, reset and the danger timer.

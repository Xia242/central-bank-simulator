const test = require('node:test');
const assert = require('node:assert/strict');
const { EconomicEngine, PIDController, Simulator } = require('../simulator.js');
function run(fps, autopilot = false) {
    const sim = Object.create(Simulator.prototype);
    sim.engine = new EconomicEngine();
    sim.engine.generateGaussian = () => 0;
    sim.engine.setInterestRate(5);
    sim.pid = new PIDController();
    sim.targetFPS = 60; sim.lastTime = null; sim.accumulator = 0; sim.running = true;
    sim.dashboard = {updateAutopilot(dt) {if(autopilot) sim.engine.setInterestRate(sim.pid.compute(sim.engine.inflation,dt));}, updateUI(){}, showGameOver(){}};
    global.requestAnimationFrame = () => {};
    for(let i=0;i<=fps*5;i++) sim.gameLoop(i*1000/fps);
    return [sim.engine.inflation,sim.engine.unemployment,sim.engine.quarter,sim.pid.output];
}
test('manual and autopilot are independent of rendering FPS', () => {
    for(const auto of [false,true]) for(const fps of [30,60,120,144]) assert.deepEqual(run(fps,auto),run(60,auto));
});
test('engine accepts elapsed time without changing zero-duration state', () => {
    const e=new EconomicEngine();e.generateGaussian=()=>0;e.setInterestRate(5);
    e.update(0);assert.equal(e.unemployment,5);
    assert.throws(()=>e.update(NaN));assert.throws(()=>e.update(-1));
    e.update(1);assert.equal(e.quarter,1);assert.deepEqual(e.timeLabels,['Q0','Q1']);
});
test('history is chronological and bounded, reset clears it', () => {
    const e=new EconomicEngine(); e.generateGaussian=()=>0;
    for(let i=0;i<120;i++) e.update(1);
    assert.equal(e.timeLabels.length,100);assert.equal(e.timeLabels[0],'Q21');assert.equal(e.timeLabels.at(-1),'Q120');
    e.reset();assert.deepEqual(e.timeLabels,['Q0']);assert.deepEqual(e.inflationHistory,[2]);
});
test('danger countdown lasts ten simulated seconds', () => {
    const e=new EconomicEngine();e.applyPhillipsCurve=()=>{};e.generateGaussian=()=>0;e.inflation=7;
    e.update(9);assert.equal(e.gameOver,false);e.update(1.1);assert.equal(e.gameOver,true);
});

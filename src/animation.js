import EventEmitter from 'events';

/**
 * An animator manages an animation loop and dispatches update events to its registered objects
 * every frame.
 */
class Animator {
    constructor () {
        /** Update targets. */
        this.targets = new Set();

        /** The current loop ID. Used to prevent multiple animation loops running simultaneously. */
        this.currentLoopID = 0;

        /** True if the animation loop is running. */
        this.running = false;

        /**
         * The timestamp of the previous iteration of the animation loop. Used to calculate delta
         * time. Will be set when the animation loop starts.
         */
        this.prevTime = null;

        /** Global animation speed. */
        this.animationSpeed = 1;
    }

    /**
     * Registers an object with the animator. This object must have a function member named
     * `update`. That function will then be called with the elapsed time in seconds.
     *
     * @param {Object} target - the target object
     */
    register (target) {
        this.targets.add(target);
        this.start();
    }

    /**
     * Deregisters an object. Does nothing if it was never registered.
     *
     * @param {Object} target - the target object
     */
    deregister (target) {
        this.targets.delete(target);
    }

    /**
     * Starts the animation loop if it isn’t already running.
     * Calling this function directly should generally be unnecessary.
     */
    start () {
        if (this.running) return;
        this.running = true;
        this.currentLoopID++;
        this.prevTime = Date.now();
        this.animationLoop(this.currentLoopID);
    }

    /**
     * Stops the animation loop.
     * Calling this function directly should generally be unnecessary.
     */
    stop () {
        this.running = false;
    }

    /** The animation loop function; should not be called directly. */
    animationLoop (loopID) {
        // check if the loop should be running in the first place
        if (loopID != this.currentLoopID || !this.running) return;

        // if no targets are present, stop
        if (!this.targets.size) {
            this.stop();
            return;
        }

        // schedule the next loop iteration
        window.requestAnimationFrame(() => this.animationLoop(loopID));

        // dispatch
        const now = Date.now();
        const deltaTime = (now - this.prevTime) / 1000 * this.animationSpeed;
        this.prevTime = now;

        for (const target of this.targets) {
            target.update(deltaTime);
        }
    }
}

/** The global animator. */
export const globalAnimator = new Animator();

window.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // suspend animations when the tab is no longer visible
        globalAnimator.stop();
    } else {
        globalAnimator.start();
    }
});

/**
 * The longest time interval allowed for the spring equations—this is small so the spring
 * doesn’t become unstable.
 */
const MAX_SPRING_TIME_INTERVAL = 1 / 60;

/**
 * Simulates spring physics.
 *
 * Will use the global animator.
 *
 * # Events
 * - `update`(value: number): Fired every time the spring is updated by the global animator
 */
export class Spring extends EventEmitter {
    /**
     * Creates a new spring.
     * @param {number} dampingRatio - the damping ratio of the spring (not to be confused with the
     *                                damping coefficient)
     * @param {number} period       - the period in seconds
     */
    constructor (dampingRatio, period) {
        super();

        /** The current value (or position). */
        this.value = 0;

        /** The current spring velocity. */
        this.velocity = 0;

        /**
         * The target value. If null, no force will be applied, meaning the spring will just slowly
         * decelerate due to damping.
         *
         * @type {(number|null)}
         */
        this.target = null;

        /** Force coefficient. */
        this.force = 0;

        /** Damping coefficient. */
        this.damping = 0;

        /** Tolerance below which the spring will be considered stationary. */
        this.tolerance = 1 / 1000;

        /**
         * If true, the spring will stop animating automatically once it’s done (also see
         * tolerance).
         */
        this.stopAutomatically = true;

        /**
         * If true, the spring won’t move but will still fire update events.
         * Useful e.g. when the user is dragging something controlled by a spring.
         */
        this.locked = false;

        this.setDampingRatioAndPeriod(dampingRatio, period);
    }

    /**
     * Sets the damping ratio and the period.
     * @param {number} dampingRatio
     * @param {number} period
     */
    setDampingRatioAndPeriod (dampingRatio, period) {
        const forceSqrt = 2 * Math.PI / period;
        const damping = dampingRatio * (2 * forceSqrt);

        this.force = forceSqrt * forceSqrt;
        this.damping = damping;
    }

    /**
     * Updates the spring.
     *
     * Will emit an 'update' event with the current value.
     * @param {number} elapsed - the elapsed time in seconds
     */
    update (elapsed) {
        let timeLeft = Math.min(elapsed, 1); // simulate at most an entire second at once
        if (this.locked) timeLeft = 0; // don’t update if the spring is locked
        while (timeLeft > 0) {
            const dt = Math.min(timeLeft, MAX_SPRING_TIME_INTERVAL);
            const force = this.currentForce();
            this.value += this.velocity * dt;
            this.velocity += force * dt;
            timeLeft -= dt;
        }

        if (this.stopAutomatically && !this.wantsUpdate()) {
            this.finish();
            this.stop();
        }

        this.emit('update', this.value);
    }

    /** @returns {boolean} - true if the spring should not be considered stopped. */
    wantsUpdate () {
        return Math.abs(this.value - this.target) + Math.abs(this.velocity) > this.tolerance;
    }

    /** Starts the spring by registering it in the global animator. */
    start () {
        globalAnimator.register(this);
    }

    /** Stops the spring by deregistering it in the global animator. */
    stop () {
        globalAnimator.deregister(this);
    }

    /** Will finish the animation by immediately jumping to the end and emitting an `update`. */
    finish () {
        if (this.target === null) return;
        this.value = this.target;
        this.velocity = 0;
        this.emit('update', this.value);
        this.stop();
    }

    /** @returns {number} - the current force. */
    currentForce () {
        if (this.target !== null) {
            return -this.force * (this.value - this.target) - this.damping * this.velocity;
        } else {
            return -this.damping * this.velocity;
        }
    }

    /** @returns {number} - the damping ratio. */
    getDampingRatio () {
        return this.damping / (2 * Math.sqrt(this.force));
    }

    /** @returns {number} - the period. */
    getPeriod () {
        return 2 * Math.PI / Math.sqrt(this.force);
    }

    /**
     * Sets the period.
     * @param {number} period
     */
    setPeriod (period) {
        const dampingRatio = this.getDampingRatio();
        this.setDampingRatioAndPeriod(dampingRatio, period);
    }

    /**
     * Sets the dampingRatio.
     * @param {number} dampingRatio
     */
    setDampingRatio (dampingRatio) {
        const period = this.getPeriod();
        this.setDampingRatioAndPeriod(dampingRatio, period);
    }
}

/**
 * Linearly interpolates between a and b using t.
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @returns {number}
 */
export function lerp (a, b, t) {
    return t * (b - a) + a;
}

/**
 * Clamps a value to the interval between l and h.
 * @param {number} x
 * @param {number} l
 * @param {number} h
 * @returns {number}
 */
export function clamp (x, l, h) {
    return Math.max(l, Math.min(x, h));
}
